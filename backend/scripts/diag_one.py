import numpy as np
import xgboost as xgb
from xgboost import Booster
from app.db.session import SessionLocal
from app.db.models import Case, ATM, Withdrawal
from app.ml.features import build_features_batch, to_matrix, FEATURES

db = SessionLocal(expire_on_commit=False)
c = db.query(Case).filter(Case.id == 2005).first()
print('fresh withdrawals at RA-0085:',
      db.query(Withdrawal).join(ATM, Withdrawal.atm_id == ATM.id).filter(
          ATM.atm_code == 'ATM-RA-0085').count())
a = db.query(ATM).filter(ATM.atm_code == 'ATM-RA-0085').first()
pairs = build_features_batch(db, c, [a], 26.9, 75.8)
print('features:', pairs[0][1])
atms, X = to_matrix(pairs)
b = Booster()
b.load_model('app/ml/models/cashout_xgb.json')
print('raw score:', b.predict(xgb.DMatrix(X, feature_names=FEATURES)))
print('gain:', b.get_score(importance_type='gain'))
db.close()
