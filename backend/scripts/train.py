"""Train cash-out XGBoost, MULTI-HORIZON (§multi-time).
Usage: PYTHONPATH=. python scripts/train.py [--horizons 30,60,240,720]
Features built once; one booster per horizon (labels differ by window).
Saves: app/ml/models/cashout_xgb{h}.json + meta.json (per-horizon metrics
+ validation-tuned HIGH/CRITICAL thresholds). cashout_xgb.json = 60-min.
"""
import argparse, json, pickle
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np

from app.db.session import SessionLocal
from app.db.models import Case, ATM, Withdrawal, Transaction
from app.ml.features import FEATURES, _hour_match, velocity_feats, graph_feats
from app.geo.spatial import haversine_m

MODEL_DIR = Path(__file__).parent.parent / "app" / "ml" / "models"
MODEL_NAME = "cashout_xgb"
MODEL_VERSION = "0.5.0"
HORIZONS = [30, 60, 240, 720]


def load_all(db):
    cases = db.query(Case).order_by(Case.transaction_datetime).all()
    atms = db.query(ATM).filter(ATM.is_active == 1).all()
    wds = db.query(Withdrawal.atm_id, Withdrawal.linked_case_id,
                   Withdrawal.timestamp, Withdrawal.amount).all()
    txns = db.query(Transaction.case_id, Transaction.lat, Transaction.lon).all()
    first_geo = {}
    for cid, la, lo in txns:
        first_geo.setdefault(cid, (la, lo))
    trail_all = db.query(Transaction.source_account_ref,
                         Transaction.destination_account_ref,
                         Transaction.timestamp).all()
    from app.db.models import Account
    accts = db.query(Account.masked_account_ref, Account.recent_tx_count).all()
    return cases, atms, wds, first_geo, accts, trail_all


def acct_lookup(accts, ref):
    if not ref:
        return 0
    for (r, cnt) in accts:
        if r == ref:
            return cnt
    for (r, cnt) in accts:  # masked-prefix fallback, mirrors inference
        if r.startswith(ref[:9]):
            return cnt
    return 0


def feat_row(c, alat, alon, astate, nearby, src_n, dst_n, T,
             plat, plon, trail):
    vlat, vlon = c.victim_lat or 28.6, c.victim_lon or 77.2
    f = [0.0] * len(FEATURES)
    vel, imposs = velocity_feats(c, vlat, vlon, plat, plon, T)
    indeg, fanout, depth, l2n = graph_feats(trail, c, T)
    m = {
        "transaction_amount": float(c.fraud_amount or 0),
        "time_since_complaint_min": 0.0,
        "hour": float(T.hour), "day_of_week": float(T.weekday()),
        "is_weekend": float(T.weekday() >= 5),
        "distance_victim_to_candidate_m": float(haversine_m(vlat, vlon, alat, alon)),
        "distance_ref_to_candidate_m": 0.0,  # filled by caller
        "cross_state_flag": float(1 if (c.complainant_state and astate
                                        and c.complainant_state != astate) else 0),
        "nearby_atm_count": float(nearby),
        "hour_match_score": float(_hour_match(T.hour)),
        "src_recent_tx_count": float(src_n), "dst_recent_tx_count": float(dst_n),
        "suspect_info_count": float(sum(1 for v in (c.suspect_mobile, c.suspect_email,
                                                    c.suspect_account_ref, c.suspect_url) if v)),
        "geo_velocity_kmh": float(vel),
        "travel_impossible_flag": float(imposs),
        "dst_in_degree": float(indeg), "src_fan_out": float(fanout),
        "chain_depth": float(depth), "l2_count": float(l2n),
    }
    return [m[k] for k in FEATURES]


def build_rows(cases, atms, wds, first_geo, accts, trail_all):
    """Build X once + per-row truth deltas (minutes from T to each linked
    withdrawal at that ATM). Labels per horizon derived later."""
    import collections
    wd_by_case = collections.defaultdict(list)
    wd_by_atm = collections.defaultdict(list)
    for aid, cid, ts, amt in wds:
        if cid:
            wd_by_case[cid].append((aid, ts))
        wd_by_atm[aid].append((ts, amt))
    coords = [(a.id, a.lat, a.lon, a.state) for a in atms]
    X, groups, row_atm, truth = [], [], [], []
    for c in cases:
        T = c.transaction_datetime or c.reported_at
        if not T:
            continue
        glat, glon = first_geo.get(c.id, (None, None))
        plat, plon = glat or c.victim_lat or 28.6, glon or c.victim_lon or 77.2
        scored = sorted(coords, key=lambda t: haversine_m(plat, plon, t[1], t[2]))[:30]
        case_truth = [(aid, (ts - T).total_seconds() / 60.0)
                      for (aid, ts) in wd_by_case.get(c.id, [])
                      if ts and (ts - T).total_seconds() >= 0]
        src_n = acct_lookup(accts, c.debited_account_ref)
        dst_n = acct_lookup(accts, c.destination_account_ref)
        _s0, _d0 = c.debited_account_ref or "", c.destination_account_ref or ""
        trail = [(s, d, ts) for (s, d, ts) in trail_all
                 if (not ts or ts <= T) and (s in (_s0, _d0) or d in (_s0, _d0))]
        for aid, alat, alon, astate in scored:
            nearby = sum(1 for (_, la, lo, _) in coords
                         if abs(la - alat) < 0.15 and abs(lo - alon) < 0.15
                         and haversine_m(alat, alon, la, lo) <= 5000)
            row = feat_row(c, alat, alon, astate, nearby, src_n, dst_n, T,
                           plat, plon, trail)
            row[FEATURES.index("distance_ref_to_candidate_m")] = float(
                haversine_m(plat, plon, alat, alon))
            X.append(row)
            groups.append(c.id)
            row_atm.append(aid)
            truth.append([d for (a2, d) in case_truth if a2 == aid])
    return (np.array(X, dtype=float), np.array(groups),
            np.array(row_atm), truth)


def topk_recall(p, y, g, k=5):
    hits = tot = 0
    for cid in np.unique(g):
        idx = np.where(g == cid)[0]
        if y[idx].sum() == 0:
            continue
        tot += 1
        top = idx[np.argsort(-p[idx])[:k]]
        if y[top].sum() > 0:
            hits += 1
    return hits / tot if tot else 0.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--horizons", default=",".join(map(str, HORIZONS)))
    a = ap.parse_args()
    horizons = [int(h) for h in a.horizons.split(",") if h.strip()]
    from xgboost import XGBClassifier
    from sklearn.metrics import average_precision_score, roc_auc_score

    db = SessionLocal(expire_on_commit=False)
    cases, atms, wds, first_geo, accts, trail_all = load_all(db)
    db.close()
    print(f"cases={len(cases)} atms={len(atms)} withdrawals={len(wds)} trail_edges={len(trail_all)}")
    X, g, row_atm, truth = build_rows(cases, atms, wds, first_geo, accts, trail_all)
    print(f"rows={len(X)}")

    # Time-aware split by case order (cases pre-sorted by txn time)
    cids = sorted(set(g.tolist()))
    n = len(cids)
    tr, va = set(cids[:int(0.7 * n)]), set(cids[int(0.7 * n):int(0.85 * n)])
    te = set(cids[int(0.85 * n):])
    tri = np.array([i for i, c in enumerate(g) if c in tr])
    vai = np.array([i for i, c in enumerate(g) if c in va])
    tei = np.array([i for i, c in enumerate(g) if c in te])

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    out = {
        "model_name": MODEL_NAME, "model_version": MODEL_VERSION,
        "feature_version": "0.1.0",
        "trained_at": datetime.utcnow().isoformat() + "Z",
        "features": FEATURES,
        "score_type": "raw_xgb_proba_uncalibrated",
        "calibration": "deferred (isotonic flattened scores); raw proba + validation-tuned thresholds",
        "horizons": {},
    }
    for h in horizons:
        y = np.array([1 if any(d <= h for d in t) else 0 for t in truth])
        print(f"--- horizon {h}min positives={int(y.sum())}")
        if y.sum() < 20:
            print("  skipped: too few positives"); continue
        neg, pos = int((y == 0).sum()), int(y.sum())
        clf = XGBClassifier(max_depth=6, n_estimators=300, learning_rate=0.05,
                            subsample=0.8, eval_metric="logloss", n_jobs=4,
                            scale_pos_weight=(neg / pos))
        clf.fit(X[tri], y[tri])
        pv = clf.predict_proba(X[vai])[:, 1]
        pt = clf.predict_proba(X[tei])[:, 1]
        hm = {
            "minutes": h, "positives": int(y.sum()),
            "val_pr_auc": float(average_precision_score(y[vai], pv)),
            "test_pr_auc": float(average_precision_score(y[tei], pt)),
            "test_roc_auc": float(roc_auc_score(y[tei], pt)),
            "test_top5_recall": float(topk_recall(pt, y[tei], g[tei], 5)),
            "test_top1_recall": float(topk_recall(pt, y[tei], g[tei], 1)),
            "thresholds": {"HIGH": round(float(np.quantile(pv, 0.95)), 3),
                           "CRITICAL": round(float(np.quantile(pv, 0.99)), 3)},
        }
        print(json.dumps(hm, indent=2))
        clf.save_model(str(MODEL_DIR / f"cashout_xgb_h{h}.json"))
        if h == 60:
            clf.save_model(str(MODEL_DIR / "cashout_xgb.json"))  # default artifact
        out["horizons"][str(h)] = hm
    # default (60-min) thresholds at top level for existing readers
    if "60" in out["horizons"]:
        out["horizon_minutes"] = 60
        out["thresholds"] = out["horizons"]["60"]["thresholds"]
        for k in ("val_pr_auc", "test_pr_auc", "test_roc_auc",
                  "test_top5_recall", "test_top1_recall"):
            out[k] = out["horizons"]["60"][k]
    # Time regressor: minutes-to-cashout on rows where it happened (<=720).
    # Answers WHEN, not just whether. Same time split, MAE evaluated.
    from xgboost import XGBRegressor
    from sklearn.metrics import mean_absolute_error
    tmin = np.array([min(t) if t else None for t in truth], dtype=object)
    has = np.array([v is not None and v <= 720 for v in tmin])
    yr = np.array([min(float(v), 720.0) for v in tmin[has]])
    Xr = X[has]
    gr = g[has]
    trr = np.array([i for i, c in enumerate(gr) if c in tr])
    var = np.array([i for i, c in enumerate(gr) if c in va])
    ter = np.array([i for i, c in enumerate(gr) if c in te])
    reg = XGBRegressor(max_depth=5, n_estimators=200, learning_rate=0.08,
                       subsample=0.8, n_jobs=4)
    reg.fit(Xr[trr], yr[trr])
    pv_r, pt_r = reg.predict(Xr[var]), reg.predict(Xr[ter])
    tm = {"n": int(has.sum()),
          "val_mae_min": round(float(mean_absolute_error(yr[var], pv_r)), 1),
          "test_mae_min": round(float(mean_absolute_error(yr[ter], pt_r)), 1)}
    print("time model:", json.dumps(tm))
    reg.save_model(str(MODEL_DIR / "cashout_time.json"))
    out["time_model"] = tm
    with open(MODEL_DIR / "meta.json", "w") as f:
        json.dump(out, f, indent=2)
    print("saved to", MODEL_DIR)


if __name__ == "__main__":
    main()
