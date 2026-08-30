import os
import sys
import pandas as pd
import numpy as np
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from simulator.generate_household import generate_synthetic_household
from model.features import extract_features
from model.predict import ApplianceDisaggregator

df_raw = generate_synthetic_household("high-ac-home", duration_minutes=60, interval_seconds=60)
df_feat = extract_features(df_raw)

disaggregator = ApplianceDisaggregator()
ac_model = disaggregator.models["ac_hvac"]
probas = ac_model.predict_proba(df_feat)

high_mains_idx = np.where(df_raw["mains_power"] > 1500)[0]
print(f"Number of high mains rows (>1500W): {len(high_mains_idx)} out of {len(df_raw)}")
for idx in high_mains_idx[:10]:
    print(f"Row {idx:02d}: Mains={df_raw['mains_power'].iloc[idx]:.1f}W, GroundTruth AC={df_raw['ac_hvac'].iloc[idx]:.1f}W")
    print(f"   Features: power_w={df_feat['power_w'].iloc[idx]:.1f}, delta={df_feat['power_delta'].iloc[idx]:.1f}, mean5={df_feat['rolling_mean_5m'].iloc[idx]:.1f}, mean15={df_feat['rolling_mean_15m'].iloc[idx]:.1f}, hour={df_feat['hour_of_day'].iloc[idx]}")
    print(f"   AC Proba (off, on): {probas[idx]}")
