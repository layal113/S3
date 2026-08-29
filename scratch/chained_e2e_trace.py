from fastapi.testclient import TestClient
from api.main import app
import json

client = TestClient(app)

def run_chained_trace():
    # Step 1: Call /simulate-usage
    sim_request_payload = {
        "household_id": "demo-household-trace",
        "duration_minutes": 20,
        "interval_seconds": 60
    }
    sim_response = client.post("/simulate-usage", json=sim_request_payload)
    sim_data = sim_response.json()

    print("=== STEP 1: /simulate-usage RESPONSE ===")
    print(json.dumps(sim_data, indent=2))

    # Step 2: Take simulate-usage readings and feed directly into /get-breakdown
    readings = sim_data["readings"]
    breakdown_request_payload = {
        "householdId": sim_data["householdId"],
        "readings": readings
    }
    breakdown_response = client.post("/get-breakdown", json=breakdown_request_payload)
    breakdown_data = breakdown_response.json()

    print("\n=== STEP 2: /get-breakdown RESPONSE (Chained from /simulate-usage) ===")
    print(json.dumps(breakdown_data, indent=2))

    # Step 3: Take breakdown output and feed into /get-recommendation for exact same household
    rec_response = client.get(f"/get-recommendation?household_id={sim_data['householdId']}")
    rec_data = rec_response.json()

    print("\n=== STEP 3: /get-recommendation RESPONSE ===")
    print(json.dumps(rec_data, indent=2))

if __name__ == "__main__":
    run_chained_trace()
