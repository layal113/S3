from fastapi import FastAPI, HTTPException, Query, Body, status
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from datetime import datetime
from typing import Optional, List, Dict, Any

from api.schemas import (
    SimulateUsageRequest,
    SimulateUsageResponse,
    SimulatedReading,
    BreakdownRequest,
    BreakdownResponse,
    ApplianceBreakdownItem,
    RecommendationResponse,
    DashboardResponse,
    PriorityInsight,
    TariffStatus,
    UsageHistoryResponse,
    HistoryPoint,
    HistoryPointAppliance,
)
from simulator.generate_household import generate_synthetic_household
from model.predict import predict_disaggregation
from data.config import MINIMUM_FEATURE_WINDOW_SIZE, CATEGORY_DISPLAY_NAMES

app = FastAPI(
    title="Miqyas Appliance Disaggregation ML API",
    description="FastAPI backend serving trained appliance-disaggregation ML model and household signal simulator.",
    version="1.0.0",
)

# Configure CORS for Expo dev servers, Android Emulator (10.0.2.2), and local LAN IPs
origins = [
    "http://localhost:8081",
    "http://localhost:19006",
    "http://localhost:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8081",
    "http://127.0.0.1:8000",
    "http://10.0.2.2:8000",
    "http://10.0.2.2:8081",
    "*",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Miqyas ML Disaggregation API",
        "version": "1.0.0",
        "docs": "/docs",
    }


def compute_dynamic_recommendation(breakdown_items: List[ApplianceBreakdownItem], duration_minutes: int) -> RecommendationResponse:
    """
    Traceable calculation path from detected breakdown consumption to recommended monthly saving:
    1. Identifies the highest active consuming appliance category from detected breakdown.
    2. Scales window consumption (kWh) to daily consumption (x 1440 / duration_minutes).
    3. Projects monthly baseline consumption (daily_kwh * 30 days).
    4. Calculates 25% potential savings factor (round(monthly_kwh * 0.25, 1)).
    """
    # Exclude Other/unclassified if specific appliances exist
    specific_items = [item for item in breakdown_items if item.internal_category != "other" and not item.not_yet_trained and item.consumption_kwh > 0]
    target_item = max(specific_items, key=lambda x: x.consumption_kwh) if specific_items else (
        max(breakdown_items, key=lambda x: x.consumption_kwh) if breakdown_items else None
    )

    if not target_item or target_item.consumption_kwh == 0:
        return RecommendationResponse(
            title="Keep standby usage low overnight",
            description="Switch off entertainment devices and unused appliances at the socket overnight to save baseline standby power.",
            estimated_monthly_saving_kwh=12.5,
        )

    cat = target_item.internal_category
    daily_kwh = (target_item.consumption_kwh / max(1, duration_minutes)) * 1440.0
    monthly_kwh = daily_kwh * 30.0
    saving_kwh = round(monthly_kwh * 0.25, 1)
    if saving_kwh <= 0:
        saving_kwh = 15.0

    if cat == "ac_hvac":
        title = "Optimize Air Conditioner runtime & set thermostat to 24°C"
        desc = f"Air Conditioning represents your highest active load ({target_item.share_percent}% of usage). Raising thermostat by 1-2°C can save up to {saving_kwh} kWh per month."
    elif cat == "fridge":
        title = "Optimize Refrigerator cooling temperature"
        desc = f"Refrigerator represents your primary continuous baseline load ({target_item.share_percent}% of usage). Maintaining efficient door seals and cooling settings can save up to {saving_kwh} kWh per month."
    elif cat == "lighting":
        title = "Upgrade to LED lighting & turn off unused lights"
        desc = f"Lighting accounts for {target_item.share_percent}% of active consumption. Replacing halogen bulbs with LEDs can save up to {saving_kwh} kWh per month."
    else:
        title = f"Reduce peak {target_item.display_name} consumption"
        desc = f"{target_item.display_name} accounts for {target_item.share_percent}% of active energy draw. Optimizing daily usage hours can save up to {saving_kwh} kWh per month."

    return RecommendationResponse(
        title=title,
        description=desc,
        estimated_monthly_saving_kwh=saving_kwh,
    )


# =====================================================================
# 1. STANDALONE MODEL UTILITY ENDPOINTS
# =====================================================================

@app.post("/simulate-usage", response_model=SimulateUsageResponse)
def simulate_usage(request: SimulateUsageRequest = Body(...)):
    """
    Generates synthetic aggregate power signal for a fake household.
    """
    df = generate_synthetic_household(
        household_id=request.household_id or "high-ac-home",
        duration_minutes=request.duration_minutes or 60,
        interval_seconds=request.interval_seconds or 60,
    )

    readings = []
    for _, row in df.iterrows():
        readings.append(
            SimulatedReading(
                timestamp=row["timestamp"],
                mains_power=float(row["mains_power"]),
                appliances={
                    "fridge": float(row["fridge"]),
                    "lighting": float(row["lighting"]),
                    "ac_hvac": float(row.get("ac_hvac", 0.0)),
                    "other": float(row["other"]),
                },
            )
        )

    return SimulateUsageResponse(
        household_id=request.household_id or "high-ac-home",
        timestamp_start=df.iloc[0]["timestamp"],
        timestamp_end=df.iloc[-1]["timestamp"],
        reading_count=len(readings),
        readings=readings,
    )


@app.post("/get-breakdown", response_model=BreakdownResponse)
def get_breakdown(request: BreakdownRequest):
    """
    Takes raw aggregate power time series input (minimum 15 readings) and returns model disaggregation breakdown with integrated kWh values.
    """
    if len(request.readings) < MINIMUM_FEATURE_WINDOW_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Input window size ({len(request.readings)}) is smaller than required minimum "
                f"window size ({MINIMUM_FEATURE_WINDOW_SIZE} 1-minute readings) for 15-minute rolling feature extraction."
            ),
        )

    rows = []
    for r in request.readings:
        p_val = r.get("mains_power") if r.get("mains_power") is not None else r.get("mainsPower")
        if p_val is None:
            p_val = r.get("aggregate_power_w") if r.get("aggregate_power_w") is not None else r.get("power_w", 0.0)
        rows.append({
            "timestamp": r.get("timestamp"),
            "mains_power": float(p_val)
        })
    df_input = pd.DataFrame(rows)

    try:
        res = predict_disaggregation(df_input)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))

    items = [ApplianceBreakdownItem(**item) for item in res["appliance_breakdown"]]

    return BreakdownResponse(
        timestamp=res["timestamp"],
        duration_minutes=res["duration_minutes"],
        total_consumption_kwh=res["total_consumption_kwh"],
        appliance_breakdown=items,
        simulated=False,
    )


@app.get("/get-breakdown", response_model=BreakdownResponse)
def get_breakdown_demo(household_id: str = "high-ac-home"):
    """
    GET fallback for /get-breakdown: generates synthetic 20-minute window for household and runs real ML inference.
    """
    df_sim = generate_synthetic_household(household_id=household_id, duration_minutes=20)
    res = predict_disaggregation(df_sim)
    items = [ApplianceBreakdownItem(**item) for item in res["appliance_breakdown"]]

    return BreakdownResponse(
        timestamp=res["timestamp"],
        duration_minutes=res["duration_minutes"],
        total_consumption_kwh=res["total_consumption_kwh"],
        appliance_breakdown=items,
        simulated=True,
    )


@app.get("/get-recommendation", response_model=RecommendationResponse)
@app.post("/get-recommendation", response_model=RecommendationResponse)
def get_recommendation():
    """
    Calculates dynamic recommendation derived from active disaggregation breakdown.
    """
    demo_breakdown = get_breakdown_demo("high-ac-home")
    return compute_dynamic_recommendation(demo_breakdown.appliance_breakdown, demo_breakdown.duration_minutes)


# =====================================================================
# 2. REST API CLIENT ENDPOINTS (Matching src/config/apiEndpoints.ts)
# =====================================================================

@app.get("/v1/households")
def get_households():
    return [
        {"id": "high-ac-home", "name": "Ahmed’s Home"},
        {"id": "efficient-flat", "name": "Nour’s Flat"},
        {"id": "family-villa", "name": "Family Villa"},
    ]


@app.get("/v1/households/{household_id}/appliances/usage", response_model=BreakdownResponse)
def get_household_appliance_usage(household_id: str):
    return get_breakdown_demo(household_id=household_id)


@app.get("/v1/households/{household_id}/recommendations", response_model=RecommendationResponse)
def get_household_recommendations(household_id: str):
    demo_breakdown = get_breakdown_demo(household_id=household_id)
    return compute_dynamic_recommendation(demo_breakdown.appliance_breakdown, demo_breakdown.duration_minutes)


@app.get("/v1/households/{household_id}/dashboard", response_model=DashboardResponse)
def get_dashboard(household_id: str):
    """
    Combined server-side response aggregating breakdown, dynamic recommendation, tariff status, and bill metrics.
    """
    breakdown_data = get_breakdown_demo(household_id=household_id)
    rec_data = compute_dynamic_recommendation(breakdown_data.appliance_breakdown, breakdown_data.duration_minutes)

    return DashboardResponse(
        household_id=household_id,
        household_name=f"{household_id.replace('-', ' ').title()}",
        billing_period_label="1–31 August 2026",
        current_consumption_kwh=382.0,
        current_estimated_cost_egp=820.0,
        predicted_month_end_bill_egp=1430.0,
        projected_monthly_kwh=545.0,
        previous_month_bill_egp=1222.0,
        change_from_previous_month_percent=17.0,
        priority_insight=PriorityInsight(
            kind="warning",
            title=rec_data.title,
            message=rec_data.description,
        ),
        tariff_status=TariffStatus(
            current_tier=4,
            next_tier=5,
            status_label="Approaching next tier",
            detail="68 kWh remaining before the next simulated tariff tier.",
            level_percent=85.0,
            remaining_kwh=68.0,
            projected_to_exceed=False,
        ),
        appliance_breakdown=breakdown_data.appliance_breakdown,
        recommendation=rec_data,
        simulated=True,
        updated_at=datetime.utcnow().isoformat() + "Z",
    )


@app.get("/v1/households/{household_id}/usage/history", response_model=UsageHistoryResponse)
def get_usage_history(household_id: str, period: str = Query("7d")):
    """
    Aggregated usage history time series matching UsageHistoryData contract.
    """
    dates = ["2026-08-16", "2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21", "2026-08-22"]
    points = []

    for d in dates:
        kwh = 16.0
        cost = kwh * 2.15
        points.append(
            HistoryPoint(
                timestamp=d,
                totalKWh=kwh,
                estimatedCostEGP=cost,
                baselineKWh=15.0,
                baselineCostEGP=15.0 * 2.15,
                appliances={
                    "airConditioner": {"kWh": kwh * 0.40 if household_id == "high-ac-home" else 0.0, "costEGP": cost * 0.40 if household_id == "high-ac-home" else 0.0},
                    "waterHeater": {"kWh": 0.0, "costEGP": 0.0},
                    "refrigerator": {"kWh": kwh * 0.20, "costEGP": cost * 0.20},
                    "lighting": {"kWh": kwh * 0.15, "costEGP": cost * 0.15},
                    "other": {"kWh": kwh * 0.25, "costEGP": cost * 0.25},
                },
            )
        )

    return UsageHistoryResponse(
        period="7d" if period == "7d" else "4w",
        granularity="day",
        date_range_label="16–22 August 2026",
        points=points,
    )
