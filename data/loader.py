import os
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Tuple, List

from data.config import (
    RAW_DATA_PATH,
    PROCESSED_DATA_PATH,
    ACTIVE_DATASET_PATHS,
    RAW_CATEGORY_MAP,
    SUPPORTED_CATEGORIES,
)


def preprocess_raw_dataset(
    raw_path: Path = RAW_DATA_PATH,
    processed_path: Path = PROCESSED_DATA_PATH,
) -> Tuple[pd.DataFrame, int]:
    """
    Reads raw UK-DALE dataset, processes timestamps to uniform UTC, cleans data quality gaps,
    drops redundant identifier columns ('building', 'meter'), remaps taxonomy keys, and
    saves the output to processed_path.

    Returns:
        Tuple[pd.DataFrame, int]: (processed_dataframe, excluded_gap_rows_count)
    """
    if not raw_path.exists():
        raise FileNotFoundError(f"Raw dataset file not found at {raw_path}")

    df = pd.read_csv(raw_path)
    initial_row_count = len(df)

    # 1. Convert all timestamps to uniform UTC timezone
    # Handles mixed offsets (+00:00 / +01:00) cleanly
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)

    # 2. Exclude rows flagged as "gap" or containing missing power values
    # mains_power missing or appliance_power missing align with data_quality_flag == 'gap'
    gap_mask = (
        (df["data_quality_flag"] == "gap")
        | df["mains_power"].isna()
        | df["appliance_power"].isna()
    )
    excluded_gap_rows = int(gap_mask.sum())
    clean_df = df[~gap_mask].copy()

    # 3. Drop redundant identifier columns
    cols_to_drop = [c for c in ["building", "meter"] if c in clean_df.columns]
    if cols_to_drop:
        clean_df = clean_df.drop(columns=cols_to_drop)

    # 4. Remap appliance category to standard internal ML taxonomy
    clean_df["appliance_category"] = clean_df["appliance_category"].map(
        lambda cat: RAW_CATEGORY_MAP.get(str(cat).lower(), "other")
    )

    # Save to processed path
    processed_path.parent.mkdir(parents=True, exist_ok=True)
    clean_df.to_csv(processed_path, index=False)
    print(
        f"[data/loader.py] Preprocessed {initial_row_count} raw rows -> {len(clean_df)} clean rows saved to {processed_path}. Excluded {excluded_gap_rows} gap rows."
    )

    return clean_df, excluded_gap_rows


def load_active_datasets(
    active_paths: List[Path] = ACTIVE_DATASET_PATHS,
) -> Tuple[pd.DataFrame, int]:
    """
    Loads and concatenates all active datasets specified in ACTIVE_DATASET_PATHS into one DataFrame.
    Ensures processed file exists, triggering preprocessing if necessary.

    Returns:
        Tuple[pd.DataFrame, int]: (concatenated_df, total_excluded_gap_rows)
    """
    total_excluded = 0

    # Ensure processed file exists
    if PROCESSED_DATA_PATH not in active_paths and not PROCESSED_DATA_PATH.exists():
        if RAW_DATA_PATH.exists():
            _, total_excluded = preprocess_raw_dataset(RAW_DATA_PATH, PROCESSED_DATA_PATH)

    dfs = []
    for path in active_paths:
        if not path.exists():
            if path == PROCESSED_DATA_PATH and RAW_DATA_PATH.exists():
                _, total_excluded = preprocess_raw_dataset(RAW_DATA_PATH, PROCESSED_DATA_PATH)
            else:
                print(f"[data/loader.py] Warning: Active dataset path {path} does not exist. Skipping.")
                continue
        df_part = pd.read_csv(path)
        # Ensure UTC datetime parsing
        df_part["timestamp"] = pd.to_datetime(df_part["timestamp"], utc=True)
        dfs.append(df_part)

    if not dfs:
        raise RuntimeError("No active datasets could be loaded.")

    combined_df = pd.concat(dfs, ignore_index=True)
    # Sort by timestamp
    combined_df = combined_df.sort_values(by="timestamp").reset_index(drop=True)

    print(f"[data/loader.py] Successfully loaded {len(combined_df)} rows from {len(dfs)} active dataset(s).")
    return combined_df, total_excluded


if __name__ == "__main__":
    # Test loader and preprocessing
    preprocess_raw_dataset()
    df, excluded = load_active_datasets()
    print("Columns:", df.columns.tolist())
    print("Houses:", df["house_id"].unique().tolist())
    print("Categories:", df["appliance_category"].value_counts().to_dict())
