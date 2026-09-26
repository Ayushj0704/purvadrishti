import json
import numpy as np
import xgboost as xgb
from xgboost import Booster
from app.ml.features import FEATURES
from scripts.train import load_all, build_rows
from app.db.session import SessionLocal

db = SessionLocal(expire_on_commit=False)
cases, atms, wds, first_geo, accts = load_all(db)
db.close()
X, y, g = build_rows(cases, atms, wds, first_geo, accts, 60)
cids = sorted(set(g.tolist()))
n = len(cids)
va = set(cids[int(0.7 * n):int(0.85 * n)])
vai = np.array([i for i, c in enumerate(g) if c in va])
b = Booster()
b.load_model('app/ml/models/cashout_xgb.json')
raw = b.predict(xgb.DMatrix(X[vai], feature_names=FEATURES))
p90, p95, p99 = float(np.quantile(raw, 0.90)), float(np.quantile(raw, 0.95)), float(np.quantile(raw, 0.99))
print('val p90/p95/p99:', round(p90, 3), round(p95, 3), round(p99, 3))
meta = json.load(open('app/ml/models/meta.json'))
meta['score_type'] = 'raw_xgb_proba_uncalibrated'
meta['calibration'] = 'deferred: isotonic flattened scores (pos 0.014 vs neg 0.011); using raw proba, thresholds tuned on validation'
meta['thresholds'] = {'HIGH': round(p95, 3), 'CRITICAL': round(p99, 3),
                      'note': 'MEDIUM below HIGH; tuned on validation quantiles per spec'}
json.dump(meta, open('app/ml/models/meta.json', 'w'), indent=2)
print('meta updated:', meta['thresholds'])
