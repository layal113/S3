import numpy as np
import pandas as pd
from sklearn.model_selection import GroupKFold

from data.loader import load_active_datasets
from model.features import extract_features
from data.config import APPLIANCE_ON_THRESHOLD_W, INTERNAL_CATEGORY_AC_HVAC

def inspect_ac_samples():
    df, _ = load_active_datasets()
    X_features = extract_features(df, power_column="mains_power", timestamp_column="timestamp")
    groups = df["house_id"].values
    houses = np.unique(groups)

    cat_mask = df["appliance_category"] == INTERNAL_CATEGORY_AC_HVAC
    cat_power = df["appliance_power"].where(cat_mask, 0.0)
    y = (cat_power > APPLIANCE_ON_THRESHOLD_W).astype(int).values

    print(f"Total dataset rows: {len(df)}")
    print(f"Total AC positive samples (ON > 10W): {y.sum()} / {len(y)} ({y.mean()*100:.2f}%)")
    print("\nSamples per House:")
    for h in houses:
        h_mask = (groups == h)
        y_h = y[h_mask]
        print(f"  {h:<15}: {len(y_h):<4} total rows | {y_h.sum():<3} positive AC samples")

    gkf = GroupKFold(n_splits=min(5, len(houses)))
    print("\nSamples per CV Fold:")
    for fold, (train_idx, test_idx) in enumerate(gkf.split(X_features, y, groups)):
        test_houses = np.unique(groups[test_idx])
        y_test = y[test_idx]
        print(f"  Fold {fold+1} (Test Houses: {list(test_houses)}): {len(y_test)} test rows | {y_test.sum()} positive test AC samples")

if __name__ == "__main__":
    inspect_ac_samples()
