"""Spatiotemporal feature engineering (§9).
One row = case + candidate ATM at prediction time T.
RULE: every feature uses only data with timestamp <= T (no leakage, §33).
"""
from datetime import timedelta
from app.geo.spatial import haversine_m

FEATURE_VERSION = "0.2.0"

FEATURES = [
    "transaction_amount", "time_since_complaint_min",
    "hour", "day_of_week", "is_weekend",
    "distance_victim_to_candidate_m", "distance_ref_to_candidate_m",
    "cross_state_flag", "nearby_atm_count",
    "fraud_withdrawals_7d", "fraud_withdrawals_30d",
    "avg_withdrawal_amount", "hour_match_score",
    "src_recent_tx_count", "dst_recent_tx_count",
    "suspect_info_count",
    # Phase-2: velocity anomaly + money-trail graph (NetworkX-style, no GNN infra)
    "geo_velocity_kmh", "travel_impossible_flag",
    "dst_in_degree", "src_fan_out", "chain_depth", "l2_count",
]

FLIGHT_KMH = 800.0  # above this, money moved faster than any flight

def _hour_match(hour: int) -> float:
    # Evening peak learned from synthetic ground truth (19-21h)
    return 1.0 if hour in (19, 20, 21) else (0.6 if hour in (11, 13, 14) else 0.2)


def velocity_feats(case, vlat, vlon, plat, plon, T):
    """Impossible-travel proxy: money far from victim within minutes."""
    from datetime import datetime
    inc = case.incident_datetime or case.reported_at or T
    hrs = max((T - inc).total_seconds() / 3600.0, 0.1)
    vel = min(haversine_m(vlat, vlon, plat, plon) / 1000.0 / hrs, 9999.0)
    return vel, 1.0 if vel > FLIGHT_KMH else 0.0


def graph_feats(txns, case, T):
    """txns: iterable of (src, dst, ts). Counts use ts <= T only.
    Returns (in_degree, fan_out, chain_depth, l2_count)."""
    src = case.debited_account_ref or ""
    dst = case.destination_account_ref or ""
    feeders, outs, l2n = set(), set(), 0
    for (s, d, ts) in txns:
        if ts and ts > T:
            continue
        if dst and d == dst and s != src:
            feeders.add(s)          # funnel into the mule (in-degree)
        if src and s == src:
            outs.add(d)             # fan-out from source
        if dst and s == dst:
            l2n += 1                # onward Layer-2 splits
    depth = 2 if l2n > 0 else 1
    return float(len(feeders)), float(len(outs)), float(depth), float(l2n)


def build_features(db, case, atm, ref_lat=None, ref_lon=None, now=None):
    """Return (feature_dict, debug). `now` = prediction time T."""
    from app.db.models import ATM, Withdrawal, Account
    from datetime import datetime
    T = now or datetime.utcnow()
    inc_dt = case.transaction_datetime or case.reported_at or T

    vlat, vlon = case.victim_lat or 28.6, case.victim_lon or 77.2
    plat = ref_lat if ref_lat is not None else vlat
    plon = ref_lon if ref_lon is not None else vlon

    d_victim = haversine_m(vlat, vlon, atm.lat, atm.lon)
    d_ref = haversine_m(plat, plon, atm.lat, atm.lon)
    cross = 1 if (case.complainant_state and atm.state
                  and case.complainant_state != atm.state) else 0

    # P2 FIX: read precomputed nearby_atm_count (set at seed time) — avoids 500-ATM haversine loop per request
    nearby = getattr(atm, "nearby_atm_count", 0) or 0

    # Candidate-location history, strictly <= T
    w7 = w30 = 0
    amounts = []
    for (ts, amt) in db.query(Withdrawal.timestamp, Withdrawal.amount).filter(
            Withdrawal.atm_id == atm.id, Withdrawal.timestamp <= T).all():
        amounts.append(amt)
        if ts and (T - ts) <= timedelta(days=7):
            w7 += 1
        if ts and (T - ts) <= timedelta(days=30):
            w30 += 1
    avg_amt = sum(amounts) / len(amounts) if amounts else 0.0

    # Network: recent-tx counts for masked source/dest accounts
    src_n = dst_n = 0
    if case.debited_account_ref:
        r = db.query(Account.recent_tx_count).filter(
            Account.masked_account_ref.like(f"{case.debited_account_ref}%")).first()
        src_n = r[0] if r else 0
    if case.destination_account_ref:
        r = db.query(Account.recent_tx_count).filter(
            Account.masked_account_ref.like(f"{case.destination_account_ref}%")).first()
        dst_n = r[0] if r else 0

    suspect_n = sum(1 for v in (case.suspect_mobile, case.suspect_email,
                                case.suspect_account_ref, case.suspect_url) if v)
    dt_min = max(0.0, (T - (case.reported_at or T)).total_seconds() / 60.0)

    f = {
        "transaction_amount": float(case.fraud_amount or 0),
        "time_since_complaint_min": float(dt_min),
        "hour": float(T.hour), "day_of_week": float(T.weekday()),
        "is_weekend": float(T.weekday() >= 5),
        "distance_victim_to_candidate_m": float(d_victim),
        "distance_ref_to_candidate_m": float(d_ref),
        "cross_state_flag": float(cross),
        "nearby_atm_count": float(nearby),
        "fraud_withdrawals_7d": float(w7),
        "fraud_withdrawals_30d": float(w30),
        "avg_withdrawal_amount": float(avg_amt),
        "hour_match_score": float(_hour_match(T.hour)),
        "src_recent_tx_count": float(src_n),
        "dst_recent_tx_count": float(dst_n),
        "suspect_info_count": float(suspect_n),
    }
    return f, {"T": T.isoformat(), "dist_ref_m": round(d_ref)}


def build_features_batch(db, case, atms, ref_lat=None, ref_lon=None, now=None):
    """Few-query batch version: ~3 DB round-trips total, rest in-memory.
    Returns list[(atm, feature_dict)]. Same values as build_features()."""
    from app.db.models import Withdrawal, Account, Transaction
    from sqlalchemy import or_ as _or
    from datetime import datetime
    T = now or datetime.utcnow()
    vlat, vlon = case.victim_lat or 28.6, case.victim_lon or 77.2
    plat = ref_lat if ref_lat is not None else vlat
    plon = ref_lon if ref_lon is not None else vlon

    coords = [(a.lat, a.lon) for a in atms]
    ids = [a.id for a in atms]
    hist = {}
    if ids:
        for aid, ts, amt in db.query(Withdrawal.atm_id, Withdrawal.timestamp,
                                     Withdrawal.amount).filter(
                Withdrawal.atm_id.in_(ids), Withdrawal.timestamp <= T).all():
            hist.setdefault(aid, []).append((ts, amt))
    src_n = dst_n = 0
    refs = [r for r in (case.debited_account_ref, case.destination_account_ref) if r]
    if refs:
        got = dict(db.query(Account.masked_account_ref,
                            Account.recent_tx_count).filter(
                Account.masked_account_ref.in_(refs)).all())
        if not got:
            # P3 FIX: push LIKE filter to DB instead of pulling 5000 rows to Python
            for r in refs:
                if r:
                    row = db.query(Account.recent_tx_count).filter(
                        Account.masked_account_ref.like(f"{r[:9]}%")
                    ).first()
                    if row:
                        got[r] = row[0]
        src_n = got.get(case.debited_account_ref or "", 0)
        dst_n = got.get(case.destination_account_ref or "", 0)

    suspect_n = sum(1 for v in (case.suspect_mobile, case.suspect_email,
                                case.suspect_account_ref, case.suspect_url) if v)
    dt_min = max(0.0, (T - (case.reported_at or T)).total_seconds() / 60.0)
    # Phase-2: velocity anomaly + money-trail graph (1 extra batched query)
    vel, imposs = velocity_feats(case, vlat, vlon, plat, plon, T)
    trail_rows = []
    _refs = [r for r in (case.debited_account_ref, case.destination_account_ref) if r]
    if _refs:
        trail_rows = db.query(Transaction.source_account_ref,
                              Transaction.destination_account_ref,
                              Transaction.timestamp).filter(
            _or(Transaction.source_account_ref.in_(_refs),
                Transaction.destination_account_ref.in_(_refs))).limit(2000).all()
    indeg, fanout, depth, l2n = graph_feats(trail_rows, case, T)
    out = []
    for a in atms:
        d_victim = haversine_m(vlat, vlon, a.lat, a.lon)
        d_ref = haversine_m(plat, plon, a.lat, a.lon)
        cross = 1 if (case.complainant_state and a.state
                      and case.complainant_state != a.state) else 0
        # P2 FIX: read precomputed nearby_atm_count — avoids O(n²) haversine loop
        nearby = getattr(a, "nearby_atm_count", 0) or 0
        w7 = w30 = 0
        recs = hist.get(a.id, [])
        amounts = [amt for (ts, amt) in recs]
        for (ts, amt) in recs:
            if ts and (T - ts) <= timedelta(days=7):
                w7 += 1
            if ts and (T - ts) <= timedelta(days=30):
                w30 += 1
        f = {
            "transaction_amount": float(case.fraud_amount or 0),
            "time_since_complaint_min": float(dt_min),
            "hour": float(T.hour), "day_of_week": float(T.weekday()),
            "is_weekend": float(T.weekday() >= 5),
            "distance_victim_to_candidate_m": float(d_victim),
            "distance_ref_to_candidate_m": float(d_ref),
            "cross_state_flag": float(cross),
            "nearby_atm_count": float(nearby),
            "fraud_withdrawals_7d": float(w7),
            "fraud_withdrawals_30d": float(w30),
            "avg_withdrawal_amount": float(sum(amounts) / len(amounts)) if amounts else 0.0,
            "hour_match_score": float(_hour_match(T.hour)),
            "src_recent_tx_count": float(src_n),
            "dst_recent_tx_count": float(dst_n),
            "suspect_info_count": float(suspect_n),
            "geo_velocity_kmh": float(vel),
            "travel_impossible_flag": float(imposs),
            "dst_in_degree": float(indeg),
            "src_fan_out": float(fanout),
            "chain_depth": float(depth),
            "l2_count": float(l2n),
        }
        out.append((a, f))
    return out


def to_matrix(pairs):
    """[(atm, feat)] -> (atms, X). Columns follow FEATURES order."""
    import numpy as np
    atms = [a for (a, _) in pairs]
    X = np.array([[f[k] for k in FEATURES] for (_, f) in pairs], dtype=float)
    return atms, X
