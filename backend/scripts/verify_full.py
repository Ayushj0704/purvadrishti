import time
from fastapi.testclient import TestClient
from app.main import app

with TestClient(app) as c:
    r = c.post('/api/v1/cases', json={'fraud_type': 'UPI', 'amount': 200000,
        'victim_location': {'lat': 28.61, 'lon': 77.20},
        'complainant_state': 'Delhi'})
    cid = r.json()['case_id']
    t0 = time.time()
    p = c.post(f'/api/v1/cases/{cid}/predictions',
               json={'horizon_minutes': 60, 'ref_lat': 26.91, 'ref_lon': 75.78}).json()
    print(f'predict: {time.time()-t0:.1f}s model={p["model_version"]}')
    t = p['predictions'][0]
    print('top:', t['atm_id'], t['score'], t['risk_level'], '| window:', t['predicted_window'])
    print('scores:', t['scores'])
    print('reasons:', t['top_reasons'][:2])
    tl = c.get(f'/api/v1/cases/{cid}/timeline').json()
    print('timeline events:', len(tl['events']), [e['kind'] for e in tl['events']][:6])
    ex = c.get(f'/api/v1/cases/{cid}/explanations').json()
    print('explain atm:', ex['atm_id'], 'n_feats:', len(ex['features']))
    sc = c.get(f'/api/v1/cases/{cid}/similar-cases').json()
    print('similar:', len(sc))
    rp = c.post(f'/api/v1/cases/{cid}/report').json()
    print('report:', rp['title'], '|', rp['banner'])
    hs = c.get('/api/v1/risk/hotspots', params={'category': 'UPI', 'hours_back': 24}).json()
    print('hotspots UPI/24h:', hs.get('count'))
    al = c.get('/api/v1/alerts').json()
    print('alerts:', [(a['alert_id'], a['severity'], a['status']) for a in al[:3]])
    # cleanup
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
