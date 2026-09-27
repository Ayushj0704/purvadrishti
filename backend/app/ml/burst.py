"""Unsupervised burst signal (spec §16 second signal).
Answers: "is ATM par ABHI burst hai?" — pure observed counts, no training,
no learned weights to go backwards. Rule thresholds are explicit constants.
"""
from datetime import timedelta

BURST_HIGH_2H = 5    # >=5 withdrawals in 2h = crew draining now
BURST_MED_2H = 2     # >=2 in 2h = watch
BURST_MED_6H = 5     # >=5 in 6h = watch


def burst_levels(db, atm_ids, T):
    """One batched query. Returns {atm_id: {n2h, n6h, n48h, level}}."""
    from app.db.models import Withdrawal
    out = {aid: {"n2h": 0, "n6h": 0, "n48h": 0, "level": "LOW"} for aid in atm_ids}
    if not atm_ids:
        return out
    rows = db.query(Withdrawal.atm_id, Withdrawal.timestamp).filter(
        Withdrawal.atm_id.in_(atm_ids),
        Withdrawal.timestamp >= T - timedelta(hours=48),
        Withdrawal.timestamp <= T).all()
    for aid, ts in rows:
        d = out.get(aid)
        if not d or not ts:
            continue
        age_h = (T - ts).total_seconds() / 3600.0
        d["n48h"] += 1
        if age_h <= 6:
            d["n6h"] += 1
        if age_h <= 2:
            d["n2h"] += 1
    for d in out.values():
        if d["n2h"] >= BURST_HIGH_2H:
            d["level"] = "HIGH"
        elif d["n2h"] >= BURST_MED_2H or d["n6h"] >= BURST_MED_6H:
            d["level"] = "MEDIUM"
    return out
