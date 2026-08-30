import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional


HOUSEHOLD_SCENARIOS: Dict[str, List[Dict[str, Any]]] = {
    "high-ac-home": [
        {"id": "heatwave", "label": "Heatwave cooling day", "ac_hours": range(10, 24), "ac_power": 1850, "ac_duty": 0.68, "fridges": 1, "lighting": 1.15, "other_base": 95, "cooking": 1.2, "heater_minutes": 45},
        {"id": "busy-evening", "label": "Busy evening at home", "ac_hours": range(16, 24), "ac_power": 1700, "ac_duty": 0.52, "fridges": 1, "lighting": 1.3, "other_base": 105, "cooking": 1.5, "heater_minutes": 55},
        {"id": "workday", "label": "AC-focused workday", "ac_hours": range(18, 24), "ac_power": 1600, "ac_duty": 0.42, "fridges": 1, "lighting": 0.9, "other_base": 75, "cooking": 0.9, "heater_minutes": 35},
        {"id": "conservation", "label": "Cooling conservation day", "ac_hours": range(19, 23), "ac_power": 1450, "ac_duty": 0.28, "fridges": 1, "lighting": 0.7, "other_base": 60, "cooking": 0.7, "heater_minutes": 25},
    ],
    "efficient-flat": [
        {"id": "efficient-routine", "label": "Efficient weekday routine", "ac_hours": range(19, 21), "ac_power": 850, "ac_duty": 0.22, "fridges": 1, "fridge_power": 70, "lighting": 0.45, "other_base": 38, "cooking": 0.55, "heater_minutes": 20},
        {"id": "away-day", "label": "Mostly away from home", "ac_hours": range(0), "ac_power": 0, "ac_duty": 0, "fridges": 1, "fridge_power": 65, "lighting": 0.25, "other_base": 25, "cooking": 0.2, "heater_minutes": 10},
        {"id": "work-from-home", "label": "Efficient work-from-home day", "ac_hours": range(13, 17), "ac_power": 950, "ac_duty": 0.3, "fridges": 1, "fridge_power": 75, "lighting": 0.55, "other_base": 65, "cooking": 0.75, "heater_minutes": 25},
        {"id": "laundry-weekend", "label": "Laundry and cooking weekend", "ac_hours": range(18, 21), "ac_power": 900, "ac_duty": 0.28, "fridges": 1, "fridge_power": 75, "lighting": 0.65, "other_base": 55, "cooking": 1.25, "heater_minutes": 40, "spike_chance": 0.025},
    ],
    "family-villa": [
        {"id": "school-day", "label": "Family school day", "ac_hours": range(17, 24), "ac_power": 2100, "ac_duty": 0.42, "fridges": 2, "lighting": 1.25, "other_base": 130, "cooking": 1.5, "heater_minutes": 75},
        {"id": "family-gathering", "label": "Weekend family gathering", "ac_hours": range(12, 24), "ac_power": 2300, "ac_duty": 0.62, "fridges": 2, "lighting": 1.6, "other_base": 180, "cooking": 2.0, "heater_minutes": 100, "spike_chance": 0.035},
        {"id": "quiet-villa", "label": "Quiet low-occupancy day", "ac_hours": range(19, 23), "ac_power": 1800, "ac_duty": 0.28, "fridges": 2, "lighting": 0.75, "other_base": 80, "cooking": 0.7, "heater_minutes": 40},
        {"id": "hot-weekend", "label": "Hot weekend at the villa", "ac_hours": range(9, 24), "ac_power": 2400, "ac_duty": 0.72, "fridges": 2, "lighting": 1.35, "other_base": 155, "cooking": 1.7, "heater_minutes": 80},
    ],
}

_scenario_cursors: Dict[str, int] = {}

DEFAULT_APPLIANCES = {
    "high-ac-home": ["electronics", "oven", "washing_machine"],
    "efficient-flat": ["electronics", "oven"],
    "family-villa": [
        "electronics",
        "oven",
        "washing_machine",
        "dishwasher",
        "pool_pump",
    ],
}


def next_household_scenario(
    household_id: str, scenario_id: Optional[str] = None
) -> Dict[str, Any]:
    scenarios = HOUSEHOLD_SCENARIOS.get(household_id, HOUSEHOLD_SCENARIOS["efficient-flat"])
    if scenario_id:
        selected = next(
            (scenario for scenario in scenarios if scenario["id"] == scenario_id), None
        )
        if selected:
            return dict(selected)
    cursor = _scenario_cursors.get(household_id, 0)
    _scenario_cursors[household_id] = cursor + 1
    return dict(scenarios[cursor % len(scenarios)])


def customize_scenario(
    household_id: str,
    scenario: Dict[str, Any],
    conditions: Dict[str, Any],
    profile: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    customized = dict(scenario)
    def condition(name: str, camel_name: str, default: Any) -> Any:
        return conditions.get(name, conditions.get(camel_name, default))

    temperature = float(condition("temperature_c", "temperatureC", 30))
    thermostat = float(condition("thermostat_c", "thermostatC", 24))
    ac_hours = max(0, min(18, int(condition("ac_hours", "acHours", 6))))
    customized["ac_hours"] = range(max(6, 24 - ac_hours), 24)
    customized["ac_duty"] = max(
        0.0, min(0.9, 0.22 + (temperature - 25) * 0.025 + (24 - thermostat) * 0.04)
    )
    customized["ac_power"] = 900 if household_id == "efficient-flat" else (2200 if household_id == "family-villa" else 1650)

    occupancy_factors = {"away": 0.45, "partial": 0.75, "home": 1.15}
    intensity_factors = {"low": 0.7, "typical": 1.0, "high": 1.35}
    factor = occupancy_factors.get(conditions.get("occupancy"), 1.0)
    factor *= intensity_factors.get(
        condition("usage_intensity", "usageIntensity", "typical"), 1.0
    )
    if condition("day_type", "dayType", "weekday") == "weekend":
        factor *= 1.12
    if profile:
        residents = max(1, int(profile.get("occupants", 3)))
        factor *= max(0.7, min(1.45, 0.75 + residents * 0.1))
        if str(profile.get("home_type", profile.get("homeType", ""))).lower() == "villa":
            factor *= 1.12

    customized["lighting"] *= factor
    customized["other_base"] *= factor
    customized["cooking"] *= factor
    customized["heater_minutes"] *= factor
    customized["id"] = "custom"
    customized["label"] = conditions.get("label") or "Custom household day"
    customized["appliances"] = conditions.get("appliances") or DEFAULT_APPLIANCES.get(household_id, [])
    return customized


def apply_profile_to_scenario(
    household_id: str, scenario: Dict[str, Any], profile: Dict[str, Any]
) -> Dict[str, Any]:
    """Personalize a preset without changing the scenario's core story."""
    personalized = dict(scenario)
    occupants = max(1, min(10, int(profile.get("occupants", 3))))
    home_type = str(
        profile.get("home_type", profile.get("homeType", "Apartment"))
    ).lower()
    occupancy_factor = max(0.75, min(1.5, 0.72 + occupants * 0.1))
    home_factor = 1.14 if "villa" in home_type else 1.0
    personalized["lighting"] *= occupancy_factor * home_factor
    personalized["other_base"] *= occupancy_factor * home_factor
    personalized["cooking"] *= occupancy_factor
    personalized["heater_minutes"] *= occupancy_factor
    personalized["fridges"] = max(
        personalized.get("fridges", 1), 2 if occupants >= 6 else 1
    )
    if "villa" in home_type:
        personalized["ac_power"] *= 1.08
    profile_appliances = list(DEFAULT_APPLIANCES.get(household_id, []))
    if "villa" in home_type and "pool_pump" not in profile_appliances:
        profile_appliances.append("pool_pump")
    if "villa" not in home_type:
        profile_appliances = [
            appliance
            for appliance in profile_appliances
            if appliance != "pool_pump"
        ]
        personalized["label"] = personalized["label"].replace(
            "at the villa", "at home"
        ).replace("villa", "home")
    personalized["appliances"] = profile_appliances
    return personalized

def generate_synthetic_household(
    household_id: str = "high-ac-home",
    duration_minutes: int = 60,
    interval_seconds: int = 60,
    start_time: Optional[datetime] = None,
    scenario_id: Optional[str] = None,
    custom_conditions: Optional[Dict[str, Any]] = None,
    profile: Optional[Dict[str, Any]] = None,
    seed: Optional[int] = None,
) -> pd.DataFrame:
    """
    Generates a synthetic aggregate power signal for a fake household matching real dataset format.

    Behaviors:
    - fridge: constant cycling baseline (~100W duty cycle, 20 mins on / 20 mins off)
    - lighting: evening bump (~150W peak between 18:00 and 23:00)
    - ac_hvac: high compressor cycling (~1600W on/off) if household_id contains 'ac' or 'high-ac-home'
    - other: random intermittent load spikes (e.g., microwave/kettle spikes 200W - 1500W)
    - mains_power: sum of fridge + lighting + ac_hvac + other + baseline ambient noise (~30W)
    """
    scenario = next_household_scenario(household_id, scenario_id)
    base_scenario_id = scenario["id"]
    if custom_conditions:
        scenario = customize_scenario(
            household_id, scenario, custom_conditions, profile
        )
    elif profile:
        scenario = apply_profile_to_scenario(household_id, scenario, profile)
    selected_appliances = set(
        scenario.get("appliances", DEFAULT_APPLIANCES.get(household_id, []))
    )
    actual_seed = int(seed if seed is not None else np.random.default_rng().integers(1, 2_147_483_647))
    rng = np.random.default_rng(actual_seed)
    if start_time is None:
        start_time = (
            datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            if duration_minutes >= 1440
            else datetime.utcnow() - timedelta(minutes=duration_minutes)
        )

    timestamps = [start_time + timedelta(seconds=i * interval_seconds) for i in range(duration_minutes)]

    fridge_power = []
    lighting_power = []
    ac_hvac_power = []
    other_power = []
    mains_power = []
    extra_appliance_values = {
        "water_heater": [],
        "washing_machine": [],
        "oven": [],
        "dishwasher": [],
        "electronics": [],
        "pool_pump": [],
    }

    for dt in timestamps:
        minute_of_hour = dt.minute
        hour = dt.hour
        fridge_power_rating = scenario.get("fridge_power", 100.0)
        fridge_count = scenario.get("fridges", 1)
        is_fridge_on = (minute_of_hour % 40) < 22
        f_p = (
            fridge_power_rating * fridge_count + rng.normal(0, 4)
            if is_fridge_on
            else 5.0 * fridge_count + rng.normal(0, 0.8)
        )
        f_p = max(0.0, f_p)

        lighting_factor = scenario.get("lighting", 1.0)
        if 18 <= hour <= 23:
            l_p = 150.0 * lighting_factor + rng.normal(0, 8)
        elif 6 <= hour <= 8:
            l_p = 55.0 * lighting_factor + rng.normal(0, 4)
        else:
            l_p = 8.0 * lighting_factor + rng.normal(0, 1.5)
        l_p = max(0.0, l_p)

        if hour in scenario["ac_hours"]:
            is_ac_on = minute_of_hour < int(60 * scenario["ac_duty"])
            ac_p = (
                scenario["ac_power"] + rng.normal(0, 45)
                if is_ac_on
                else 15.0
            )
        else:
            ac_p = 0.0
        ac_p = max(0.0, ac_p)

        o_p = scenario["other_base"] + rng.uniform(-15.0, 20.0)
        if hour in (7, 8, 13, 14, 19, 20):
            cooking_active = minute_of_hour < int(18 * scenario["cooking"])
            if cooking_active:
                o_p += rng.uniform(250.0, 600.0)
        heater_minutes = scenario["heater_minutes"]
        water_heater_p = (
            1600.0
            if hour in (6, 20) and minute_of_hour < min(59, heater_minutes / 2)
            else 0.0
        )
        washing_p = 500.0 if "washing_machine" in selected_appliances and hour == 10 and minute_of_hour < 45 else 0.0
        oven_p = 1800.0 if "oven" in selected_appliances and hour == 19 and minute_of_hour < 45 else 0.0
        dishwasher_p = 1200.0 if "dishwasher" in selected_appliances and hour == 21 else 0.0
        electronics_p = (90.0 if 9 <= hour <= 23 else 20.0) if "electronics" in selected_appliances else 0.0
        pool_pump_p = 900.0 if "pool_pump" in selected_appliances and 8 <= hour < 11 else 0.0
        if rng.random() < scenario.get("spike_chance", 0.012):
            o_p += rng.uniform(500.0, 1700.0)

        ambient = 25.0 + rng.normal(0, 2)

        tot_mains = (
            f_p + l_p + ac_p + water_heater_p + washing_p + oven_p
            + dishwasher_p + electronics_p + pool_pump_p + o_p + ambient
        )

        fridge_power.append(round(f_p, 2))
        lighting_power.append(round(l_p, 2))
        ac_hvac_power.append(round(ac_p, 2))
        other_power.append(round(o_p, 2))
        mains_power.append(round(tot_mains, 2))

        # Extra simulated categories are retained as columns and returned in
        # the API's appliance map for transparent demo-only disaggregation.
        extra_appliance_values["water_heater"].append(round(water_heater_p, 2))
        extra_appliance_values["washing_machine"].append(round(washing_p, 2))
        extra_appliance_values["oven"].append(round(oven_p, 2))
        extra_appliance_values["dishwasher"].append(round(dishwasher_p, 2))
        extra_appliance_values["electronics"].append(round(electronics_p, 2))
        extra_appliance_values["pool_pump"].append(round(pool_pump_p, 2))

    df = pd.DataFrame({
        "timestamp": [dt.strftime("%Y-%m-%dT%H:%M:%SZ") for dt in timestamps],
        "house_id": household_id,
        "mains_power": mains_power,
        "fridge": fridge_power,
        "lighting": lighting_power,
        "ac_hvac": ac_hvac_power,
        "other": other_power,
        **extra_appliance_values,
    })

    df.attrs["scenario_id"] = scenario["id"]
    df.attrs["scenario_label"] = scenario["label"]
    df.attrs["seed"] = actual_seed
    df.attrs["configuration"] = {
        "mode": "custom" if custom_conditions else ("preset" if scenario_id else "surprise"),
        "scenario_id": scenario["id"],
        "base_scenario_id": base_scenario_id,
        "scenario_label": scenario["label"],
        "conditions": custom_conditions or {},
        "profile_applied": bool(profile),
        "profile_snapshot": (
            {
                "home_type": profile.get("home_type", profile.get("homeType")),
                "occupants": profile.get("occupants"),
                "location": profile.get("location"),
            }
            if profile
            else None
        ),
        "selected_appliances": sorted(selected_appliances),
    }
    ac_start = next(iter(scenario["ac_hours"]), None)
    events = [
        {"time": "00:00", "title": "Baseline monitoring started", "detail": "Refrigeration and standby loads continue overnight."},
        {"time": "06:00", "title": "Morning hot-water demand", "detail": "Water heating and the morning routine increased demand."},
    ]
    if ac_start is not None:
        events.append({"time": f"{ac_start:02d}:00", "title": "Cooling period started", "detail": f"AC ran for the {scenario['label'].lower()} conditions."})
    if "washing_machine" in selected_appliances:
        events.append({"time": "10:00", "title": "Laundry cycle", "detail": "The washing machine added a short appliance load."})
    if "pool_pump" in selected_appliances:
        events.append({"time": "11:00", "title": "Pool pump cycle completed", "detail": "The villa pool pump ran for three hours."})
    if "oven" in selected_appliances:
        events.append({"time": "19:00", "title": "Evening cooking peak", "detail": "Cooking, lighting, and occupancy overlapped."})
    if "dishwasher" in selected_appliances:
        events.append({"time": "21:00", "title": "Dishwasher cycle", "detail": "The dishwasher ran after the evening meal."})
    df.attrs["events"] = sorted(events, key=lambda event: event["time"])

    return df


if __name__ == "__main__":
    df_sim = generate_synthetic_household("high-ac-home", duration_minutes=15)
    print("Generated High-AC Household Signals (first 5 rows):")
    print(df_sim.head())
