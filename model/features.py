import pandas as pd
import numpy as np
from typing import List, Tuple

# Exported feature list used consistently across training and real-time inference
FEATURE_COLUMNS: List[str] = [
    "power_w",
    "power_delta",
    "rolling_mean_5m",
    "rolling_std_5m",
    "rolling_mean_15m",
    "rolling_std_15m",
    "hour_of_day",
    "day_of_week",
]

def extract_features(
    input_df: pd.DataFrame,
    power_column: str = "mains_power",
    timestamp_column: str = "timestamp",
) -> pd.DataFrame:
    """
    Shared feature engineering pipeline importable by both train.py and predict.py.

    Args:
        input_df (pd.DataFrame): Input dataframe containing timestamps and aggregate power.
        power_column (str): Name of the column containing aggregate power in Watts.
        timestamp_column (str): Name of the column containing UTC timestamps.

    Returns:
        pd.DataFrame: Dataframe containing engineered feature columns matching FEATURE_COLUMNS.
    """
    df = input_df.copy()

    # Ensure timestamp is parsed as datetime UTC
    if not pd.api.types.is_datetime64_any_dtype(df[timestamp_column]):
        df[timestamp_column] = pd.to_datetime(df[timestamp_column], utc=True)
    elif df[timestamp_column].dt.tz is None:
        df[timestamp_column] = df[timestamp_column].dt.tz_localize("UTC")
    else:
        df[timestamp_column] = df[timestamp_column].dt.tz_convert("UTC")

    # Base power in Watts
    df["power_w"] = df[power_column].astype(float)

    # 1. Power delta (change from previous minute reading)
    df["power_delta"] = df["power_w"].diff().fillna(0.0)

    # 2. Rolling window statistics (5-minute and 15-minute windows)
    df["rolling_mean_5m"] = df["power_w"].rolling(window=5, min_periods=1).mean()
    df["rolling_std_5m"] = df["power_w"].rolling(window=5, min_periods=1).std().fillna(0.0)

    df["rolling_mean_15m"] = df["power_w"].rolling(window=15, min_periods=1).mean()
    df["rolling_std_15m"] = df["power_w"].rolling(window=15, min_periods=1).std().fillna(0.0)

    # 3. Temporal features derived from uniform UTC timestamp
    df["hour_of_day"] = df[timestamp_column].dt.hour
    df["day_of_week"] = df[timestamp_column].dt.dayofweek

    # Clean any remaining NaNs or infinite values
    feature_df = df[FEATURE_COLUMNS].copy()
    feature_df = feature_df.replace([np.inf, -np.inf], np.nan)
    feature_df = feature_df.bfill().ffill().fillna(0.0)

    return feature_df
