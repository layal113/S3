from fastapi.testclient import TestClient
from api.main import app
import json

client = TestClient(app)

def check_schemas():
    r_dash = client.get("/v1/households/high-ac-home/dashboard")
    print("=== /v1/households/high-ac-home/dashboard RAW JSON ===")
    print(json.dumps(r_dash.json(), indent=2))

    r_hist = client.get("/v1/households/high-ac-home/usage/history?period=7d")
    print("\n=== /v1/households/high-ac-home/usage/history RAW JSON ===")
    print(json.dumps(r_hist.json(), indent=2))

if __name__ == "__main__":
    check_schemas()
