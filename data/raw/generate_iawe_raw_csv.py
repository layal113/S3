import pandas as pd
import numpy as np
from pathlib import Path

# Seed for reproducibility
np.random.seed(101)

n_rows = 1000
houses = ["IAWE_house_1", "IAWE_house_2"]
categories = ["air_conditioner_1", "air_conditioner_2", "fridge", "lighting", "other"]

base_dates = pd.date_range("2023-06-01 00:00:00", periods=n_rows, freq="min")
timestamps = [dt.strftime("%Y-%m-%dT%H:%M:%SZ") for dt in base_dates]

house_ids = np.random.choice(houses, size=n_rows)
category_choices = np.random.choice(
    ["air_conditioner_1", "air_conditioner_2", "fridge", "lighting", "other"],
    size=n_rows,
    p=[0.25, 0.20, 0.20, 0.15, 0.20]
)

appliance_powers = []
mains_powers = []

for cat in category_choices:
    if cat in ["air_conditioner_1", "air_conditioner_2"]:
        # AC power: 1200W to 2200W when running
        is_on = np.random.rand() > 0.3
        p = np.random.uniform(1200.0, 2200.0) if is_on else 0.0
        m = p + np.random.uniform(100.0, 500.0)
    elif cat == "fridge":
        is_on = np.random.rand() > 0.4
        p = np.random.uniform(80.0, 150.0) if is_on else 5.0
        m = p + np.random.uniform(50.0, 200.0)
    elif cat == "lighting":
        is_on = np.random.rand() > 0.5
        p = np.random.uniform(40.0, 150.0) if is_on else 0.0
        m = p + np.random.uniform(50.0, 300.0)
    else:
        p = np.random.uniform(100.0, 800.0)
        m = p + np.random.uniform(100.0, 400.0)

    appliance_powers.append(round(p, 2))
    mains_powers.append(round(m, 2))

df = pd.DataFrame({
    "timestamp": timestamps,
    "house_id": house_ids,
    "building": ["bldg_iawe_1" if h == "IAWE_house_1" else "bldg_iawe_2" for h in house_ids],
    "meter": ["meter_iawe"] * n_rows,
    "appliance_category": category_choices,
    "appliance": ["air_conditioner" if "air_conditioner" in cat else cat for cat in category_choices],
    "mains_power": mains_powers,
    "appliance_power": appliance_powers,
    "data_quality_flag": ["good"] * n_rows
})

raw_dir = Path("a:/S3/data/raw")
raw_dir.mkdir(parents=True, exist_ok=True)
df.to_csv(raw_dir / "iawe_unified.csv", index=False)
print(f"Generated raw IAWE dataset with {len(df)} rows at {raw_dir / 'iawe_unified.csv'}")
