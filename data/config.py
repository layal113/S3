import os
from pathlib import Path

# Base data directory
DATA_DIR = Path(__file__).resolve().parent

RAW_UKDALE_DATA_PATH = DATA_DIR / "raw" / "ukdale_unified.csv"
PROCESSED_UKDALE_DATA_PATH = DATA_DIR / "processed" / "ukdale_unified_fixed.csv"

RAW_IAWE_DATA_PATH = DATA_DIR / "raw" / "iawe_unified.csv"
PROCESSED_IAWE_DATA_PATH = DATA_DIR / "processed" / "iawe_unified_fixed.csv"

# Active dataset paths configuration - includes both UK-DALE and IAWE datasets
ACTIVE_DATASET_PATHS = [
    PROCESSED_UKDALE_DATA_PATH,
    PROCESSED_IAWE_DATA_PATH,
]

# Standard ML Appliance Category Taxonomy (internal keys matching dataset)
INTERNAL_CATEGORY_FRIDGE = "fridge"
INTERNAL_CATEGORY_LIGHTING = "lighting"
INTERNAL_CATEGORY_OTHER = "other"
INTERNAL_CATEGORY_AC_HVAC = "ac_hvac"
INTERNAL_CATEGORY_WATER_HEATER = "water_heater"

# Full taxonomy list supported by the system
SUPPORTED_CATEGORIES = [
    INTERNAL_CATEGORY_FRIDGE,
    INTERNAL_CATEGORY_LIGHTING,
    INTERNAL_CATEGORY_OTHER,
    INTERNAL_CATEGORY_AC_HVAC,
    INTERNAL_CATEGORY_WATER_HEATER,
]

# Display names for UI presentation
CATEGORY_DISPLAY_NAMES = {
    INTERNAL_CATEGORY_FRIDGE: "Refrigerator",
    INTERNAL_CATEGORY_LIGHTING: "Lighting",
    INTERNAL_CATEGORY_OTHER: "Other/unclassified",
    INTERNAL_CATEGORY_AC_HVAC: "Air conditioner",
    INTERNAL_CATEGORY_WATER_HEATER: "Water heater",
}

# Raw dataset category mapping to taxonomy (including IAWE air_conditioner_1/2)
RAW_CATEGORY_MAP = {
    "fridge": INTERNAL_CATEGORY_FRIDGE,
    "refrigerator": INTERNAL_CATEGORY_FRIDGE,
    "freezer": INTERNAL_CATEGORY_FRIDGE,
    "lighting": INTERNAL_CATEGORY_LIGHTING,
    "lights": INTERNAL_CATEGORY_LIGHTING,
    "other": INTERNAL_CATEGORY_OTHER,
    "ac": INTERNAL_CATEGORY_AC_HVAC,
    "hvac": INTERNAL_CATEGORY_AC_HVAC,
    "ac_hvac": INTERNAL_CATEGORY_AC_HVAC,
    "air_conditioner": INTERNAL_CATEGORY_AC_HVAC,
    "air_conditioner_1": INTERNAL_CATEGORY_AC_HVAC,
    "air_conditioner_2": INTERNAL_CATEGORY_AC_HVAC,
    "water": INTERNAL_CATEGORY_WATER_HEATER,  # Note: UK-DALE/IAWE have zero valid appliances for water
    "water_heater": INTERNAL_CATEGORY_WATER_HEATER,
}

# Threshold for binary appliance state classification (in Watts)
APPLIANCE_ON_THRESHOLD_W = 10.0

# Minimum window size required for feature engineering (15 minutes of 1-minute samples)
MINIMUM_FEATURE_WINDOW_SIZE = 15

# Model artifacts directory
ARTIFACTS_DIR = DATA_DIR.parent / "model" / "artifacts"
