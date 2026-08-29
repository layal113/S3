import os
import sys
import json
import pandas as pd
import numpy as np
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from simulator.generate_household import generate_synthetic_household
from model.features import extract_features
from model.predict import ApplianceDisaggregator, DECISION_THRESHOLDS, get_model_score_label
from api.schemas import ApplianceBreakdownItem, BreakdownResponse
from api.main import (
    compute_dynamic_recommendation,
    project_breakdown_to_month,
    calculate_tariff_status,
    get_dashboard,
    app
)
from fastapi.testclient import TestClient

def run_trace():
    print("================================================================================")
    print("STEP 1: GENERATE SYNTHETIC HOUSEHOLD (high-ac-home, 60 minutes)")
    print("================================================================================")
    df_raw = generate_synthetic_household("high-ac-home", duration_minutes=60, interval_seconds=60)
    print(f"Raw DataFrame shape: {df_raw.shape}")
    print("\nFirst 5 rows of ground truth simulation:")
    print(df_raw[["timestamp", "mains_power", "fridge", "lighting", "ac_hvac", "other"]].head())

    # Ground truth total energy in kWh over the 60 min window
    gt_mains_kwh = (df_raw["mains_power"].sum() * (1/60)) / 1000.0
    gt_fridge_kwh = (df_raw["fridge"].sum() * (1/60)) / 1000.0
    gt_lighting_kwh = (df_raw["lighting"].sum() * (1/60)) / 1000.0
    gt_ac_kwh = (df_raw["ac_hvac"].sum() * (1/60)) / 1000.0
    gt_other_kwh = (df_raw["other"].sum() * (1/60)) / 1000.0

    print("\n--- Ground Truth Injected Consumption (60-min window) ---")
    print(f"  Mains Total:       {gt_mains_kwh:.4f} kWh (100.0%)")
    print(f"  AC/HVAC:           {gt_ac_kwh:.4f} kWh ({(gt_ac_kwh/gt_mains_kwh)*100:.1f}%)")
    print(f"  Fridge:            {gt_fridge_kwh:.4f} kWh ({(gt_fridge_kwh/gt_mains_kwh)*100:.1f}%)")
    print(f"  Lighting:          {gt_lighting_kwh:.4f} kWh ({(gt_lighting_kwh/gt_mains_kwh)*100:.1f}%)")
    print(f"  Other Spikes:      {gt_other_kwh:.4f} kWh ({(gt_other_kwh/gt_mains_kwh)*100:.1f}%)")

    print("\n================================================================================")
    print("STEP 2: FEATURE ENGINEERING (features.py)")
    print("================================================================================")
    df_feat = extract_features(df_raw)
    print(f"Feature DataFrame shape: {df_feat.shape}")
    print("\nFeature statistical summary:")
    print(df_feat.describe().round(2).to_string())

    print("\n================================================================================")
    print("STEP 3: ML INFERENCE & DISAGGREGATION (predict.py)")
    print("================================================================================")
    disaggregator = ApplianceDisaggregator()
    pred_result = disaggregator.predict(df_raw)
    
    print(f"Disaggregated Total Output kWh: {pred_result['total_consumption_kwh']:.4f} kWh")
    
    breakdown_items = [
        ApplianceBreakdownItem.model_validate(item)
        for item in pred_result["appliance_breakdown"]
    ]

    print("\nPredicted Category Breakdown:")
    for item in breakdown_items:
        print(f"  {item.display_name:<25}: {item.consumption_kwh:8.4f} kWh | {item.share_percent:6.2f}% | Score: {item.model_score:.4f} ({item.model_score_label}) | Untrained: {item.not_yet_trained}")

    print("\n================================================================================")
    print("STEP 4: DYNAMIC RECOMMENDATION & TARIFF LOGIC (api/main.py)")
    print("================================================================================")
    recommendation = compute_dynamic_recommendation(breakdown_items, duration_minutes=60)
    print(f"Recommendation Title:       {recommendation.title}")
    print(f"Recommendation Description: {recommendation.description}")
    print(f"Est Monthly Saving:         {recommendation.estimated_monthly_saving_kwh} kWh")

    breakdown_obj = BreakdownResponse(
        timestamp=df_raw["timestamp"].iloc[-1],
        duration_minutes=60,
        total_consumption_kwh=pred_result["total_consumption_kwh"],
        appliance_breakdown=breakdown_items,
        simulated=True
    )
    month_projections = project_breakdown_to_month(breakdown_obj)
    print("\nMonthly Billing Projections:")
    for k, v in month_projections.items():
        print(f"  {k:<35}: {v}")

    tariff_status = calculate_tariff_status(
        current_kwh=month_projections["current_kwh"],
        projected_month_kwh=month_projections["projected_kwh"]
    )
    print("\nTariff Status:")
    print(f"  Current Tier:       Tier {tariff_status.current_tier}")
    print(f"  Next Tier:          Tier {tariff_status.next_tier}")
    print(f"  Status Label:       {tariff_status.status_label}")
    print(f"  Detail:             {tariff_status.detail}")
    print(f"  Remaining kWh:      {tariff_status.remaining_kwh} kWh")
    print(f"  Projected to exceed:{tariff_status.projected_to_exceed}")

    print("\n================================================================================")
    print("STEP 5: FULL DASHBOARD ENDPOINT RESPONSE (GET /v1/households/high-ac-home/dashboard)")
    print("================================================================================")
    client = TestClient(app)
    res_dash = client.get("/v1/households/high-ac-home/dashboard")
    dash_data = res_dash.json()
    print(json.dumps(dash_data, indent=2))

    print("\n================================================================================")
    print("STEP 6: COMPARATIVE TRACE (efficient-flat / low AC, 60 minutes)")
    print("================================================================================")
    df_eff = generate_synthetic_household("efficient-flat", duration_minutes=60, interval_seconds=60)
    pred_eff = disaggregator.predict(df_eff)
    items_eff = [ApplianceBreakdownItem.model_validate(i) for i in pred_eff["appliance_breakdown"]]
    rec_eff = compute_dynamic_recommendation(items_eff, duration_minutes=60)
    print("Efficient Flat Predicted Breakdown:")
    for item in items_eff:
        print(f"  {item.display_name:<25}: {item.consumption_kwh:8.4f} kWh | {item.share_percent:6.2f}% | Score: {item.model_score:.4f} ({item.model_score_label})")
    print(f"\nEfficient Flat Recommendation: {rec_eff.title}")
    print(f"Description:                   {rec_eff.description}")
    print(f"Saving:                        {rec_eff.estimated_monthly_saving_kwh} kWh")

if __name__ == "__main__":
    run_trace()
