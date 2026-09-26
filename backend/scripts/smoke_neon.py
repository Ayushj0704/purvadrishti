from fastapi.testclient import TestClient
from app.main import app

c = TestClient(app)
h = c.get('/health')
print('HEALTH:', h.json())
r = c.post('/api/v1/cases', json={'fraud_type': 'UPI', 'amount': 120000,
    'victim_location': {'lat': 28.7, 'lon': 77.1},
    'complainant_state': 'Delhi', 'incident_state': 'Delhi'})
print('CASE:', r.status_code, r.json())
cid = r.json()['case_id']
r2 = c.post(f'/api/v1/cases/{cid}/predictions',
            json={'horizon_minutes': 60, 'ref_lat': 26.9, 'ref_lon': 75.8})
print('PRED_STATUS:', r2.status_code)
print('N_PREDS:', len(r2.json().get('predictions', [])))
print('TOP:', r2.json().get('predictions', [])[:2])
