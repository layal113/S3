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


def test_household_scenarios_are_distinct_and_replayable():
    efficient = generate_synthetic_household(
        "efficient-flat", 1440, scenario_id="away-day", seed=120
    )
    villa = generate_synthetic_household(
        "family-villa", 1440, scenario_id="hot-weekend", seed=120
    )
    replay = generate_synthetic_household(
        "family-villa", 1440, scenario_id="hot-weekend", seed=120
    )

    assert villa["mains_power"].sum() > efficient["mains_power"].sum() * 2
    assert villa["mains_power"].equals(replay["mains_power"])


def test_saved_profile_changes_preset_without_changing_its_identity():
    plain = generate_synthetic_household(
        "family-villa", 1440, scenario_id="school-day", seed=314
    )
    personalized = generate_synthetic_household(
        "family-villa",
        1440,
        scenario_id="school-day",
        profile={"homeType": "Villa", "occupants": 7, "location": "Giza"},
        seed=314,
    )

    assert personalized.attrs["configuration"]["profile_applied"] is True
    assert personalized.attrs["configuration"]["base_scenario_id"] == "school-day"
    assert personalized["mains_power"].sum() > plain["mains_power"].sum()
