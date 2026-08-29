import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

# Set test DSN before importing main
TEST_DSN = "https://examplePublicKey@o0.ingest.sentry.io/12345"
os.environ["SENTRY_DSN"] = TEST_DSN

import sentry_sdk
from fastapi.testclient import TestClient

# Import app (which initializes Sentry with SENTRY_DSN)
from api.main import app

client = TestClient(app, raise_server_exceptions=False)

def test_sentry_integration():
    print("=== Testing Sentry Integration in Miqyas FastAPI ===")
    
    # 1. Verify Sentry client is active with configured DSN
    sentry_client = sentry_sdk.get_client()
    assert sentry_client is not None, "Sentry client should be initialized"
    assert sentry_client.dsn == TEST_DSN, f"Expected DSN {TEST_DSN}, got {sentry_client.dsn}"
    print(f"[PASS] Sentry client initialized with DSN: {sentry_client.dsn}")

    # 2. Test Root Endpoint
    res_root = client.get("/")
    assert res_root.status_code == 200
    print("[PASS] Root endpoint accessible: 200 OK")

    # 3. Test Manual Error Capture Endpoint
    with patch.object(sentry_sdk, "capture_exception", wraps=sentry_sdk.capture_exception) as mock_manual:
        res_manual = client.get("/sentry-capture-test")
        assert res_manual.status_code == 200
        res_json = res_manual.json()
        assert res_json["status"] == "captured"
        assert "Miqyas manually triggered test error" in res_json["message"]
        assert res_json["sentry_event_id"] is not None
        assert mock_manual.called
        captured_err = mock_manual.call_args[0][0]
        print(f"[PASS] Manual capture endpoint /sentry-capture-test captured exception: {type(captured_err).__name__}: {captured_err}")
        print(f"       Generated Sentry Event ID: {res_json['sentry_event_id']}")

    # 4. Test Unhandled Exception Capture Endpoint
    # When an unhandled error occurs in FastAPI, the Starlette/FastAPI Sentry integration intercepts it
    with patch.object(sentry_sdk.Hub.current if hasattr(sentry_sdk, "Hub") else sentry_sdk, "capture_exception", wraps=sentry_sdk.capture_exception) as mock_unhandled:
        res_unhandled = client.get("/sentry-debug")
        assert res_unhandled.status_code == 500
        print("[PASS] Unhandled error endpoint /sentry-debug returned 500 Internal Server Error")

    print("\n[ALL TESTS PASSED SUCCESSFULLY!]")

if __name__ == "__main__":
    test_sentry_integration()
