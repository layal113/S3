import logging
import os
import time
import uuid
import calendar
import json
import math
import random
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
from data.config import MINIMUM_FEATURE_WINDOW_SIZE, CATEGORY_DISPLAY_NAMES, ARTIFACTS_DIR
import sentry_sdk
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=True)

logging.basicConfig(
    level=os.getenv("MIQYAS_LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("miqyas.api")

SENTRY_DSN = os.getenv("SENTRY_DSN")
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        # Do not attach sensitive PII like headers and client IP by default
        send_default_pii=False,
        # Enable sending logs to Sentry
        enable_logs=True,
        # Set traces_sample_rate to 1.0 to capture 100% of transactions for tracing.
        traces_sample_rate=1.0,
        # Set profile_session_sample_rate to 1.0 to profile 100% of profile sessions.
        profile_session_sample_rate=1.0,
        # Set profile_lifecycle to "trace" to automatically run the profiler on when there is an active transaction
        profile_lifecycle="trace",
    )
    logger.info("Sentry error & performance monitoring initialized.")
else:
    logger.info("SENTRY_DSN not configured; Sentry monitoring is disabled.")
DEBUG_BREAKPOINTS_ENABLED = os.getenv("MIQYAS_DEBUG_BREAKPOINTS") == "1"
ESTIMATED_EGP_PER_KWH = float(os.getenv("MIQYAS_EGP_PER_KWH", "2.15"))
TARIFF_THRESHOLDS_KWH = [50.0, 100.0, 200.0, 350.0, 650.0, 1000.0]
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")
latest_breakdowns: Dict[str, BreakdownResponse] = {}
previous_projected_kwh: Dict[str, float] = {}
latest_simulation_scenarios: Dict[str, str] = {}
latest_simulation_metadata: Dict[str, Dict[str, Any]] = {}


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

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS for deployed Render backend, Render Static Site frontend, and local dev environments
default_origins = [
    "https://s3-d0wz.onrender.com",
    "http://localhost:8081",
    "http://localhost:19006",
    "http://localhost:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8081",
    "http://127.0.0.1:8000",
    "http://10.0.2.2:8000",
    "http://10.0.2.2:8081",
]

custom_origins = os.getenv("CORS_ORIGINS")
if custom_origins:
    origins = [orig.strip() for orig in custom_origins.split(",") if orig.strip()]
else:
    origins = default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.onrender\.com",
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


@app.get("/health")
def health_check():
    """
    Health check endpoint returning service status and verifying
    that all trained ML model artifacts and metadata files are loaded on disk.
    """
    expected_categories = ["fridge", "lighting", "other", "ac_hvac"]
    models_exist = all(
        (ARTIFACTS_DIR / f"{cat}_model.joblib").exists() for cat in expected_categories
    ) and (ARTIFACTS_DIR / "metadata.json").exists()
    return {
        "status": "ok",
        "models_loaded": models_exist,
    }


@app.get("/sentry-debug")
async def trigger_sentry_unhandled_error():
    """Trigger an unhandled ZeroDivisionError to verify automatic Sentry error capture."""
    division_by_zero = 1 / 0
    return {"result": division_by_zero}


@app.get("/sentry-capture-test")
def trigger_sentry_manual_capture():
    """Manually capture an error via sentry_sdk to verify manual error reporting."""
    try:
        raise ValueError("Miqyas manually triggered test error for Sentry verification")
    except ValueError as err:
        event_id = sentry_sdk.capture_exception(err)
        return {
            "status": "captured",
            "message": str(err),
            "sentry_event_id": str(event_id) if event_id else None,
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


INSIGHTS_APPLIANCE_KEYS = [
    "airConditioner",
    "waterHeater",
    "refrigerator",
    "lighting",
    "washingMachine",
    "oven",
    "dishwasher",
    "electronics",
    "poolPump",
    "other",
]


def appliance_shares(breakdown: BreakdownResponse) -> Dict[str, float]:
    """Map every dashboard category into the Insights appliance contract."""
    category_map = {
        "ac_hvac": "airConditioner",
        "water_heater": "waterHeater",
        "fridge": "refrigerator",
        "lighting": "lighting",
        "washing_machine": "washingMachine",
        "oven": "oven",
        "dishwasher": "dishwasher",
        "electronics": "electronics",
        "pool_pump": "poolPump",
        "other": "other",
        "unattributed": "other",
    }
    shares = {key: 0.0 for key in INSIGHTS_APPLIANCE_KEYS}
    for item in breakdown.appliance_breakdown:
        key = category_map.get(item.internal_category, "other")
        shares[key] += max(0.0, item.share_percent / 100.0)

    share_sum = sum(shares.values())
    if share_sum <= 0:
        shares["other"] = 1.0
        return shares
    return {key: value / share_sum for key, value in shares.items()}


def stable_history_seed(household_id: str, seed: Optional[int], context: str) -> int:
    text = f"{household_id}:{context}"
    text_value = sum((index + 1) * ord(char) for index, char in enumerate(text))
    return int(seed or 0) + text_value


def month_dates(year: int, month: int, through_day: Optional[int] = None) -> List[datetime]:
    final_day = through_day or calendar.monthrange(year, month)[1]
    return [datetime(year, month, day) for day in range(1, final_day + 1)]


def shifted_month(value: datetime, offset: int) -> tuple[int, int]:
    month_index = value.year * 12 + value.month - 1 + offset
    return month_index // 12, month_index % 12 + 1


def scenario_daily_weights(
    dates: List[datetime],
    household_id: str,
    seed: Optional[int],
    scenario_label: str,
    configuration: Dict[str, Any],
    context: str,
) -> List[float]:
    """Create replayable daily variation influenced by the active scenario."""
    if not dates:
        return []
    rng = random.Random(stable_history_seed(household_id, seed, context))
    conditions = configuration.get("conditions", {})
    if not isinstance(conditions, dict):
        conditions = {}
    intensity = str(
        conditions.get("usageIntensity", conditions.get("usage_intensity", "typical"))
    )
    occupancy = str(conditions.get("occupancy", "home"))
    scenario_text = scenario_label.lower()
    high_variation = any(
        word in scenario_text
        for word in ("heatwave", "hot", "gathering", "busy", "laundry")
    ) or intensity == "high"
    low_variation = any(
        word in scenario_text for word in ("away", "quiet", "conservation")
    ) or intensity == "low"

    weights = []
    for index, date in enumerate(dates):
        weekly_wave = 1.0 + 0.07 * math.sin((index + seed % 7 if seed else index) * 1.7)
        weekend = 1.08 if date.weekday() >= 5 and occupancy != "away" else 0.98
        jitter = rng.uniform(-0.11, 0.11)
        weights.append(max(0.35, weekly_wave * weekend + jitter))

    spike_index = stable_history_seed(household_id, seed, context) % len(weights)
    weights[spike_index] *= 1.3 if high_variation else (1.08 if low_variation else 1.18)
    if low_variation and len(weights) > 2:
        weights[(spike_index + 2) % len(weights)] *= 0.78
    return weights


def build_appliance_energy_rows(
    daily_totals: List[float],
    shares: Dict[str, float],
    household_id: str,
    seed: Optional[int],
    context: str,
) -> List[Dict[str, float]]:
    """Vary appliance behavior by day while preserving row and category totals."""
    if not daily_totals:
        return []
    rng = random.Random(stable_history_seed(household_id, seed, f"{context}:appliances"))
    total_kwh = sum(daily_totals)
    targets = {key: total_kwh * shares[key] for key in INSIGHTS_APPLIANCE_KEYS}
    matrix: List[Dict[str, float]] = []
    for index, total in enumerate(daily_totals):
        row = {}
        for category_index, key in enumerate(INSIGHTS_APPLIANCE_KEYS):
            wave = 1.0 + 0.16 * math.sin(index * 1.31 + category_index * 0.83)
            category_jitter = rng.uniform(0.9, 1.1)
            row[key] = max(0.0, total * shares[key] * wave * category_jitter)
        matrix.append(row)

    # Iterative proportional fitting keeps daily totals and billing-cycle
    # appliance totals reconciled to the same source values.
    for _ in range(24):
        for key in INSIGHTS_APPLIANCE_KEYS:
            current = sum(row[key] for row in matrix)
            factor = targets[key] / current if current > 0 else 0.0
            for row in matrix:
                row[key] *= factor
        for index, row in enumerate(matrix):
            current = sum(row.values())
            factor = daily_totals[index] / current if current > 0 else 0.0
            for key in INSIGHTS_APPLIANCE_KEYS:
                row[key] *= factor

    rounded_rows = []
    for total, row in zip(daily_totals, matrix):
        rounded = {key: round(value, 2) for key, value in row.items()}
        adjustment_key = max(rounded, key=rounded.get)
        rounded[adjustment_key] = round(
            rounded[adjustment_key] + total - sum(rounded.values()), 2
        )
        rounded_rows.append(rounded)
    return rounded_rows


def build_daily_records(
    dates: List[datetime],
    target_kwh: float,
    shares: Dict[str, float],
    household_id: str,
    seed: Optional[int],
    scenario_label: str,
    configuration: Dict[str, Any],
    context: str,
) -> List[Dict[str, Any]]:
    weights = scenario_daily_weights(
        dates, household_id, seed, scenario_label, configuration, context
    )
    daily_totals = distribute_consumption(target_kwh, weights)
    energy_rows = build_appliance_energy_rows(
        daily_totals, shares, household_id, seed, context
    )
    records = []
    cumulative_kwh = 0.0
    cumulative_cost = 0.0
    for date, total_kwh, energy_row in zip(dates, daily_totals, energy_rows):
        cumulative_kwh = round(cumulative_kwh + total_kwh, 2)
        next_cost = calculate_residential_bill(cumulative_kwh)
        daily_cost = round(next_cost - cumulative_cost, 2)
        cumulative_cost = next_cost
        cost_values = distribute_consumption(
            daily_cost, [energy_row[key] for key in INSIGHTS_APPLIANCE_KEYS]
        )
        appliances = {
            key: {"kWh": energy_row[key], "costEGP": cost_values[index]}
            for index, key in enumerate(INSIGHTS_APPLIANCE_KEYS)
        }
        records.append(
            {
                "timestamp": date,
                "totalKWh": total_kwh,
                "estimatedCostEGP": daily_cost,
                "appliances": appliances,
            }
        )
    return records


def aggregate_records(
    records: List[Dict[str, Any]], timestamp: datetime
) -> Dict[str, Any]:
    appliances = {
        key: {
            "kWh": round(
                sum(record["appliances"][key]["kWh"] for record in records), 2
            ),
            "costEGP": round(
                sum(record["appliances"][key]["costEGP"] for record in records), 2
            ),
        }
        for key in INSIGHTS_APPLIANCE_KEYS
    }
    return {
        "timestamp": timestamp,
        "totalKWh": round(sum(record["totalKWh"] for record in records), 2),
        "estimatedCostEGP": round(
            sum(record["estimatedCostEGP"] for record in records), 2
        ),
        "appliances": appliances,
    }


def history_points(
    records: List[Dict[str, Any]], scenario_label: str
) -> List[HistoryPoint]:
    if not records:
        return []
    baseline_kwh = sum(record["totalKWh"] for record in records) / len(records)
    baseline_cost = (
        sum(record["estimatedCostEGP"] for record in records) / len(records)
    )
    highest_index = max(range(len(records)), key=lambda index: records[index]["totalKWh"])
    points = []
    for index, record in enumerate(records):
        anomaly = None
        if index == highest_index and record["totalKWh"] > baseline_kwh * 1.05:
            difference = round(
                (record["totalKWh"] / max(baseline_kwh, 0.01) - 1.0) * 100.0
            )
            anomaly = {
                "title": f"{difference}% above this period’s baseline",
                "explanation": (
                    f"The {scenario_label.lower()} pattern created the largest "
                    "usage point in this view. Its energy and cost are already "
                    "included in the dashboard totals."
                ),
            }
        points.append(
            HistoryPoint(
                timestamp=record["timestamp"].date().isoformat(),
                totalKWh=record["totalKWh"],
                estimatedCostEGP=record["estimatedCostEGP"],
                baselineKWh=round(baseline_kwh, 2),
                baselineCostEGP=round(baseline_cost, 2),
                appliances=record["appliances"],
                anomaly=anomaly,
            )
        )
    return points


def build_household_history(household_id: str, period: str) -> UsageHistoryResponse:
    """Build every Insights value from the dashboard's latest breakdown."""
    breakdown = get_latest_breakdown(household_id)
    projection = project_breakdown_to_month(breakdown)
    metadata = latest_simulation_metadata.get(household_id, {})
    seed = metadata.get("seed")
    configuration = metadata.get("configuration", {})
    if not isinstance(configuration, dict):
        configuration = {}
    scenario_label = latest_simulation_scenarios.get(
        household_id, "Representative household day"
    )
    now = datetime.utcnow()
    shares = appliance_shares(breakdown)
    current_dates = month_dates(now.year, now.month, now.day)
    current_records = build_daily_records(
        current_dates,
        projection["current_kwh"],
        shares,
        household_id,
        seed,
        scenario_label,
        configuration,
        f"{now.year}-{now.month}:current",
    )
    current_by_date = {record["timestamp"].date(): record for record in current_records}

    previous_year, previous_month = shifted_month(now, -1)
    previous_dates = month_dates(previous_year, previous_month)
    previous_rng = random.Random(
        stable_history_seed(household_id, seed, f"{previous_year}-{previous_month}:total")
    )
    previous_total = round(
        projection["projected_kwh"] * previous_rng.uniform(0.84, 1.08), 1
    )
    previous_records = build_daily_records(
        previous_dates,
        previous_total,
        shares,
        household_id,
        seed,
        scenario_label,
        configuration,
        f"{previous_year}-{previous_month}:previous",
    )
    previous_by_date = {
        record["timestamp"].date(): record for record in previous_records
    }
    combined_by_date = {**previous_by_date, **current_by_date}

    if period == "6m":
        selected_period = "6m"
        granularity = "month"
        seasonal_factors = {
            1: 0.78,
            2: 0.72,
            3: 0.70,
            4: 0.76,
            5: 0.88,
            6: 1.02,
            7: 1.12,
            8: 1.08,
            9: 0.95,
            10: 0.82,
            11: 0.75,
            12: 0.80,
        }
        monthly_records = []
        for offset in range(-5, 0):
            year, month = shifted_month(now, offset)
            rng = random.Random(
                stable_history_seed(household_id, seed, f"{year}-{month}:month")
            )
            target = round(
                projection["projected_kwh"]
                * seasonal_factors[month]
                * rng.uniform(0.94, 1.06),
                1,
            )
            records = build_daily_records(
                month_dates(year, month),
                target,
                shares,
                household_id,
                seed,
                scenario_label,
                configuration,
                f"{year}-{month}:history",
            )
            monthly_records.append(aggregate_records(records, datetime(year, month, 1)))
        monthly_records.append(
            aggregate_records(current_records, datetime(now.year, now.month, 1))
        )
        selected_records = monthly_records
        date_range_label = (
            f"{monthly_records[0]['timestamp'].strftime('%B')}–"
            f"{monthly_records[-1]['timestamp'].strftime('%B %Y')}"
        )
    else:
        days = 28 if period == "4w" else 7
        selected_dates = [
            (now - timedelta(days=offset)).date()
            for offset in range(days - 1, -1, -1)
        ]
        daily_records = [
            combined_by_date[date]
            for date in selected_dates
            if date in combined_by_date
        ]
        date_range_label = (
            f"{daily_records[0]['timestamp'].strftime('%d %B')}–"
            f"{daily_records[-1]['timestamp'].strftime('%d %B %Y')}"
        )
        if period == "4w":
            selected_period = "4w"
            granularity = "week"
            selected_records = [
                aggregate_records(chunk, chunk[-1]["timestamp"])
                for start in range(0, len(daily_records), 7)
                if (chunk := daily_records[start : start + 7])
            ]
        else:
            selected_period = "7d"
            granularity = "day"
            selected_records = daily_records

    points = history_points(selected_records, scenario_label)
    billing_cycle_appliances = aggregate_records(
        current_records, current_records[-1]["timestamp"]
    )["appliances"]
    return UsageHistoryResponse(
        household_id=household_id,
        period=selected_period,
        granularity=granularity,
        date_range_label=date_range_label,
        scenario_label=scenario_label,
        simulation_seed=seed,
        period_total_kwh=round(sum(point.totalKWh for point in points), 2),
        period_estimated_cost_egp=round(
            sum(point.estimatedCostEGP for point in points), 2
        ),
        billing_cycle_kwh=projection["current_kwh"],
        billing_cycle_cost_egp=round(
            calculate_residential_bill(projection["current_kwh"]), 1
        ),
        projected_monthly_kwh=projection["projected_kwh"],
        projected_monthly_cost_egp=round(
            calculate_residential_bill(projection["projected_kwh"]), 1
        ),
        available_appliances=[
            key for key in INSIGHTS_APPLIANCE_KEYS if shares[key] > 0.0001
        ],
        billing_cycle_appliances=billing_cycle_appliances,
        points=points,
    )


def calculate_tariff_status(current_kwh: float, projected_kwh: float) -> TariffStatus:
    safe_current_kwh = max(0.0, current_kwh)
    safe_projected_kwh = max(0.0, projected_kwh)
    current_tier = len(TARIFF_THRESHOLDS_KWH) + 1
    next_threshold: Optional[float] = None
    lower_threshold = TARIFF_THRESHOLDS_KWH[-1]
    for index, threshold in enumerate(TARIFF_THRESHOLDS_KWH):
        # EgyptERA residential bands include their upper bound (for example,
        # 0–50 kWh is Tier 1 and Tier 2 starts above 50 kWh).
        if safe_current_kwh <= threshold:
            current_tier = index + 1
            next_threshold = threshold
            lower_threshold = 0.0 if index == 0 else TARIFF_THRESHOLDS_KWH[index - 1]
            break

    if next_threshold is None:
        return TariffStatus(
            current_tier=current_tier,
            next_tier=None,
            status_label="Highest tariff tier",
            detail="Usage is above the 1,000 kWh highest-tier threshold.",
            level_percent=100.0,
            remaining_kwh=0.0,
            projected_to_exceed=False,
        )

    next_tier = current_tier + 1
    remaining_kwh = max(0.0, next_threshold - safe_current_kwh)
    tier_width = max(1.0, next_threshold - lower_threshold)
    level_percent = min(
        100.0, max(0.0, ((safe_current_kwh - lower_threshold) / tier_width) * 100.0)
    )
    projected_to_exceed = safe_projected_kwh > next_threshold
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


def calculate_residential_bill(kwh: float) -> float:
    """April 2026 EgyptERA residential energy charge plus customer fee."""
    usage = max(0.0, kwh)
    if usage <= 50:
        return round(usage * 0.68 + 1.0, 2)
    if usage <= 100:
        return round(50 * 0.68 + (usage - 50) * 0.78 + 2.0, 2)
    if usage <= 200:
        return round(usage * 0.95 + 6.0, 2)
    if usage <= 350:
        return round(200 * 0.95 + (usage - 200) * 1.55 + 11.0, 2)
    if usage <= 650:
        return round(200 * 0.95 + 150 * 1.55 + (usage - 350) * 1.95 + 15.0, 2)
    if usage <= 1000:
        return round(usage * 2.10 + 25.0, 2)
    return round(usage * 2.58 + 40.0, 2)


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
        scenario_id=request.scenario_id,
        custom_conditions=(
            request.conditions
            if request.mode in {"custom", "replay"} and request.conditions
            else None
        ),
        profile=(request.profile if request.use_profile else None),
        seed=request.seed,
    )
    scenario_id = str(df.attrs.get("scenario_id", "custom"))
    scenario_label = str(df.attrs.get("scenario_label", "Custom household day"))
    latest_simulation_scenarios[household_id] = scenario_label
    simulation_metadata = {
        "seed": int(df.attrs.get("seed", 0)),
        "configuration": dict(df.attrs.get("configuration", {})),
        "events": list(df.attrs.get("events", [])),
    }
    latest_simulation_metadata[household_id] = simulation_metadata
    debug_checkpoint("simulation.generated", readings=len(df))

    readings = []
    for _, row in df.iterrows():
        appliance_columns = [
            column
            for column in df.columns
            if column not in {"timestamp", "house_id", "mains_power"}
        ]
        readings.append(
            SimulatedReading(
                timestamp=row["timestamp"],
                mains_power=float(row["mains_power"]),
                appliances={column: float(row[column]) for column in appliance_columns},
            )
        )

    response = SimulateUsageResponse(
        household_id=household_id,
        scenario_id=scenario_id,
        scenario_label=scenario_label,
        seed=simulation_metadata["seed"],
        configuration=simulation_metadata["configuration"],
        events=simulation_metadata["events"],
        timestamp_start=df.iloc[0]["timestamp"],
        timestamp_end=df.iloc[-1]["timestamp"],
        reading_count=len(readings),
        readings=readings,
    )
    debug_checkpoint("simulation.complete", readings=len(readings))
    return response


def build_simulated_appliance_items(
    readings: List[Dict[str, Any]],
    total_kwh: float,
    model_items: List[ApplianceBreakdownItem],
) -> List[ApplianceBreakdownItem]:
    """Use simulator ground truth for demo categories while retaining model scores."""
    display_names = {
        "fridge": "Refrigerator",
        "lighting": "Lighting",
        "ac_hvac": "Air conditioner",
        "water_heater": "Water heater",
        "washing_machine": "Washing machine",
        "oven": "Oven",
        "dishwasher": "Dishwasher",
        "electronics": "Electronics",
        "pool_pump": "Pool pump",
        "other": "Other/unclassified",
    }
    model_by_category = {item.internal_category: item for item in model_items}
    always_visible_categories = {
        "fridge",
        "lighting",
        "ac_hvac",
        "water_heater",
        "other",
    }
    totals: Dict[str, float] = {}
    for reading in readings:
        appliances = reading.get("appliances")
        if not isinstance(appliances, dict):
            continue
        for category, watts in appliances.items():
            totals[category] = totals.get(category, 0.0) + max(0.0, float(watts)) / 60_000.0

    items = []
    attributed_kwh = 0.0
    for category, consumption in totals.items():
        if consumption <= 0.0001 and category not in always_visible_categories:
            continue
        attributed_kwh += consumption
        model_item = model_by_category.get(category)
        items.append(
            ApplianceBreakdownItem(
                category=display_names.get(category, category.replace("_", " ").title()),
                internal_category=category,
                display_name=display_names.get(category, category.replace("_", " ").title()),
                consumption_kwh=round(consumption, 4),
                share_percent=round(consumption / max(total_kwh, 0.0001) * 100.0, 2),
                model_score=(model_item.model_score if model_item else 0.0),
                model_score_label=(model_item.model_score_label if model_item else "N/A"),
                not_yet_trained=(model_item.not_yet_trained if model_item else True),
            )
        )
    unattributed = max(0.0, total_kwh - attributed_kwh)
    if unattributed > 0.0001:
        items.append(
            ApplianceBreakdownItem(
                category="Unattributed / baseline",
                internal_category="unattributed",
                display_name="Unattributed / baseline",
                consumption_kwh=round(unattributed, 4),
                share_percent=round(unattributed / max(total_kwh, 0.0001) * 100.0, 2),
                model_score=1.0,
                model_score_label="High",
                not_yet_trained=False,
            )
        )
    return sorted(items, key=lambda item: item.consumption_kwh, reverse=True)


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
    has_simulated_ground_truth = any(
        isinstance(reading.get("appliances"), dict) for reading in request.readings
    )
    if has_simulated_ground_truth:
        items = build_simulated_appliance_items(
            request.readings, res["total_consumption_kwh"], items
        )

    response = BreakdownResponse(
        timestamp=res["timestamp"],
        duration_minutes=res["duration_minutes"],
        total_consumption_kwh=res["total_consumption_kwh"],
        appliance_breakdown=items,
        simulated=has_simulated_ground_truth,
    )
    remember_breakdown(request.household_id or "high-ac-home", response)
    return response


def create_demo_breakdown(household_id: str) -> BreakdownResponse:
    """Create an initial backend measurement window when no reading was submitted yet."""
    debug_checkpoint("breakdown.demo.start", household_id=household_id)
    df_sim = generate_synthetic_household(
        household_id=household_id, duration_minutes=1440
    )
    latest_simulation_scenarios[household_id] = str(
        df_sim.attrs.get("scenario_label", "Representative household day")
    )
    latest_simulation_metadata[household_id] = {
        "seed": int(df_sim.attrs.get("seed", 0)),
        "configuration": dict(df_sim.attrs.get("configuration", {})),
        "events": list(df_sim.attrs.get("events", [])),
    }
    res = predict_disaggregation(df_sim)
    items = [ApplianceBreakdownItem(**item) for item in res["appliance_breakdown"]]
    appliance_columns = [
        column
        for column in df_sim.columns
        if column not in {"timestamp", "house_id", "mains_power"}
    ]
    simulated_readings = [
        {
            "appliances": {
                column: float(row[column]) for column in appliance_columns
            }
        }
        for _, row in df_sim.iterrows()
    ]
    items = build_simulated_appliance_items(
        simulated_readings, res["total_consumption_kwh"], items
    )

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
    current_cost = round(calculate_residential_bill(current_kwh), 1)
    predicted_bill = round(calculate_residential_bill(projected_kwh), 1)
    previous_bill = round(calculate_residential_bill(previous_kwh), 1)
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
        simulation_scenario=latest_simulation_scenarios.get(
            household_id, "Representative household day"
        ),
        simulation_seed=latest_simulation_metadata.get(household_id, {}).get("seed"),
        simulation_configuration=latest_simulation_metadata.get(household_id, {}).get(
            "configuration", {}
        ),
        simulation_events=latest_simulation_metadata.get(household_id, {}).get(
            "events", []
        ),
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
    return build_household_history(household_id, period)


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
@limiter.limit("10/minute")
def generate_smart_tips(request: Request, payload: SmartTipsRequest):
    prompt = f"""You are an energy efficiency advisor. Based on the household data below, generate exactly 4 personalized energy-saving tips.

Household data:
- Home type: {payload.home_type}
- Occupants: {payload.occupants}
- Avg daily usage: {payload.avg_kwh} kWh
- Detected anomalies: {payload.anomalies_summary}
- Top energy-consuming periods: {payload.peak_hours}

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
@limiter.limit("10/minute")
def chat_about_tip(request: Request, payload: TipChatRequest):
    tip = payload.tip
    full_usage_data_json = json.dumps(
        payload.full_usage_data, ensure_ascii=False, indent=2
    )
    household = payload.full_usage_data.get("household", {})
    user_name = household.get("userName") or "the homeowner"
    displayed_name = household.get("userName") or "not provided"
    house_type = household.get("homeType") or "not provided"
    occupants = household.get("occupants") or "not provided"
    current_topic = (
        f"""The tip you're currently discussing:
Title: {tip.title}
Summary: {tip.summary}
Category: {tip.category}"""
        if tip
        else """There isn't one specific tip selected for this conversation. Discuss this household's energy usage, forecasts, appliances, anomalies, tariffs, efficiency, and possible savings."""
    )
    conversation_focus = (
        "about one of their personalized energy tips"
        if tip
        else "about their household energy use"
    )
    system_context = f"""You're a friendly, casual energy advisor chatting with {user_name} {conversation_focus}. Talk like a knowledgeable friend, not a formal report — use contractions, keep it warm and human.

Here's what you know about this household:
- Name: {displayed_name}
- Home type: {house_type}
- Occupants: {occupants}
- Full usage data: {full_usage_data_json}

{current_topic}

How to behave:
- Address them by name occasionally if you have it, don't force it into every message
- Reference their specific situation (home type, occupants, usage patterns) naturally when it makes advice more concrete
- You have their full usage data, so bring in relevant details beyond just this one tip if it helps answer their question
- Be proactive: encourage them to actually take action on the tip, suggest concrete next steps, offer a walkthrough
- STAY ON TOPIC. Only discuss this tip, this household's energy usage, and general energy/efficiency questions. If the user asks something unrelated to energy, their home, or this tip, do NOT answer it — briefly redirect back to the tip instead. Do not engage with the off-topic content at all, even briefly.
- KEEP ANSWERS SHORT. Default to 1-3 sentences. Only give a longer, more detailed answer if the user explicitly asks for more detail, a full walkthrough, or a step-by-step breakdown.
- Don't repeat their question back before answering

Examples of how to redirect off-topic questions:
User: 'what's the weather like today'
You: 'Not something I can help with, but speaking of weather — hot days are probably why we're seeing those afternoon AC spikes. Want tips on that?'

User: 'can you help me write an essay for school'
You: 'That's outside what I can help with here — I'm just your energy advisor! Anything about your usage or this tip I can help with instead?'

User: 'what do you think about politics'
You: 'I'll stay in my lane on that one 😄 Got any questions about your energy setup though?'

Examples of short vs long answers:
User: 'why does this tip save energy'
You (short, correct): 'Your usage data shows most of your consumption is off-peak-hour AC running non-stop. This tip cuts that by scheduling it around when you're actually home.'

User: 'can you give me a full step by step on how to set this up'
You (longer, correct — they explicitly asked for a walkthrough): [give the detailed steps]"""
    contents = [
        {"role": message.role, "parts": [{"text": message.text}]}
        for message in payload.conversation_history
    ]
    contents.append({"role": "user", "parts": [{"text": payload.user_message}]})
    response = call_gemini(
        {
            "systemInstruction": {"parts": [{"text": system_context}]},
            "contents": contents,
            "generationConfig": {"temperature": 0.8},
        }
    )
    return TipChatResponse(message=gemini_text(response))
