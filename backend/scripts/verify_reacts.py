"""Verify model responds to recent history: predict, inject fresh withdrawal
at top candidate, predict again, compare. Cleans up afterwards."""
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.db.models import Case, Prediction, Alert, Withdrawal, ATM

c = TestClient(app)
r = c.post('/api/v1/cases', json={'fraud_type': 'UPI', 'amount': 120000,
    'victim_location': {'lat': 26.9, 'lon': 75.8},
    'complainant_state': 'Delhi', 'incident_state': 'Rajasthan'})
cid = r.json()['case_id']
body = {'horizon_minutes': 60, 'ref_lat': 26.9, 'ref_lon': 75.8}
p1 = c.post(f'/api/v1/cases/{cid}/predictions', json=body).json()
t1 = p1['predictions'][0]
print('before:', t1['atm_id'], t1['score'], t1['risk_level'])

db = SessionLocal()
atm = db.query(ATM).filter(ATM.atm_code == t1['atm_id']).first()
for i in range(6):  # fresh mule-crew activity at this ATM
    db.add(Withdrawal(atm_id=atm.id, linked_case_id=None, amount=20000,
                      timestamp=datetime.utcnow() - timedelta(minutes=20 + i * 5)))
db.commit()
db.close()

p2 = c.post(f'/api/v1/cases/{cid}/predictions', json=body).json()
t2 = [p for p in p2['predictions'] if p['atm_id'] == t1['atm_id']][0]
print('after: ', t2['atm_id'], t2['score'], t2['risk_level'])
print('reasons:', t2['top_reasons'][:2])
assert t2['score'] > t1['score'], 'model did not react to history!'
print('REACTS_TO_HISTORY_OK')

# cleanup temp rows
db = SessionLocal()
for p in db.query(Prediction).filter(Prediction.case_id == cid).all():
    db.query(Alert).filter(Alert.prediction_id == p.id).delete()
db.query(Prediction).filter(Prediction.case_id == cid).delete()
db.query(Alert).filter(Alert.case_id == cid).delete()
db.query(Withdrawal).filter(Withdrawal.linked_case_id.is_(None)).delete()
db.query(Case).filter(Case.id == cid).delete()
db.commit()
db.close()
print('CLEANED')
