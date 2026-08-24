from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from typing import List, Dict, Optional, Literal, Any


class BaseSchema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )


class ApplianceBreakdownItem(BaseSchema):
    category: str = Field(..., description="Internal taxonomy category key, e.g. 'fridge', 'ac_hvac'")
    display_name: str = Field(..., description="Presentation display name, e.g. 'Refrigerator'")
    consumption_kwh: float = Field(..., description="Consumption in kWh over period")
    share_percent: float = Field(..., description="Percentage share of total consumption (0-100%)")
    confidence_score: float = Field(..., description="Numeric confidence score (0.0 to 1.0)")
    confidence_label: Literal["High", "Medium", "Low", "N/A"] = Field(
        ..., description="Confidence tier: High >=0.70, Medium 0.40-0.70, Low <0.40, N/A for untrained"
    )
    not_yet_trained: bool = Field(
        ..., description="Explicit flag indicating if category is absent/untrained in dataset"
    )


class BreakdownRequest(BaseSchema):
    household_id: Optional[str] = Field(default="high-ac-home", description="Household identifier")
    readings: List[Dict[str, Any]] = Field(
        ..., description="Array of time-series readings with timestamp and aggregate/mains_power (minimum 15 readings)"
    )


class BreakdownResponse(BaseSchema):
    timestamp: str
    duration_minutes: int
    total_consumption_kwh: float
    appliance_breakdown: List[ApplianceBreakdownItem]
    simulated: bool = False


class SimulateUsageRequest(BaseSchema):
    household_id: Optional[str] = Field(default="synthetic-1")
    duration_minutes: Optional[int] = Field(default=60, ge=15, description="Duration in minutes (minimum 15)")
    interval_seconds: Optional[int] = Field(default=60)


class SimulatedReading(BaseSchema):
    timestamp: str
    mains_power: float
    appliances: Dict[str, float]


class SimulateUsageResponse(BaseSchema):
    household_id: str
    timestamp_start: str
    timestamp_end: str
    reading_count: int
    readings: List[SimulatedReading]


class RecommendationResponse(BaseSchema):
    title: str
    description: str
    estimated_monthly_saving_kwh: float


class PriorityInsight(BaseSchema):
    kind: Literal["warning", "recommendation"]
    title: str
    message: str


class TariffStatus(BaseSchema):
    current_tier: int
    next_tier: int
    status_label: str
    detail: str
    level_percent: float
    remaining_kwh: float
    projected_to_exceed: bool


class DashboardResponse(BaseSchema):
    household_id: str
    household_name: str
    billing_period_label: str
    current_consumption_kwh: float
    current_estimated_cost_egp: float
    predicted_month_end_bill_egp: float
    projected_monthly_kwh: float
    previous_month_bill_egp: float
    change_from_previous_month_percent: float
    priority_insight: PriorityInsight
    tariff_status: TariffStatus
    appliance_breakdown: List[ApplianceBreakdownItem]
    recommendation: RecommendationResponse
    simulated: bool
    updated_at: str


class HistoryPointAppliance(BaseSchema):
    kwh: float
    cost_egp: float


class HistoryPoint(BaseSchema):
    timestamp: str
    total_kwh: float
    estimated_cost_egp: float
    baseline_kwh: float
    baseline_cost_egp: float
    appliances: Dict[str, HistoryPointAppliance]
    anomaly: Optional[Dict[str, str]] = None


class UsageHistoryResponse(BaseSchema):
    period: Literal["7d", "4w"]
    granularity: Literal["day", "week"]
    date_range_label: str
    points: List[HistoryPoint]
