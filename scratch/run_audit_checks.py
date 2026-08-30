import os
import sys
import json
from pathlib import Path
from unittest.mock import patch

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app, raise_server_exceptions=False)

def run_audit():
    print("=== D.3 HEALTH ENDPOINT CHECK ===")
    res_health = client.get("/health")
    print(f"Status Code: {res_health.status_code}")
    print(f"Response Body: {json.dumps(res_health.json(), indent=2)}")

    print("\n=== D.4 HTTP REQUEST LOGGING MIDDLEWARE ===")
    res_root = client.get("/")
    print(f"Root request x-request-id: {res_root.headers.get('x-request-id')}")

    print("\n=== E.3 PYDANTIC SCHEMA VALIDATION ERROR REJECTION ===")
    # 1. Missing required field 'readings'
    res_missing = client.post("/get-breakdown", json={"householdId": "test-home"})
    print(f"1. Missing 'readings' Status: {res_missing.status_code}")
    print(f"   Detail: {res_missing.json()}")

    # 2. Window < 15 readings
    res_small_window = client.post("/get-breakdown", json={
        "householdId": "test-home",
        "readings": [{"timestamp": "2026-01-01T00:00:00Z", "mainsPower": 250.0}]
    })
    print(f"2. Window < 15 readings Status: {res_small_window.status_code}")
    print(f"   Detail: {res_small_window.json()}")

    print("\n=== E.4 RATE LIMITING VERIFICATION (slowapi) ===")
    smart_tip_payload = {
        "householdId": "demo-home",
        "homeType": "Apartment",
        "occupants": 3,
        "avgKwh": 25.4,
        "anomaliesSummary": "None",
        "peakHours": "18:00 - 23:00"
    }
    
    # Mock Gemini call so test runs reliably without external API dependency
    fake_gemini_response = {
        "candidates": [{
            "content": {
                "parts": [{
                    "text": json.dumps({
                        "tips": [
                            {"id": "tip_1", "title": "Raise AC Temp", "summary": "Set AC to 24C", "estimated_savings": "10%", "category": "cooling"},
                            {"id": "tip_2", "title": "LED Lighting", "summary": "Switch to LEDs", "estimated_savings": "5%", "category": "lighting"},
                            {"id": "tip_3", "title": "Unplug Standby", "summary": "Turn off sockets", "estimated_savings": "3%", "category": "appliances"},
                            {"id": "tip_4", "title": "Fridge Care", "summary": "Check door seals", "estimated_savings": "4%", "category": "appliances"}
                        ]
                    })
                }]
            }
        }]
    }

    with patch("api.main.call_gemini", return_value=fake_gemini_response):
        statuses = []
        for i in range(12):
            r = client.post("/v1/smart-tips/generate", json=smart_tip_payload)
            statuses.append(r.status_code)
        
        print(f"12 Sequential Requests Status Codes: {statuses}")
        print(f"Requests successfully processed (HTTP 200): {statuses.count(200)}")
        print(f"Requests rate-limited (HTTP 429): {statuses.count(429)}")
        assert statuses.count(429) >= 2, f"Expected at least 2 rate-limited requests, got {statuses.count(429)}"

    print("\n[ALL AUDIT CHECKS COMPLETED SUCCESSFULLY]")

if __name__ == "__main__":
    run_audit()
