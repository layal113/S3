from fastapi.testclient import TestClient
from api.main import app
import json

client = TestClient(app)

def test_endpoints():
    print("Testing root endpoint '/'...")
    r = client.get("/")
    assert r.status_code == 200, r.text
    print("Root OK:", r.json())

    print("\nTesting '/simulate-usage'...")
    r = client.post("/simulate-usage", json={"household_id": "demo-home", "duration_minutes": 30})
    assert r.status_code == 200, r.text
    sim_data = r.json()
    print("Simulate Usage OK. Reading count:", sim_data["readingCount"])

    print("\nTesting '/get-breakdown' GET demo fallback...")
    r = client.get("/get-breakdown")
    assert r.status_code == 200, r.text
    breakdown = r.json()
    print("GET Breakdown OK:")
    print(json.dumps(breakdown, indent=2))

    print("\nTesting '/get-breakdown' POST with 20 readings...")
    readings = [{"timestamp": f"2023-01-01T12:{i:02d}:00Z", "mains_power": 350.0 + i * 2} for i in range(20)]
    r = client.post("/get-breakdown", json={"householdId": "demo-home", "readings": readings})
    assert r.status_code == 200, r.text
    post_breakdown = r.json()
    print("POST Breakdown OK:", len(post_breakdown["applianceBreakdown"]), "appliance items.")

    print("\nTesting '/get-breakdown' POST with invalid window size (<15 readings)...")
    invalid_readings = [{"timestamp": f"2023-01-01T12:{i:02d}:00Z", "mains_power": 350.0} for i in range(5)]
    r = client.post("/get-breakdown", json={"householdId": "demo-home", "readings": invalid_readings})
    assert r.status_code == 400, "Expected 400 error for <15 readings window"
    print("Window size validation OK (received 400 error as expected):", r.json()["detail"])

    print("\nTesting REST client endpoint '/v1/households/high-ac-home/dashboard'...")
    r = client.get("/v1/households/high-ac-home/dashboard")
    assert r.status_code == 200, r.text
    dashboard = r.json()
    print("Dashboard Endpoint OK. Household Name:", dashboard["householdName"])

    print("\nALL API ENDPOINT TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_endpoints()
