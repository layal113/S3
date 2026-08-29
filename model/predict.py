import os
import json
import joblib
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Any, Optional

from data.config import (
    ARTIFACTS_DIR,
    SUPPORTED_CATEGORIES,
    CATEGORY_DISPLAY_NAMES,
    MINIMUM_FEATURE_WINDOW_SIZE,
    INTERNAL_CATEGORY_FRIDGE,
    INTERNAL_CATEGORY_LIGHTING,
    INTERNAL_CATEGORY_OTHER,
    INTERNAL_CATEGORY_AC_HVAC,
    INTERNAL_CATEGORY_WATER_HEATER,
)
from model.features import extract_features, FEATURE_COLUMNS

# Deployed classification decision thresholds derived from GroupKFold threshold sweeps (V3 & V4)
DECISION_THRESHOLDS = {
    INTERNAL_CATEGORY_FRIDGE: 0.40,
    INTERNAL_CATEGORY_LIGHTING: 0.15,  # Deployed from V3 threshold sweep (improves recall from 26.7% to 91.6%)
    INTERNAL_CATEGORY_AC_HVAC: 0.40,   # Deployed from V4 threshold sweep (optimal F1 balance)
    INTERNAL_CATEGORY_OTHER: 0.35,
}

def get_model_score_label(score: float, not_yet_trained: bool) -> str:
    """
    Translates numeric model score (0.0 - 1.0) into explicit label:
    - High: >= 0.70
    - Medium: 0.40 - 0.70
    - Low: < 0.40
    - N/A: Not yet trained
    """
    if not_yet_trained:
        return "N/A"
    if score >= 0.70:
        return "High"
    elif score >= 0.40:
        return "Medium"
    else:
        return "Low"


class ApplianceDisaggregator:
    def __init__(self, artifacts_dir: Path = ARTIFACTS_DIR):
        self.artifacts_dir = artifacts_dir
        self.models: Dict[str, Any] = {}
        self.metadata: Dict[str, Any] = {}
        self.trained_categories: List[str] = []
        self._load_artifacts()

    def _load_artifacts(self):
        metadata_path = self.artifacts_dir / "metadata.json"
        if metadata_path.exists():
            with open(metadata_path, "r") as f:
                self.metadata = json.load(f)
            self.trained_categories = self.metadata.get("trained_categories", [])
        else:
            self.trained_categories = [
                INTERNAL_CATEGORY_FRIDGE,
                INTERNAL_CATEGORY_LIGHTING,
                INTERNAL_CATEGORY_OTHER,
                INTERNAL_CATEGORY_AC_HVAC,
            ]

        for cat in self.trained_categories:
            model_path = self.artifacts_dir / f"{cat}_model.joblib"
            if model_path.exists():
                self.models[cat] = joblib.load(model_path)
            else:
                print(f"[predict.py] Warning: Expected model file {model_path} not found.")

    def predict(self, input_df: pd.DataFrame, power_column: str = "mains_power", timestamp_column: str = "timestamp") -> Dict[str, Any]:
        """
        Takes raw aggregate power time series and integrates appliance power over the entire reading window to compute kWh.
        Enforces deployed decision thresholds and unattributed baseline accounting (V1 & V3).

        Requires minimum input window of MINIMUM_FEATURE_WINDOW_SIZE (15) contiguous readings.
        """
        if len(input_df) < MINIMUM_FEATURE_WINDOW_SIZE:
            raise ValueError(
                f"Input window size ({len(input_df)}) is smaller than required minimum "
                f"window size ({MINIMUM_FEATURE_WINDOW_SIZE} 1-minute readings) needed for 15-minute rolling statistics."
            )

        features_df = extract_features(input_df, power_column=power_column, timestamp_column=timestamp_column)
        n_readings = len(input_df)

        mains_power_series = input_df[power_column].astype(float).values
        total_mains_kwh = float(np.sum(mains_power_series * (1.0 / 60.0) / 1000.0))

        cat_powers_per_step = {cat: np.zeros(n_readings) for cat in SUPPORTED_CATEGORIES}
        cat_scores = {}

        for cat in SUPPORTED_CATEGORIES:
            if cat in self.models:
                model = self.models[cat]
                probas = model.predict_proba(features_df)
                if len(model.classes_) > 1 and 1 in model.classes_:
                    idx_on = int(np.where(model.classes_ == 1)[0][0])
                    on_probs = probas[:, idx_on]
                else:
                    on_probs = probas[:, 0]

                thresh = DECISION_THRESHOLDS.get(cat, 0.50)
                # Binary state active if probability meets deployed decision threshold
                active_mask = (on_probs >= thresh).astype(float)

                latest_prob = float(on_probs[-1])
                score = round(max(latest_prob, 1.0 - latest_prob), 4)
                cat_scores[cat] = score

                if cat == INTERNAL_CATEGORY_FRIDGE:
                    cat_powers_per_step[cat] = 100.0 * active_mask
                elif cat == INTERNAL_CATEGORY_LIGHTING:
                    cat_powers_per_step[cat] = 15.0 * active_mask
                elif cat == INTERNAL_CATEGORY_AC_HVAC:
                    cat_powers_per_step[cat] = 1600.0 * active_mask
                elif cat == INTERNAL_CATEGORY_OTHER:
                    other_p = mains_power_series - (cat_powers_per_step[INTERNAL_CATEGORY_FRIDGE] + cat_powers_per_step[INTERNAL_CATEGORY_LIGHTING] + cat_powers_per_step[INTERNAL_CATEGORY_AC_HVAC])
                    cat_powers_per_step[cat] = np.maximum(0.0, other_p) * active_mask
            else:
                cat_scores[cat] = 0.0

        cat_kwh_dict = {}
        total_appliance_kwh = 0.0
        for cat in SUPPORTED_CATEGORIES:
            if cat in self.models:
                kwh = float(np.sum(cat_powers_per_step[cat] * (1.0 / 60.0) / 1000.0))
                cat_kwh_dict[cat] = kwh
                total_appliance_kwh += kwh
            else:
                cat_kwh_dict[cat] = 0.0

        appliance_breakdown = []
        for cat in SUPPORTED_CATEGORIES:
            display_name = CATEGORY_DISPLAY_NAMES.get(cat, cat.capitalize())
            is_trained = cat in self.models
            not_yet_trained = not is_trained

            if is_trained:
                score = cat_scores[cat]
                score_label = get_model_score_label(score, not_yet_trained=False)
                cat_kwh = round(cat_kwh_dict[cat], 4)
                share = round((cat_kwh / total_mains_kwh * 100.0), 2) if total_mains_kwh > 0 else 0.0
            else:
                score = 0.0
                score_label = "N/A"
                cat_kwh = 0.0
                share = 0.0

            appliance_breakdown.append({
                "category": display_name,
                "internal_category": cat,
                "display_name": display_name,
                "consumption_kwh": cat_kwh,
                "share_percent": share,
                "model_score": score,
                "model_score_label": score_label,
                "not_yet_trained": not_yet_trained,
            })

        # V1 FIX: Explicit unattributed / baseline consumption accounting so shares sum to 100% of total mains consumption
        unattributed_kwh = max(0.0, total_mains_kwh - total_appliance_kwh)
        unattributed_share = round((unattributed_kwh / total_mains_kwh * 100.0), 2) if total_mains_kwh > 0 else 0.0

        appliance_breakdown.append({
            "category": "Unattributed / baseline",
            "internal_category": "unattributed",
            "display_name": "Unattributed / baseline",
            "consumption_kwh": round(unattributed_kwh, 4),
            "share_percent": unattributed_share,
            "model_score": 1.0,
            "model_score_label": "High",
            "not_yet_trained": False,
        })

        latest_row = input_df.iloc[-1]
        return {
            "timestamp": str(latest_row[timestamp_column]),
            "duration_minutes": n_readings,
            "total_consumption_kwh": round(total_mains_kwh, 4),
            "appliance_breakdown": appliance_breakdown,
            "simulated": False,
        }


# Singleton predictor instance
disaggregator = ApplianceDisaggregator()

def predict_disaggregation(input_df: pd.DataFrame) -> Dict[str, Any]:
    return disaggregator.predict(input_df)


if __name__ == "__main__":
    dates = pd.date_range("2023-01-01 12:00:00", periods=20, freq="min", tz="UTC")
    dummy_input = pd.DataFrame({
        "timestamp": dates,
        "mains_power": [200.0] * 20
    })
    res = predict_disaggregation(dummy_input)
    print("Updated Prediction Result with Unattributed Accounting:")
    print(json.dumps(res, indent=2))
