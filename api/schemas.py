from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from typing import List, Dict, Optional, Literal, Any


class BaseSchema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )


# Note: model_score and model_score_label represent raw predicted classifier probabilities, not calibrated accuracy.
class ApplianceBreakdownItem(BaseSchema):
    category: str = Field(..., description="Category display name or internal key")
    internal_category: str = Field(..., description="Internal taxonomy key, e.g. 'fridge', 'ac_hvac'")
    display_name: str = Field(..., description="Presentation display name, e.g. 'Refrigerator'")
    consumption_kwh: float = Field(..., description="Consumption in kWh over window")
    share_percent: float = Field(..., description="Percentage share of total consumption (0-100%)")
    model_score: float = Field(..., description="Raw classifier predicted probability score (0.0 to 1.0)")
    model_score_label: Literal["High", "Medium", "Low", "N/A"] = Field(
        ..., description="Raw probability tier: High >=0.70, Medium 0.40-0.70, Low <0.40, N/A for untrained"
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
    household_id: Optional[str] = Field(default="high-ac-home")
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


class HistoryPointAppliance(BaseModel):
    kWh: float = Field(..., serialization_alias="kWh")
    costEGP: float = Field(..., serialization_alias="costEGP")


class HistoryPointAppliances(BaseModel):
    airConditioner: HistoryPointAppliance = Field(..., serialization_alias="airConditioner")
    waterHeater: HistoryPointAppliance = Field(..., serialization_alias="waterHeater")
    refrigerator: HistoryPointAppliance = Field(..., serialization_alias="refrigerator")
    lighting: HistoryPointAppliance = Field(..., serialization_alias="lighting")
    other: HistoryPointAppliance = Field(..., serialization_alias="other")


class HistoryPoint(BaseModel):
    timestamp: str
    totalKWh: float = Field(..., serialization_alias="totalKWh")
    estimatedCostEGP: float = Field(..., serialization_alias="estimatedCostEGP")
    baselineKWh: float = Field(..., serialization_alias="baselineKWh")
    baselineCostEGP: float = Field(..., serialization_alias="baselineCostEGP")
    appliances: HistoryPointAppliances
    anomaly: Optional[Dict[str, str]] = None


class UsageHistoryResponse(BaseSchema):
    period: Literal["7d", "4w", "6m"]
    granularity: Literal["day", "week", "month"]
    date_range_label: str
    points: List[HistoryPoint]


class SmartTip(BaseSchema):
    id: str
    title: str
    summary: str
    estimated_savings: str
    category: Literal["heating", "cooling", "appliances", "lighting", "behavior"]


class SmartTipsResponse(BaseSchema):
    tips: List[SmartTip]


class SmartTipsRequest(BaseSchema):
    household_id: str
    home_type: str
    occupants: int
    avg_kwh: float
    anomalies_summary: str
    peak_hours: str


class TipChatMessage(BaseSchema):
    role: Literal["user", "model"]
    text: str


class TipChatRequest(BaseSchema):
    tip: SmartTip
    household_data: SmartTipsRequest
    conversation_history: List[TipChatMessage]
    user_message: str


class TipChatResponse(BaseSchema):
    message: str
