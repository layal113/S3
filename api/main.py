import logging
import os
import time
import uuid
import calendar

from fastapi import FastAPI, HTTPException, Query, Body, Request, status
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

logging.basicConfig(
    level=os.getenv("MIQYAS_LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("miqyas.api")
DEBUG_BREAKPOINTS_ENABLED = os.getenv("MIQYAS_DEBUG_BREAKPOINTS") == "1"
ESTIMATED_EGP_PER_KWH = float(os.getenv("MIQYAS_EGP_PER_KWH", "2.15"))
TARIFF_THRESHOLDS_KWH = [50.0, 100.0, 200.0, 350.0, 650.0, 1000.0]
latest_breakdowns: Dict[str, BreakdownResponse] = {}
previous_projected_kwh: Dict[str, float] = {}


def debug_checkpoint(label: str, **context: Any) -> None:
    """Log a pipeline checkpoint and optionally enter pdb when explicitly enabled."""
    context_text = " ".join(f"{key}={value}" for key, value in context.items())
    logger.info("CHECKPOINT %s %s", label, context_text)
    if DEBUG_BREAKPOINTS_ENABLED:
        logger.warning("Debugger breakpoint reached: %s", label)
        breakpoint()


print(
    "[Miqyas API] Debug logging ready "
    f"(breakpoints={'enabled' if DEBUG_BREAKPOINTS_ENABLED else 'disabled'}).",
    flush=True,
)

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


@app.middleware("http")
async def log_http_request(request: Request, call_next):
    request_id = request.headers.get("x-request-id", uuid.uuid4().hex[:8])
    started_at = time.perf_counter()
    logger.info(
        "REQUEST id=%s method=%s path=%s client=%s",
        request_id,
        request.method,
        request.url.path,
        request.client.host if request.client else "unknown",
    )
    try:
        response = await call_next(request)
    except Exception:
        elapsed_ms = (time.perf_counter() - started_at) * 1000
        logger.exception(
            "RESPONSE id=%s status=500 duration_ms=%.1f",
            request_id,
            elapsed_ms,
        )
        raise

    elapsed_ms = (time.perf_counter() - started_at) * 1000
    response.headers["x-request-id"] = request_id
    logger.info(
        "RESPONSE id=%s status=%s duration_ms=%.1f",
        request_id,
        response.status_code,
        elapsed_ms,
    )
    return response


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

    Note: The 25% reduction factor (0.25) is a stated business heuristic for potential energy optimization savings, not an ML-inferred or empirical model measurement.
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


def project_breakdown_to_month(breakdown: BreakdownResponse) -> Dict[str, float]:
    """Scale the measured backend window to billing-period and month estimates."""
    now = datetime.utcnow()
    days_in_month = calendar.monthrange(now.year, now.month)[1]
    elapsed_days = max(1, now.day)
    measured_minutes = max(1, breakdown.duration_minutes)
    daily_kwh = breakdown.total_consumption_kwh * (1440.0 / measured_minutes)
    return {
        "current_kwh": round(daily_kwh * elapsed_days, 1),
        "projected_kwh": round(daily_kwh * days_in_month, 1),
        "days_in_month": float(days_in_month),
        "elapsed_days": float(elapsed_days),
    }


def calculate_tariff_status(current_kwh: float, projected_kwh: float) -> TariffStatus:
    current_tier = len(TARIFF_THRESHOLDS_KWH) + 1
    next_threshold = TARIFF_THRESHOLDS_KWH[-1] + 500.0
    for index, threshold in enumerate(TARIFF_THRESHOLDS_KWH):
        if current_kwh < threshold:
            current_tier = index + 1
            next_threshold = threshold
            break

    next_tier = current_tier + 1
    remaining_kwh = max(0.0, next_threshold - current_kwh)
    level_percent = min(100.0, (current_kwh / next_threshold) * 100.0)
    projected_to_exceed = projected_kwh >= next_threshold
    return TariffStatus(
        current_tier=current_tier,
        next_tier=next_tier,
        status_label=(
            "Projected to exceed next tier"
            if projected_to_exceed
            else "Within current tier"
        ),
        detail=f"{remaining_kwh:.1f} kWh remaining before the next tariff tier.",
        level_percent=round(level_percent, 1),
        remaining_kwh=round(remaining_kwh, 1),
        projected_to_exceed=projected_to_exceed,
    )


def remember_breakdown(household_id: str, breakdown: BreakdownResponse) -> None:
    existing = latest_breakdowns.get(household_id)
    if existing:
        previous_projected_kwh[household_id] = project_breakdown_to_month(existing)[
            "projected_kwh"
        ]
    latest_breakdowns[household_id] = breakdown
    debug_checkpoint(
        "breakdown.stored",
        household_id=household_id,
        total_kwh=breakdown.total_consumption_kwh,
    )


def get_latest_breakdown(household_id: str) -> BreakdownResponse:
    existing = latest_breakdowns.get(household_id)
    if existing:
        return existing

    logger.info("No stored readings for %s; generating initial backend window", household_id)
    generated = create_demo_breakdown(household_id)
    latest_breakdowns[household_id] = generated
    return generated


# =====================================================================
# 1. STANDALONE MODEL UTILITY ENDPOINTS
# =====================================================================

@app.post("/simulate-usage", response_model=SimulateUsageResponse)
def simulate_usage(request: SimulateUsageRequest = Body(...)):
    """
    Generates synthetic aggregate power signal for a fake household.
    """
    household_id = request.household_id or "high-ac-home"
    duration_minutes = request.duration_minutes or 60
    interval_seconds = request.interval_seconds or 60
    debug_checkpoint(
        "simulation.start",
        household_id=household_id,
        duration_minutes=duration_minutes,
        interval_seconds=interval_seconds,
    )
    df = generate_synthetic_household(
        household_id=household_id,
        duration_minutes=duration_minutes,
        interval_seconds=interval_seconds,
    )
    debug_checkpoint("simulation.generated", readings=len(df))

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

    response = SimulateUsageResponse(
        household_id=household_id,
        timestamp_start=df.iloc[0]["timestamp"],
        timestamp_end=df.iloc[-1]["timestamp"],
        reading_count=len(readings),
        readings=readings,
    )
    debug_checkpoint("simulation.complete", readings=len(readings))
    return response


@app.post("/get-breakdown", response_model=BreakdownResponse)
def get_breakdown(request: BreakdownRequest):
    """
    Takes raw aggregate power time series input (minimum 15 readings) and returns model disaggregation breakdown with integrated kWh values.
    """
    debug_checkpoint("breakdown.received", readings=len(request.readings))
    if len(request.readings) < MINIMUM_FEATURE_WINDOW_SIZE:
        logger.warning(
            "Breakdown rejected: readings=%s required=%s",
            len(request.readings),
            MINIMUM_FEATURE_WINDOW_SIZE,
        )
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
        debug_checkpoint("breakdown.model.start", rows=len(df_input))
        res = predict_disaggregation(df_input)
        debug_checkpoint(
            "breakdown.model.complete",
            categories=len(res["appliance_breakdown"]),
            total_kwh=res["total_consumption_kwh"],
        )
    except ValueError as err:
        logger.exception("Model input rejected")
        raise HTTPException(status_code=400, detail=str(err))

    items = [ApplianceBreakdownItem(**item) for item in res["appliance_breakdown"]]

    response = BreakdownResponse(
        timestamp=res["timestamp"],
        duration_minutes=res["duration_minutes"],
        total_consumption_kwh=res["total_consumption_kwh"],
        appliance_breakdown=items,
        simulated=False,
    )
    remember_breakdown(request.household_id or "high-ac-home", response)
    return response


def create_demo_breakdown(household_id: str) -> BreakdownResponse:
    """Create an initial backend measurement window when no reading was submitted yet."""
    debug_checkpoint("breakdown.demo.start", household_id=household_id)
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


@app.get("/get-breakdown", response_model=BreakdownResponse)
def get_breakdown_demo(household_id: str = "high-ac-home"):
    """Return the household's latest backend breakdown."""
    return get_latest_breakdown(household_id)


@app.get("/get-recommendation", response_model=RecommendationResponse)
@app.post("/get-recommendation", response_model=RecommendationResponse)
def get_recommendation(
    household_id: Optional[str] = Query(None),
    breakdown: Optional[BreakdownResponse] = Body(None),
):
    """
    Calculates dynamic recommendation derived from active disaggregation breakdown.
    """
    if breakdown and breakdown.appliance_breakdown:
        return compute_dynamic_recommendation(breakdown.appliance_breakdown, breakdown.duration_minutes)

    target_id = household_id or (list(latest_breakdowns.keys())[-1] if latest_breakdowns else "high-ac-home")
    demo_breakdown = get_latest_breakdown(target_id)
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
    return get_latest_breakdown(household_id)


@app.get("/v1/households/{household_id}/recommendations", response_model=RecommendationResponse)
def get_household_recommendations(household_id: str):
    demo_breakdown = get_breakdown_demo(household_id=household_id)
    return compute_dynamic_recommendation(demo_breakdown.appliance_breakdown, demo_breakdown.duration_minutes)


@app.get("/v1/households/{household_id}/dashboard", response_model=DashboardResponse)
def get_dashboard(household_id: str):
    """
    Combined server-side response aggregating breakdown, dynamic recommendation, tariff status, and bill metrics.
    """
    debug_checkpoint("dashboard.start", household_id=household_id)
    breakdown_data = get_latest_breakdown(household_id)
    projection = project_breakdown_to_month(breakdown_data)
    current_kwh = projection["current_kwh"]
    projected_kwh = projection["projected_kwh"]
    previous_kwh = previous_projected_kwh.get(household_id, projected_kwh)
    current_cost = round(current_kwh * ESTIMATED_EGP_PER_KWH, 1)
    predicted_bill = round(projected_kwh * ESTIMATED_EGP_PER_KWH, 1)
    previous_bill = round(previous_kwh * ESTIMATED_EGP_PER_KWH, 1)
    change_percent = (
        round(((projected_kwh - previous_kwh) / previous_kwh) * 100.0, 1)
        if previous_kwh > 0
        else 0.0
    )
    tariff_status = calculate_tariff_status(current_kwh, projected_kwh)
    billing_scale = (
        1440.0 / max(1, breakdown_data.duration_minutes)
    ) * projection["elapsed_days"]
    scaled_appliances = [
        item.model_copy(
            update={
                "consumption_kwh": round(item.consumption_kwh * billing_scale, 1)
            }
        )
        for item in breakdown_data.appliance_breakdown
    ]
    rec_data = compute_dynamic_recommendation(breakdown_data.appliance_breakdown, breakdown_data.duration_minutes)
    now = datetime.utcnow()
    household_names = {
        "high-ac-home": "Ahmed’s Home",
        "efficient-flat": "Nour’s Flat",
        "family-villa": "Family Villa",
    }

    response = DashboardResponse(
        household_id=household_id,
        household_name=household_names.get(
            household_id, household_id.replace("-", " ").title()
        ),
        billing_period_label=(
            f"1–{int(projection['days_in_month'])} {now.strftime('%B %Y')}"
        ),
        current_consumption_kwh=current_kwh,
        current_estimated_cost_egp=current_cost,
        predicted_month_end_bill_egp=predicted_bill,
        projected_monthly_kwh=projected_kwh,
        previous_month_bill_egp=previous_bill,
        change_from_previous_month_percent=change_percent,
        priority_insight=PriorityInsight(
            kind=("warning" if tariff_status.projected_to_exceed else "recommendation"),
            title=rec_data.title,
            message=rec_data.description,
        ),
        tariff_status=tariff_status,
        appliance_breakdown=scaled_appliances,
        recommendation=rec_data,
        simulated=breakdown_data.simulated,
        updated_at=now.isoformat() + "Z",
    )
    debug_checkpoint(
        "dashboard.complete",
        household_id=household_id,
        appliances=len(response.appliance_breakdown),
    )
    return response


@app.get("/v1/households/{household_id}/usage/history", response_model=UsageHistoryResponse)
def get_usage_history(household_id: str, period: str = Query("7d")):
    """
    Aggregated usage history time series matching UsageHistoryData contract.
    """
    if period == "6m":
        selected_period = "6m"
        granularity = "month"
        date_range_label = "March–August 2026"
        series = [
            ("2026-03-01", 318.0, 325.0),
            ("2026-04-01", 334.0, 330.0),
            ("2026-05-01", 371.0, 342.0),
            ("2026-06-01", 419.0, 360.0),
            ("2026-07-01", 492.0, 385.0),
            ("2026-08-01", 458.0, 410.0),
        ]
    elif period == "4w":
        selected_period = "4w"
        granularity = "week"
        date_range_label = "26 July–22 August 2026"
        series = [
            ("2026-07-26", 101.0, 98.0),
            ("2026-08-02", 108.0, 100.0),
            ("2026-08-09", 116.0, 102.0),
            ("2026-08-16", 124.0, 104.0),
        ]
    else:
        selected_period = "7d"
        granularity = "day"
        date_range_label = "16–22 August 2026"
        series = [
            ("2026-08-16", 15.2, 15.0),
            ("2026-08-17", 14.7, 15.0),
            ("2026-08-18", 16.1, 15.1),
            ("2026-08-19", 24.8, 15.2),
            ("2026-08-20", 19.3, 15.3),
            ("2026-08-21", 17.2, 15.4),
            ("2026-08-22", 16.5, 15.5),
        ]
    points = []

    for index, (date, kwh, baseline_kwh) in enumerate(series):
        cost = kwh * 2.15
        anomaly = None
        if selected_period == "6m" and index == 4:
            anomaly = {
                "title": "Summer AC increase",
                "explanation": (
                    "Air-conditioner usage rose during July and continued "
                    "to influence the August forecast."
                ),
            }
        points.append(
            HistoryPoint(
                timestamp=date,
                totalKWh=kwh,
                estimatedCostEGP=cost,
                baselineKWh=baseline_kwh,
                baselineCostEGP=baseline_kwh * 2.15,
                appliances={
                    "airConditioner": {"kWh": kwh * 0.40 if household_id == "high-ac-home" else 0.0, "costEGP": cost * 0.40 if household_id == "high-ac-home" else 0.0},
                    "waterHeater": {"kWh": 0.0, "costEGP": 0.0},
                    "refrigerator": {"kWh": kwh * 0.20, "costEGP": cost * 0.20},
                    "lighting": {"kWh": kwh * 0.15, "costEGP": cost * 0.15},
                    "other": {"kWh": kwh * 0.25, "costEGP": cost * 0.25},
                },
                anomaly=anomaly,
            )
        )

    return UsageHistoryResponse(
        period=selected_period,
        granularity=granularity,
        date_range_label=date_range_label,
        points=points,
    )
