import os
import json
import joblib
import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GroupKFold
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

from data.config import (
    ARTIFACTS_DIR,
    APPLIANCE_ON_THRESHOLD_W,
    SUPPORTED_CATEGORIES,
    INTERNAL_CATEGORY_FRIDGE,
    INTERNAL_CATEGORY_LIGHTING,
    INTERNAL_CATEGORY_OTHER,
    INTERNAL_CATEGORY_WATER_HEATER,
    INTERNAL_CATEGORY_AC_HVAC,
)
from data.loader import load_active_datasets
from model.features import extract_features, FEATURE_COLUMNS


def train_models():
    """
    Trains binary RandomForestClassifiers for appliance disaggregation.
    Uses GroupKFold by house_id across all 5 UK-DALE houses.
    Handles class imbalance using class_weight='balanced'.
    Saves model artifacts and metadata.json.
    """
    print("=" * 70)
    print("STARTING MODEL TRAINING PIPELINE")
    print("=" * 70)

    # 1. Load active dataset
    df, total_excluded_gaps = load_active_datasets()
    print(f"Data loading complete. Excluded gap rows during preprocessing: {total_excluded_gaps}")

    # Note dataset sample size limitation explicitly
    sample_notice = (
        "Dataset Notice: Trained on a 1,000-row sample of UK-DALE dataset across 5 houses. "
        "Results reflect sample demonstration scale."
    )
    print(f"\n[NOTICE] {sample_notice}\n")

    # 2. Shared feature engineering
    X_features = extract_features(df, power_column="mains_power", timestamp_column="timestamp")
    groups = df["house_id"].values
    houses = np.unique(groups)
    print(f"Houses present in dataset ({len(houses)}): {list(houses)}")

    # Determine present categories in dataset
    present_categories = set(df["appliance_category"].unique())
    # Exclude categories with no positive on-state samples (like water_heater / water in UK-DALE)
    valid_trainable_categories = []
    for cat in [INTERNAL_CATEGORY_FRIDGE, INTERNAL_CATEGORY_LIGHTING, INTERNAL_CATEGORY_OTHER, INTERNAL_CATEGORY_AC_HVAC]:
        if cat in present_categories:
            valid_trainable_categories.append(cat)

    print(f"Trainable appliance categories detected: {valid_trainable_categories}")
    print(f"Untrained categories (absent/unsupported): {[c for c in SUPPORTED_CATEGORIES if c not in valid_trainable_categories]}\n")

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    metadata = {
        "dataset_sample_notice": sample_notice,
        "sample_size_rows": len(df),
        "excluded_gap_rows": total_excluded_gaps,
        "houses": [str(h) for h in houses],
        "feature_columns": FEATURE_COLUMNS,
        "trained_categories": valid_trainable_categories,
        "untrained_categories": [c for c in SUPPORTED_CATEGORIES if c not in valid_trainable_categories],
        "metrics": {},
    }

    # 3. Train per-category models with house-based group cross-validation
    gkf = GroupKFold(n_splits=min(5, len(houses)))

    for category in valid_trainable_categories:
        print(f"--- Training Binary Classifier for Category: '{category}' ---")

        # Binary label: 1 if appliance power > ON threshold, else 0
        cat_mask = df["appliance_category"] == category
        cat_power = df["appliance_power"].where(cat_mask, 0.0)
        y = (cat_power > APPLIANCE_ON_THRESHOLD_W).astype(int).values

        acc_list, prec_list, rec_list, f1_list = [], [], [], []

        # Perform Group Cross-Validation by house_id
        for fold, (train_idx, test_idx) in enumerate(gkf.split(X_features, y, groups)):
            X_train, X_test = X_features.iloc[train_idx], X_features.iloc[test_idx]
            y_train, y_test = y[train_idx], y[test_idx]

            # Fit model with balanced class weight to handle imbalance
            clf = RandomForestClassifier(
                n_estimators=100,
                max_depth=8,
                random_state=42,
                class_weight="balanced",
            )
            clf.fit(X_train, y_train)
            y_pred = clf.predict(X_test)

            acc_list.append(accuracy_score(y_test, y_pred))
            prec_list.append(precision_score(y_test, y_pred, zero_division=0))
            rec_list.append(recall_score(y_test, y_pred, zero_division=0))
            f1_list.append(f1_score(y_test, y_pred, zero_division=0))

        # Train final model on full dataset
        final_model = RandomForestClassifier(
            n_estimators=100,
            max_depth=8,
            random_state=42,
            class_weight="balanced",
        )
        final_model.fit(X_features, y)

        model_filename = f"{category}_model.joblib"
        model_path = ARTIFACTS_DIR / model_filename
        joblib.dump(final_model, model_path)

        mean_acc = float(np.mean(acc_list))
        mean_prec = float(np.mean(prec_list))
        mean_rec = float(np.mean(rec_list))
        mean_f1 = float(np.mean(f1_list))

        metadata["metrics"][category] = {
            "accuracy": round(mean_acc, 4),
            "precision": round(mean_prec, 4),
            "recall": round(mean_rec, 4),
            "f1_score": round(mean_f1, 4),
            "positive_class_ratio": round(float(y.mean()), 4),
        }

        print(f"Saved model to: {model_path}")
        print(f"House Group CV Metrics -> Accuracy: {mean_acc:.4f} | Precision: {mean_prec:.4f} | Recall: {mean_rec:.4f} | F1: {mean_f1:.4f}\n")

    # Save metadata.json
    metadata_path = ARTIFACTS_DIR / "metadata.json"
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"Saved training metadata to: {metadata_path}")
    print("=" * 70)
    print("MODEL TRAINING SUCCESSFULLY COMPLETED")
    print("=" * 70)


if __name__ == "__main__":
    train_models()
