import time
from fastapi.testclient import TestClient
from app.main import app

c = TestClient(app)

# ingest (I4C auto-fetch), incl. idempotency
p = {'external_case_id': 'NCRP-TEST-001', 'fraud_type': 'UPI', 'amount': 95000,
     'victim_location': {'lat': 19.07, 'lon': 72.87},
     'complainant_state': 'Maharashtra', 'bank_name': 'HDFC',
     'transaction_id': 'UTR999000111222', 'source_system': 'CFCFRMS'}
r1 = c.post('/api/v1/cases/ingest', json=p)
print('ingest:', r1.status_code, r1.json())
r2 = c.post('/api/v1/cases/ingest', json=p)
print('ingest-dedupe:', r2.json().get('deduped'))
cid = r1.json()['case_id']

t0 = time.time()
r3 = c.post(f'/api/v1/cases/{cid}/predictions',
            json={'horizon_minutes': 60, 'ref_lat': 19.07, 'ref_lon': 72.87})
dt = time.time() - t0
top = r3.json()['predictions'][0]
print(f'predict: {dt:.1f}s top={top["atm_id"]} {top["score"]} {top["risk_level"]}')
print('reasons:', top['top_reasons'][:2])

r4 = c.get('/api/v1/risk/hotspots', params={'state': 'Maharashtra', 'min_score': 0.05})
print('hotspots MH>=0.05:', r4.json().get('count'))

# cleanup temp case
from app.db.session import SessionLocal
from app.db.models import Case, Prediction, Alert, Transaction
db = SessionLocal()
for p_ in db.query(Prediction).filter(Prediction.case_id == cid).all():
    db.query(Alert).filter(Alert.prediction_id == p_.id).delete()
db.query(Prediction).filter(Prediction.case_id == cid).delete()
db.query(Alert).filter(Alert.case_id == cid).delete()
db.query(Transaction).filter(Transaction.case_id == cid).delete()
db.query(Case).filter(Case.id == cid).delete()
db.commit(); db.close()
print('CLEANED')
