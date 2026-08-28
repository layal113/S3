import logging
import os
import time
import uuid
import calendar
import json
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request as UrlRequest, urlopen

from fastapi import FastAPI, HTTPException, Query, Body, Request, status
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from dotenv import load_dotenv
from datetime import datetime, timedelta
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
    SmartTipsRequest,
    SmartTipsResponse,
    TipChatRequest,
    TipChatResponse,
)
from simulator.generate_household import generate_synthetic_household
from model.predict import predict_disaggregation
from data.config import MINIMUM_FEATURE_WINDOW_SIZE, CATEGORY_DISPLAY_NAMES

load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=True)

logging.basicConfig(
    level=os.getenv("MIQYAS_LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("miqyas.api")
DEBUG_BREAKPOINTS_ENABLED = os.getenv("MIQYAS_DEBUG_BREAKPOINTS") == "1"
ESTIMATED_EGP_PER_KWH = float(os.getenv("MIQYAS_EGP_PER_KWH", "2.15"))
TARIFF_THRESHOLDS_KWH = [50.0, 100.0, 200.0, 350.0, 650.0, 1000.0]
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")
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


def distribute_consumption(total_kwh: float, weights: List[float]) -> List[float]:
    """Distribute a household total while preserving the rounded sum."""
    if not weights:
        return []
    safe_weights = [max(0.0, weight) for weight in weights]
    weight_sum = sum(safe_weights) or float(len(safe_weights))
    distributed = [round(total_kwh * weight / weight_sum, 2) for weight in safe_weights]
    distributed[-1] = round(distributed[-1] + total_kwh - sum(distributed), 2)
    return distributed


def appliance_shares(breakdown: BreakdownResponse) -> Dict[str, float]:
    """Map ML categories to the Insights appliance contract."""
    category_map = {
        "ac_hvac": "airConditioner",
        "water_heater": "waterHeater",
        "fridge": "refrigerator",
        "lighting": "lighting",
        "other": "other",
    }
    shares = {
        "airConditioner": 0.0,
        "waterHeater": 0.0,
        "refrigerator": 0.0,
        "lighting": 0.0,
        "other": 0.0,
    }
    for item in breakdown.appliance_breakdown:
        key = category_map.get(item.internal_category, "other")
        shares[key] += max(0.0, item.share_percent / 100.0)

    share_sum = sum(shares.values())
    if share_sum <= 0:
        return {**shares, "other": 1.0}
    return {key: value / share_sum for key, value in shares.items()}


def build_household_history(
    household_id: str, period: str
) -> tuple[str, str, str, List[HistoryPoint]]:
    """Build history from the same latest breakdown used by the dashboard."""
    breakdown = get_latest_breakdown(household_id)
    projection = project_breakdown_to_month(breakdown)
    now = datetime.utcnow()
    elapsed_days = max(1.0, projection["elapsed_days"])
    current_kwh = projection["current_kwh"]

    if period == "6m":
        selected_period = "6m"
        granularity = "month"
        # Seasonal factors keep earlier months proportional to the current
        # backend forecast rather than using unrelated fixed totals.
        month_totals = [
            round(projection["projected_kwh"] * factor, 1)
            for factor in [0.72, 0.76, 0.84, 0.92, 1.08, 1.0]
        ]
        dates = []
        for offset in range(5, -1, -1):
            month_index = now.month - 1 - offset
            year = now.year + month_index // 12
            month = month_index % 12 + 1
            dates.append(datetime(year, month, 1))
        totals = month_totals
        date_range_label = (
            f"{dates[0].strftime('%B')}–{dates[-1].strftime('%B %Y')}"
        )
    elif period == "4w":
        selected_period = "4w"
        granularity = "week"
        period_total = current_kwh * min(28.0 / elapsed_days, 1.0)
        totals = distribute_consumption(period_total, [0.92, 0.98, 1.03, 1.07])
        dates = [now - timedelta(days=7 * offset) for offset in range(3, -1, -1)]
        date_range_label = (
            f"{dates[0].strftime('%d %B')}–{dates[-1].strftime('%d %B %Y')}"
        )
    else:
        selected_period = "7d"
        granularity = "day"
        period_total = current_kwh * min(7.0 / elapsed_days, 1.0)
        totals = distribute_consumption(
            period_total, [0.91, 0.96, 1.02, 1.18, 1.05, 0.94, 0.99]
        )
        dates = [now - timedelta(days=offset) for offset in range(6, -1, -1)]
        date_range_label = (
            f"{dates[0].strftime('%d %B')}–{dates[-1].strftime('%d %B %Y')}"
        )

    shares = appliance_shares(breakdown)
    baseline = sum(totals) / max(1, len(totals))
    highest_index = max(range(len(totals)), key=totals.__getitem__)
    points = []
    for index, (timestamp, total_kwh) in enumerate(zip(dates, totals)):
        estimated_cost = round(total_kwh * ESTIMATED_EGP_PER_KWH, 2)
        appliances = {
            key: {
                "kWh": round(total_kwh * share, 2),
                "costEGP": round(estimated_cost * share, 2),
            }
            for key, share in shares.items()
        }
        anomaly = None
        if index == highest_index and total_kwh > baseline * 1.05:
            anomaly = {
                "title": "Usage above period baseline",
                "explanation": (
                    "This point is above the household baseline and contributes "
                    "to the current backend forecast."
                ),
            }
        points.append(
            HistoryPoint(
                timestamp=timestamp.date().isoformat(),
                totalKWh=total_kwh,
                estimatedCostEGP=estimated_cost,
                baselineKWh=round(baseline, 2),
                baselineCostEGP=round(baseline * ESTIMATED_EGP_PER_KWH, 2),
                appliances=appliances,
                anomaly=anomaly,
            )
        )

    return selected_period, granularity, date_range_label, points


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
    Household history derived from the same backend breakdown as the dashboard.
    """
    selected_period, granularity, date_range_label, points = (
        build_household_history(household_id, period)
    )

    return UsageHistoryResponse(
        period=selected_period,
        granularity=granularity,
        date_range_label=date_range_label,
        points=points,
    )


def call_gemini(payload: Dict[str, Any]) -> Dict[str, Any]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY is not configured on the backend")
        raise HTTPException(
            status_code=503,
            detail="Smart Tips is not configured on this server.",
        )

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{quote(GEMINI_MODEL, safe='')}:generateContent"
    )
    request = UrlRequest(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )
    try:
        with urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        response_text = error.read().decode("utf-8", errors="replace")
        logger.error("Gemini HTTP error status=%s response=%s", error.code, response_text)
        if error.code == 429:
            raise HTTPException(
                status_code=429,
                detail="Smart Tips has reached its AI request limit. Please wait and retry.",
            )
        raise HTTPException(status_code=502, detail="AI service request failed.")
    except (URLError, TimeoutError, json.JSONDecodeError) as error:
        logger.exception("Gemini request failed: %s", error)
        raise HTTPException(status_code=502, detail="AI service is unavailable.")


def gemini_text(response: Dict[str, Any]) -> str:
    try:
        return response["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError, TypeError, AttributeError):
        logger.error("Gemini response did not contain candidate text")
        raise HTTPException(status_code=502, detail="AI service returned no response.")


@app.post("/v1/smart-tips/generate", response_model=SmartTipsResponse)
def generate_smart_tips(request: SmartTipsRequest):
    prompt = f"""You are an energy efficiency advisor. Based on the household data below, generate exactly 4 personalized energy-saving tips.

Household data:
- Home type: {request.home_type}
- Occupants: {request.occupants}
- Avg daily usage: {request.avg_kwh} kWh
- Detected anomalies: {request.anomalies_summary}
- Top energy-consuming periods: {request.peak_hours}

Rules:
- Each tip must be specific to this household's data, not generic advice
- Each tip should be actionable
- Prioritize the tip most likely to save the most energy first

Return ONLY valid JSON, no markdown, no preamble, in this exact schema:
{{
  "tips": [
    {{
      "id": "tip_1",
      "title": "short title (max 6 words)",
      "summary": "1-2 sentence explanation",
      "estimated_savings": "e.g. ~8% on cooling costs",
      "category": "heating|cooling|appliances|lighting|behavior"
    }}
  ]
}}"""
    response = call_gemini(
        {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.4,
                "responseMimeType": "application/json",
                "responseSchema": {
                    "type": "object",
                    "required": ["tips"],
                    "properties": {
                        "tips": {
                            "type": "array",
                            "minItems": 4,
                            "maxItems": 4,
                            "items": {
                                "type": "object",
                                "required": [
                                    "id",
                                    "title",
                                    "summary",
                                    "estimated_savings",
                                    "category",
                                ],
                                "properties": {
                                    "id": {"type": "string"},
                                    "title": {"type": "string"},
                                    "summary": {"type": "string"},
                                    "estimated_savings": {"type": "string"},
                                    "category": {
                                        "type": "string",
                                        "enum": [
                                            "heating",
                                            "cooling",
                                            "appliances",
                                            "lighting",
                                            "behavior",
                                        ],
                                    },
                                },
                            },
                        }
                    },
                },
            },
        }
    )
    raw_text = gemini_text(response)
    cleaned = raw_text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        parsed = SmartTipsResponse.model_validate_json(cleaned)
    except Exception as error:
        logger.exception("Gemini tips JSON validation failed: %s", error)
        raise HTTPException(status_code=502, detail="AI tips had an invalid format.")
    if len(parsed.tips) != 4 or len({tip.id for tip in parsed.tips}) != 4:
        raise HTTPException(status_code=502, detail="AI did not return four unique tips.")
    if any(not tip.title.strip() or len(tip.title.split()) > 6 for tip in parsed.tips):
        raise HTTPException(status_code=502, detail="AI tip titles had an invalid format.")
    return parsed


@app.post("/v1/smart-tips/chat", response_model=TipChatResponse)
def chat_about_tip(request: TipChatRequest):
    household = request.household_data
    tip = request.tip
    system_context = f"""You are an energy efficiency advisor discussing ONE specific tip with a homeowner.

Household context:
- Home type: {household.home_type}
- Avg daily usage: {household.avg_kwh} kWh

The tip being discussed:
Title: {tip.title}
Summary: {tip.summary}

Answer the user's follow-up questions about this tip specifically — implementation steps, cost estimates, why it applies to their home, alternatives if this doesn't work for them. Stay focused on this tip unless the user clearly asks about something else. Keep responses conversational and concise (2-4 sentences unless they ask for detail)."""
    contents = [
        {"role": message.role, "parts": [{"text": message.text}]}
        for message in request.conversation_history
    ]
    contents.append({"role": "user", "parts": [{"text": request.user_message}]})
    response = call_gemini(
        {
            "systemInstruction": {"parts": [{"text": system_context}]},
            "contents": contents,
            "generationConfig": {"temperature": 0.7},
        }
    )
    return TipChatResponse(message=gemini_text(response))
