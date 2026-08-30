import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GroupKFold
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

from data.loader import load_active_datasets
from model.features import extract_features
from data.config import APPLIANCE_ON_THRESHOLD_W, INTERNAL_CATEGORY_LIGHTING

def run_lighting_threshold_sweep():
    df, _ = load_active_datasets()
    X_features = extract_features(df, power_column="mains_power", timestamp_column="timestamp")
    groups = df["house_id"].values
    houses = np.unique(groups)

    cat_mask = df["appliance_category"] == INTERNAL_CATEGORY_LIGHTING
    cat_power = df["appliance_power"].where(cat_mask, 0.0)
    y = (cat_power > APPLIANCE_ON_THRESHOLD_W).astype(int).values

    gkf = GroupKFold(n_splits=min(5, len(houses)))

    thresholds = [0.50, 0.40, 0.30, 0.20, 0.15, 0.10]
    print(f"=== LIGHTING CLASSIFIER DECISION THRESHOLD SWEEP (House CV across {len(houses)} houses) ===")
    print(f"{'Threshold':<12} | {'Accuracy':<10} | {'Precision':<10} | {'Recall':<10} | {'F1 Score':<10}")
    print("-" * 65)

    for thresh in thresholds:
        acc_list, prec_list, rec_list, f1_list = [], [], [], []

        for train_idx, test_idx in gkf.split(X_features, y, groups):
            X_train, X_test = X_features.iloc[train_idx], X_features.iloc[test_idx]
            y_train, y_test = y[train_idx], y[test_idx]

            clf = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42, class_weight="balanced")
            clf.fit(X_train, y_train)

            probs = clf.predict_proba(X_test)[:, 1] if clf.classes_[1] == 1 else clf.predict_proba(X_test)[:, 0]
            preds = (probs >= thresh).astype(int)

            acc_list.append(accuracy_score(y_test, preds))
            prec_list.append(precision_score(y_test, preds, zero_division=0))
            rec_list.append(recall_score(y_test, preds, zero_division=0))
            f1_list.append(f1_score(y_test, preds, zero_division=0))

        print(f"{thresh:<12.2f} | {np.mean(acc_list):<10.4f} | {np.mean(prec_list):<10.4f} | {np.mean(rec_list):<10.4f} | {np.mean(f1_list):<10.4f}")

if __name__ == "__main__":
    run_lighting_threshold_sweep()
