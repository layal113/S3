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


def get_confidence_label(score: float, not_yet_trained: bool) -> str:
    """
    Translates numeric confidence score (0.0 - 1.0) into explicit confidence label:
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
            # Fallback default if metadata does not exist
            self.trained_categories = [
                INTERNAL_CATEGORY_FRIDGE,
                INTERNAL_CATEGORY_LIGHTING,
                INTERNAL_CATEGORY_OTHER,
            ]

        for cat in self.trained_categories:
            model_path = self.artifacts_dir / f"{cat}_model.joblib"
            if model_path.exists():
                self.models[cat] = joblib.load(model_path)
            else:
                print(f"[predict.py] Warning: Expected model file {model_path} not found.")

    def predict(self, input_df: pd.DataFrame, power_column: str = "mains_power", timestamp_column: str = "timestamp") -> Dict[str, Any]:
        """
        Takes raw aggregate power time series and returns per-appliance predictions.

        Requires minimum input window of MINIMUM_FEATURE_WINDOW_SIZE (15) contiguous readings.
        """
        if len(input_df) < MINIMUM_FEATURE_WINDOW_SIZE:
            raise ValueError(
                f"Input window size ({len(input_df)}) is smaller than required minimum "
                f"window size ({MINIMUM_FEATURE_WINDOW_SIZE} 1-minute readings) needed for 15-minute rolling statistics."
            )

        # 1. Run through identical shared feature engineering pipeline
        features_df = extract_features(input_df, power_column=power_column, timestamp_column=timestamp_column)

        # Use the latest (most recent) window timestamp/reading for prediction snapshot
        latest_features = features_df.iloc[[-1]]
        latest_row = input_df.iloc[-1]
        latest_mains_power = float(latest_row[power_column])

        results = []
        raw_powers = {}
        total_estimated_power_w = 0.0

        for cat in SUPPORTED_CATEGORIES:
            display_name = CATEGORY_DISPLAY_NAMES.get(cat, cat.capitalize())

            if cat in self.models:
                model = self.models[cat]
                # Probability of appliance ON (class 1)
                proba = model.predict_proba(latest_features)[0]
                on_prob = float(proba[1]) if len(proba) > 1 else float(proba[0])

                # Heuristic power estimation based on aggregate power & state probability
                if cat == INTERNAL_CATEGORY_FRIDGE:
                    est_power = 100.0 * on_prob if on_prob > 0.4 else 0.0
                elif cat == INTERNAL_CATEGORY_LIGHTING:
                    est_power = 120.0 * on_prob if on_prob > 0.4 else 0.0
                else:  # other
                    est_power = max(0.0, latest_mains_power - 220.0) * on_prob if on_prob > 0.4 else 0.0

                raw_powers[cat] = est_power
                total_estimated_power_w += est_power
            else:
                raw_powers[cat] = 0.0

        # Calculate consumption kWh (over window duration) and share percentages
        duration_hours = len(input_df) / 60.0
        total_kwh = (latest_mains_power * duration_hours) / 1000.0

        appliance_breakdown = []
        for cat in SUPPORTED_CATEGORIES:
            display_name = CATEGORY_DISPLAY_NAMES.get(cat, cat.capitalize())
            is_trained = cat in self.models
            not_yet_trained = not is_trained

            if is_trained:
                model = self.models[cat]
                proba = model.predict_proba(latest_features)[0]
                prob_on = float(proba[1]) if len(proba) > 1 else float(proba[0])
                confidence_score = round(max(prob_on, 1.0 - prob_on), 4)
                conf_label = get_confidence_label(confidence_score, not_yet_trained=False)

                cat_power = raw_powers[cat]
                cat_kwh = round((cat_power * duration_hours) / 1000.0, 4)
                share = round((cat_power / total_estimated_power_w * 100.0), 2) if total_estimated_power_w > 0 else 0.0
            else:
                confidence_score = 0.0
                conf_label = "N/A"
                cat_kwh = 0.0
                share = 0.0

            appliance_breakdown.append({
                "category": cat,
                "display_name": display_name,
                "consumption_kwh": cat_kwh,
                "share_percent": share,
                "confidence_score": confidence_score,
                "confidence_label": conf_label,
                "not_yet_trained": not_yet_trained,
            })

        return {
            "timestamp": str(latest_row[timestamp_column]),
            "duration_minutes": len(input_df),
            "total_consumption_kwh": round(total_kwh, 4),
            "appliance_breakdown": appliance_breakdown,
            "simulated": False,
        }


# Singleton predictor instance
disaggregator = ApplianceDisaggregator()

def predict_disaggregation(input_df: pd.DataFrame) -> Dict[str, Any]:
    return disaggregator.predict(input_df)


if __name__ == "__main__":
    # Quick sanity test of predict pipeline
    dates = pd.date_range("2023-01-01 12:00:00", periods=20, freq="min", tz="UTC")
    dummy_input = pd.DataFrame({
        "timestamp": dates,
        "mains_power": [300.0 + i * 5 for i in range(20)]
    })
    res = predict_disaggregation(dummy_input)
    print("Prediction Result:")
    print(json.dumps(res, indent=2))
