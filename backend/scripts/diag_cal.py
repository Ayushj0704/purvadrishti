import numpy as np, pickle
from xgboost import Booster
import xgboost as xgb
from app.ml.features import FEATURES
from scripts.train import load_all, build_rows, topk_recall
from app.db.session import SessionLocal

db = SessionLocal(expire_on_commit=False)
cases, atms, wds, first_geo, accts = load_all(db)
db.close()
X, y, g = build_rows(cases, atms, wds, first_geo, accts, 60)
cids = sorted(set(g.tolist()))
n = len(cids)
te = set(cids[int(0.85 * n):])
tei = np.array([i for i, c in enumerate(g) if c in te])
b = Booster()
b.load_model('app/ml/models/cashout_xgb.json')
raw = b.predict(xgb.DMatrix(X[tei], feature_names=FEATURES))
print('raw pos mean/std:', raw[y[tei] == 1].mean(), raw[y[tei] == 1].std())
print('raw neg mean/std:', raw[y[tei] == 0].mean(), raw[y[tei] == 0].std())
print('raw top5:', topk_recall(raw, y[tei], g[tei], 5))
cal = pickle.load(open('app/ml/models/calibrator.pkl', 'rb'))
pv = np.clip(cal.predict(raw), 0.01, 0.99)
print('cal pos mean/std:', pv[y[tei] == 1].mean(), pv[y[tei] == 1].std())
print('cal neg mean/std:', pv[y[tei] == 0].mean(), pv[y[tei] == 0].std())
print('cal top5:', topk_recall(pv, y[tei], g[tei], 5))
