from fastapi.testclient import TestClient
from api.main import app, calculate_residential_bill, calculate_tariff_status

client = TestClient(app, raise_server_exceptions=False)


def test_simulate_usage_returns_readings():
    response = client.post(
        "/simulate-usage",
        json={
            "household_id": "test-household",
            "duration_minutes": 20,
            "interval_seconds": 60,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["readingCount"] > 0
    assert len(data["readings"]) == data["readingCount"]


def test_breakdown_percentages_sum_to_100():
    sim = client.post(
        "/simulate-usage",
        json={
            "household_id": "test-household",
            "duration_minutes": 20,
            "interval_seconds": 60,
        },
    ).json()
    response = client.post("/get-breakdown", json={"readings": sim["readings"]})
    assert response.status_code == 200
    data = response.json()
    total_share = sum(item["sharePercent"] for item in data["applianceBreakdown"])
    assert abs(total_share - 100.0) < 0.5  # allow small floating point tolerance


def test_untrained_category_is_flagged_honestly():
    sim = client.post(
        "/simulate-usage",
        json={
            "household_id": "test-household",
            "duration_minutes": 20,
            "interval_seconds": 60,
        },
    ).json()
    response = client.post("/get-breakdown", json={"readings": sim["readings"]})
    assert response.status_code == 200
    data = response.json()
    water_heater_item = next(
        item for item in data["applianceBreakdown"]
        if item["internalCategory"] == "water_heater"
    )
    assert water_heater_item["notYetTrained"] is True
    assert water_heater_item["modelScore"] == 0.0


def test_breakdown_rejects_too_few_readings():
    response = client.post(
        "/get-breakdown",
        json={"readings": [{"timestamp": "2026-01-01T00:00:00Z", "mainsPower": 200}]},
    )
    assert response.status_code in (400, 422)  # should reject, not silently produce garbage


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "Miqyas" in data["service"]


def test_dashboard_endpoint():
    response = client.get("/v1/households/high-ac-home/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert data["householdId"] == "high-ac-home"
    assert "tariffStatus" in data
    assert "applianceBreakdown" in data
    assert "recommendation" in data


def test_insights_reconcile_with_dashboard_and_appliance_rows():
    dashboard = client.get("/v1/households/family-villa/dashboard").json()

    for period in ("7d", "4w", "6m"):
        response = client.get(
            "/v1/households/family-villa/usage/history",
            params={"period": period},
        )
        assert response.status_code == 200
        history = response.json()
        assert history["householdId"] == dashboard["householdId"]
        assert history["billingCycleKwh"] == dashboard["currentConsumptionKwh"]
        assert history["billingCycleCostEgp"] == dashboard["currentEstimatedCostEgp"]
        assert history["projectedMonthlyKwh"] == dashboard["projectedMonthlyKwh"]
        assert history["projectedMonthlyCostEgp"] == dashboard["predictedMonthEndBillEgp"]
        for point in history["points"]:
            appliance_kwh = sum(item["kWh"] for item in point["appliances"].values())
            appliance_cost = sum(
                item["costEGP"] for item in point["appliances"].values()
            )
            assert abs(appliance_kwh - point["totalKWh"]) < 0.02
            assert abs(appliance_cost - point["estimatedCostEGP"]) < 0.02


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["models_loaded"] is True


def test_tariff_tiers_use_inclusive_upper_boundaries():
    usages = [50, 51, 100, 101, 200, 201, 350, 351, 650, 651, 1000, 1001]
    expected = [1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7]

    assert [calculate_tariff_status(value, value).current_tier for value in usages] == expected


def test_residential_bill_uses_tiered_prices_and_highest_band():
    assert calculate_residential_bill(50) == 35.0
    assert calculate_residential_bill(650) == 1022.5
    assert calculate_residential_bill(1001) == 2622.58
