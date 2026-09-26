from datetime import timedelta
from app.db.session import SessionLocal
from app.db.models import Case, ATM, Withdrawal, Transaction
from app.geo.spatial import haversine_m

db = SessionLocal(expire_on_commit=False)
atms = [(a.id, a.lat, a.lon) for a in db.query(ATM).all()]
first_geo = {}
for cid, la, lo in db.query(Transaction.case_id, Transaction.lat, Transaction.lon).all():
    first_geo.setdefault(cid, (la, lo))
n_in_h = n_cov = n_cases = 0
ranks = []
for c in db.query(Case).limit(2000).all():
    T = c.transaction_datetime or c.reported_at
    wds = [(aid, ts) for (aid, ts) in
           db.query(Withdrawal.atm_id, Withdrawal.timestamp).filter(
               Withdrawal.linked_case_id == c.id).all()
           if ts and timedelta(0) <= (ts - T) <= timedelta(minutes=60)]
    if not wds:
        continue
    n_cases += 1
    glat, glon = first_geo.get(c.id, (None, None))
    plat, plon = glat or c.victim_lat or 28.6, glon or c.victim_lon or 77.2
    order = sorted(atms, key=lambda t: haversine_m(plat, plon, t[1], t[2]))
    top20 = {t[0] for t in order[:20]}
    for aid, ts in wds:
        n_in_h += 1
        rank = next(i for i, t in enumerate(order) if t[0] == aid)
        ranks.append(rank)
        if aid in top20:
            n_cov += 1
import statistics
print(f"cases_with_truth={n_cases} in_horizon_wds={n_in_h} covered={n_cov}")
print(f"median_rank={statistics.median(ranks)} p90={sorted(ranks)[int(len(ranks)*0.9)]}")
db.close()
