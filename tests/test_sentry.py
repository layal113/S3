from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app, raise_server_exceptions=False)


def test_sentry_debug_route_triggers_error():
    response = client.get("/sentry-debug")
    assert response.status_code == 500


def test_sentry_manual_capture_route():
    response = client.get("/sentry-capture-test")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "captured"
    assert "Miqyas manually triggered test error" in data["message"]
