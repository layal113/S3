import os
import sys
import pandas as pd
import numpy as np
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from simulator.generate_household import generate_synthetic_household
from model.features import extract_features
from model.predict import ApplianceDisaggregator, DECISION_THRESHOLDS

df_raw = generate_synthetic_household("high-ac-home", duration_minutes=60, interval_seconds=60)
df_feat = extract_features(df_raw)

disaggregator = ApplianceDisaggregator()
ac_model = disaggregator.models["ac_hvac"]

print("AC Model Classes:", ac_model.classes_)
print("AC Feature Columns:", df_feat.columns.tolist())
probas = ac_model.predict_proba(df_feat)
print("Proba shape:", probas.shape)
print("First 10 probas (class 0, class 1):")
for i in range(10):
    print(f"Row {i}: Mains={df_raw['mains_power'].iloc[i]:.1f}W, GroundTruth AC={df_raw['ac_hvac'].iloc[i]:.1f}W -> Proba={probas[i]}")

print("\nMax class 1 proba across all 60 rows:", probas[:, 1].max() if probas.shape[1] > 1 else probas[:, 0].max())
print("Threshold:", DECISION_THRESHOLDS.get("ac_hvac"))
