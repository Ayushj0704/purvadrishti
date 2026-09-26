import time
from fastapi.testclient import TestClient
from app.main import app

with TestClient(app) as c:  # runs startup: warmup + cache + model
    r = c.post('/api/v1/cases', json={'fraud_type': 'UPI', 'amount': 100000,
        'victim_location': {'lat': 12.97, 'lon': 77.59},
        'complainant_state': 'Karnataka'})
    cid = r.json()['case_id']
    body = {'horizon_minutes': 60, 'ref_lat': 12.97, 'ref_lon': 77.59}
    t0 = time.time()
    p1 = c.post(f'/api/v1/cases/{cid}/predictions', json=body).json()
    t1 = time.time() - t0
    t0 = time.time()
    p2 = c.post(f'/api/v1/cases/{cid}/predictions', json=body).json()
    t2 = time.time() - t0
    print(f'cold(first): {t1:.1f}s top={p1["predictions"][0]["atm_id"]} {p1["predictions"][0]["score"]}')
    print(f'warm(second): {t2:.1f}s top={p2["predictions"][0]["atm_id"]} {p2["predictions"][0]["score"]}')
    from app.db.session import SessionLocal
    from app.db.models import Case, Prediction, Alert
    db = SessionLocal()
    for p_ in db.query(Prediction).filter(Prediction.case_id == cid).all():
        db.query(Alert).filter(Alert.prediction_id == p_.id).delete()
    db.query(Prediction).filter(Prediction.case_id == cid).delete()
    db.query(Alert).filter(Alert.case_id == cid).delete()
    db.query(Case).filter(Case.id == cid).delete()
    db.commit(); db.close()
    print('CLEANED')
