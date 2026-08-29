from simulator.generate_household import generate_synthetic_household
import pandas as pd


def test_generate_synthetic_household():
    df = generate_synthetic_household(
        household_id="test-house",
        duration_minutes=30,
        interval_seconds=60,
    )
    assert isinstance(df, pd.DataFrame)
    assert len(df) == 30
    assert "timestamp" in df.columns
    assert "mains_power" in df.columns
    assert "fridge" in df.columns
    assert "lighting" in df.columns
    assert (df["mains_power"] >= 0).all()
