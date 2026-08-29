import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

def generate_synthetic_household(
    household_id: str = "high-ac-home",
    duration_minutes: int = 60,
    interval_seconds: int = 60,
    start_time: Optional[datetime] = None,
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
    if start_time is None:
        start_time = datetime.utcnow() - timedelta(minutes=duration_minutes)

    timestamps = [start_time + timedelta(seconds=i * interval_seconds) for i in range(duration_minutes)]

    fridge_power = []
    lighting_power = []
    ac_hvac_power = []
    other_power = []
    mains_power = []

    is_ac_home = "ac" in household_id.lower() or household_id == "high-ac-home"

    for dt in timestamps:
        # 1. Fridge: cycling 20 min on (100W), 20 min off (5W standby)
        minute_of_hour = dt.minute
        is_fridge_on = (minute_of_hour % 40) < 20
        f_p = 100.0 + np.random.normal(0, 3) if is_fridge_on else 5.0 + np.random.normal(0, 0.5)
        f_p = max(0.0, f_p)

        # 2. Lighting: evening bump between 18:00 and 23:00 (150W peak), low rest of day (10W)
        hour = dt.hour
        if 18 <= hour <= 23:
            l_p = 150.0 + np.random.normal(0, 10)
        elif 6 <= hour <= 8:
            l_p = 60.0 + np.random.normal(0, 5)
        else:
            l_p = 10.0 + np.random.normal(0, 2)
        l_p = max(0.0, l_p)

        # 3. AC/HVAC: high compressor cycling (~1600W 15 mins on / 15 mins off for high-ac-home)
        if is_ac_home:
            is_ac_on = (minute_of_hour % 30) < 15
            ac_p = 1600.0 + np.random.normal(0, 50) if is_ac_on else 15.0
        else:
            ac_p = 0.0
        ac_p = max(0.0, ac_p)

        # 4. Other: intermittent spikes
        if np.random.rand() < 0.08:
            o_p = np.random.uniform(400.0, 1800.0)
        else:
            o_p = np.random.uniform(40.0, 120.0)

        # Baseline background standby power
        ambient = 30.0 + np.random.normal(0, 2)

        tot_mains = f_p + l_p + ac_p + o_p + ambient

        fridge_power.append(round(f_p, 2))
        lighting_power.append(round(l_p, 2))
        ac_hvac_power.append(round(ac_p, 2))
        other_power.append(round(o_p, 2))
        mains_power.append(round(tot_mains, 2))

    df = pd.DataFrame({
        "timestamp": [dt.strftime("%Y-%m-%dT%H:%M:%SZ") for dt in timestamps],
        "house_id": household_id,
        "mains_power": mains_power,
        "fridge": fridge_power,
        "lighting": lighting_power,
        "ac_hvac": ac_hvac_power,
        "other": other_power,
    })

    return df


if __name__ == "__main__":
    df_sim = generate_synthetic_household("high-ac-home", duration_minutes=15)
    print("Generated High-AC Household Signals (first 5 rows):")
    print(df_sim.head())
