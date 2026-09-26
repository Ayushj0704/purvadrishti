from fastapi.testclient import TestClient
from app.main import app

def test_health():
    c = TestClient(app)
    r = c.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

def test_case_flow():
    c = TestClient(app)
    r = c.post("/api/v1/cases", json={"fraud_type": "UPI", "amount": 120000,
               "victim_location": {"lat": 28.7, "lon": 77.1}})
    assert r.status_code == 200
    cid = r.json()["case_id"]
    r2 = c.post(f"/api/v1/cases/{cid}/predictions",
                json={"horizon_minutes": 60, "ref_lat": 26.9, "ref_lon": 75.8})
    assert r2.status_code == 200
    assert len(r2.json()["predictions"]) > 0
