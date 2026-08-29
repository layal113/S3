from fastapi.testclient import TestClient
from api.main import app

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
