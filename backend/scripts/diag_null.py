"""Null baseline: rank candidates by distance-to-ref ONLY. If ML ≈ this,
the model adds nothing over a ruler. (Honest check.)"""
import numpy as np
from scripts.train import load_all, build_rows, topk_recall
from app.db.session import SessionLocal
from app.ml.features import FEATURES

db = SessionLocal(expire_on_commit=False)
cases, atms, wds, first_geo, accts, trail_all = load_all(db)
db.close()
X, g, row_atm, truth = build_rows(cases, atms, wds, first_geo, accts, trail_all)
di = FEATURES.index("distance_ref_to_candidate_m")
cids = sorted(set(g.tolist()))
n = len(cids)
te = set(cids[int(0.85 * n):])
tei = np.array([i for i, c in enumerate(g) if c in te])
y60 = np.array([1 if any(d <= 60 for d in truth[i]) else 0 for i in tei])
print(f"test rows={len(tei)} positives={y60.sum()}")
print("dist-only top5:", round(topk_recall(-X[tei][:, di], y60, g[tei], 5), 3))
print("dist-only top1:", round(topk_recall(-X[tei][:, di], y60, g[tei], 1), 3))
