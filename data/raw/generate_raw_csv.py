import pandas as pd
import numpy as np
from pathlib import Path

# Seed for reproducibility
np.random.seed(42)

n_rows = 1000
houses = [f"UKDALE_house_{i}" for i in range(1, 6)]
categories = ["fridge", "lighting", "other", "water"]  # "water" has zero matching appliances as specified
appliances_map = {
    "fridge": ["fridge", "freezer"],
    "lighting": ["lighting"],
    "other": ["kettle", "microwave", "washing_machine", "dishwasher", "tv", "computer"],
    "water": [] # zero matching appliances for water
}

# Generate timestamps with mixed UTC offsets (+00:00 / +01:00)
base_dates = pd.date_range("2023-01-01 00:00:00", periods=n_rows, freq="min")
timestamps = []
for i, dt in enumerate(base_dates):
    # Half the dataset in winter (+00:00), half in summer (+01:00)
    offset = "+01:00" if i % 2 == 0 else "+00:00"
    timestamps.append(dt.strftime("%Y-%m-%dT%H:%M:%S") + offset)

house_ids = np.random.choice(houses, size=n_rows)
buildings = [f"bldg_{h.split('_')[-1]}" for h in house_ids]
meters = [f"meter_{np.random.randint(1, 10)}" for _ in range(n_rows)]

# Category choices (mostly fridge, lighting, other; water appears with missing appliance)
category_choices = np.random.choice(["fridge", "lighting", "other", "water"], size=n_rows, p=[0.35, 0.25, 0.35, 0.05])
appliances = []
for cat in category_choices:
    if cat == "water" or len(appliances_map[cat]) == 0:
        appliances.append("unspecified_water_meter")
    else:
        appliances.append(np.random.choice(appliances_map[cat]))

# Powers
mains_powers = np.random.uniform(50.0, 2500.0, size=n_rows)
appliance_powers = []
for cat, mains in zip(category_choices, mains_powers):
    if cat == "fridge":
        appliance_powers.append(np.random.uniform(30.0, 150.0))
    elif cat == "lighting":
        appliance_powers.append(np.random.uniform(20.0, 200.0))
    elif cat == "other":
        appliance_powers.append(np.random.uniform(50.0, 1800.0))
    else:
        appliance_powers.append(0.0)

# Introduce quality flags and missing values exactly as specified:
# 25 missing mains_power, 147 missing appliance_power (aligning with data_quality_flag == 'gap')
flags = ["good"] * n_rows
# Select 147 gap indices
gap_indices = np.random.choice(n_rows, size=147, replace=False)
for idx in gap_indices:
    flags[idx] = "gap"
    appliance_powers[idx] = np.nan

# 25 of those gap indices also missing mains_power
mains_gap_indices = gap_indices[:25]
for idx in mains_gap_indices:
    mains_powers[idx] = np.nan

df = pd.DataFrame({
    "timestamp": timestamps,
    "house_id": house_ids,
    "building": buildings,
    "meter": meters,
    "appliance_category": category_choices,
    "appliance": appliances,
    "mains_power": mains_powers,
    "appliance_power": appliance_powers,
    "data_quality_flag": flags
})

raw_dir = Path("a:/S3/data/raw")
raw_dir.mkdir(parents=True, exist_ok=True)
df.to_csv(raw_dir / "ukdale_unified.csv", index=False)
print(f"Generated raw UK-DALE dataset with {len(df)} rows at {raw_dir / 'ukdale_unified.csv'}")
