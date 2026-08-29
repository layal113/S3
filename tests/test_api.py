from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app, raise_server_exceptions=False)


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "Miqyas" in data["service"]


def test_simulate_usage():
    response = client.post("/simulate-usage", json={"household_id": "demo-home", "duration_minutes": 30})
    assert response.status_code == 200
    data = response.json()
    assert data["readingCount"] == 30
    assert len(data["readings"]) == 30


def test_get_breakdown_fallback():
    response = client.get("/get-breakdown")
    assert response.status_code == 200
    data = response.json()
    assert "applianceBreakdown" in data
    assert len(data["applianceBreakdown"]) > 0


def test_get_breakdown_post_valid_window():
    readings = [{"timestamp": f"2023-01-01T12:{i:02d}:00Z", "mains_power": 350.0 + i * 2} for i in range(20)]
    response = client.post("/get-breakdown", json={"householdId": "demo-home", "readings": readings})
    assert response.status_code == 200
    data = response.json()
    assert "applianceBreakdown" in data
    assert len(data["applianceBreakdown"]) == 6


def test_get_breakdown_post_insufficient_readings():
    readings = [{"timestamp": f"2023-01-01T12:{i:02d}:00Z", "mains_power": 350.0} for i in range(5)]
    response = client.post("/get-breakdown", json={"householdId": "demo-home", "readings": readings})
    assert response.status_code == 400
    assert "minimum window size" in response.json()["detail"]


def test_dashboard_endpoint():
    response = client.get("/v1/households/high-ac-home/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert data["householdId"] == "high-ac-home"
    assert "tariffStatus" in data or "tariff_status" in data
    assert "applianceBreakdown" in data or "appliance_breakdown" in data
    assert "recommendation" in data
    assert "currentConsumptionKwh" in data or "current_consumption_kwh" in data
