"""NCRP-realistic synthetic seeder.
- Suspect/optional fields nullable with realistic fill rates.
- Money-flow pattern: victim -> mule account (55% cross-state) -> cash-out
  near mule (70%), fast cash-out 10-55 min (65%).
- Historical: past complaints + txns + withdrawals (model learns patterns).
- Usage: PYTHONPATH=. python scripts/seed.py --scale demo|full
"""
import argparse, random
from datetime import datetime, timedelta
from app.db.session import Base, engine, SessionLocal
from app.db.models import Case, ATM, Account, Transaction, Withdrawal
from app.geo.spatial import haversine_m

random.seed(42)
STATES = [
    ("Delhi", "North-West Delhi", 28.61, 77.20, "110085"),
    ("Rajasthan", "Jaipur", 26.91, 75.78, "302001"),
    ("Haryana", "Gurugram", 28.41, 77.02, "122001"),
    ("Uttar Pradesh", "Noida", 28.57, 77.32, "201301"),
    ("Punjab", "Ludhiana", 30.90, 75.85, "141001"),
    ("Maharashtra", "Mumbai", 19.07, 72.87, "400001"),
    ("West Bengal", "Kolkata", 22.57, 88.36, "700001"),
    ("Tamil Nadu", "Chennai", 13.08, 80.27, "600001"),
    ("Karnataka", "Bengaluru", 12.97, 77.59, "560001"),
    ("Telangana", "Hyderabad", 17.38, 78.48, "500001"),
    ("Gujarat", "Ahmedabad", 23.03, 72.58, "380001"),
    ("Madhya Pradesh", "Bhopal", 23.26, 77.41, "462001"),
    ("Bihar", "Patna", 25.61, 85.14, "800001"),
    ("Kerala", "Kochi", 9.93, 76.27, "682001"),
    ("Assam", "Guwahati", 26.14, 91.74, "781001"),
]
SUBCATS = ["UPI", "Internet banking", "Card", "Wallet"]
BANKS = ["HDFC", "SBI", "ICICI", "Axis", "PaytmWallet"]
CENTROID = {name: (lat, lon) for (name, _, lat, lon, _) in STATES}
EVENING_HOURS = [19, 20, 21, 13, 14, 11]  # learnt time-of-day pattern

def maybe(p: float):
    return random.random() < p

def run(scale="demo"):
    Base.metadata.create_all(bind=engine)
    # expire_on_commit=False: Neon pooler drops idle conns; avoids lazy re-fetch
    # of expired ORM objects mid-run (caused OperationalError on remote seed).
    db = SessionLocal(expire_on_commit=False)
    n_case, n_atm = (2000, 500) if scale == "demo" else (10000, 1000)

    def commit_batch(objs, size=400):
        for i in range(0, len(objs), size):
            db.add_all(objs[i:i + size])
            db.commit()

    # --- ATM master ---
    if db.query(ATM).count() == 0:
        import h3 as h3lib
        from app.core.config import settings as _s
        atms_batch = []
        for i in range(n_atm):
            st, dist, slat, slon, pin = random.choice(STATES)
            alat, alon = slat + random.uniform(-0.3, 0.3), slon + random.uniform(-0.3, 0.3)
            try:
                cell = h3lib.latlng_to_cell(alat, alon, _s.h3_resolution)
            except Exception:
                cell = ""
            atms_batch.append(ATM(atm_code=f"ATM-{st[:2].upper()}-{i:04d}",
                       bank_id=random.choice(BANKS),
                       lat=alat, lon=alon,
                       state=st, district=dist, city=dist,
                       pincode=pin, police_station=f"PS-{dist[:3]}-{i%9}",
                       h3_cell=cell))
        commit_batch(atms_batch)
    # In-memory ATM table for placement (id, lat, lon, state)
    atm_rows = [(r[0], r[1], r[2], r[3]) for r in
                db.query(ATM.id, ATM.lat, ATM.lon, ATM.state).all()]
    # Hot ATMs: 4 per state reused across cases (repeat cash-out points).
    # This is what makes candidate-history features genuinely predictive.
    HOT = {}
    for (sname, _, slat, slon, _) in STATES:
        same = [(aid, alat, alon) for (aid, alat, alon, ast) in atm_rows if ast == sname]
        same.sort(key=lambda t: haversine_m(slat, slon, t[1], t[2]))
        HOT[sname] = [t[0] for t in same[:4]]
    # --- Accounts ---
    if db.query(Account).count() == 0:
        acct_batch = []
        for i in range(n_case * 2):
            acct_batch.append(Account(masked_account_ref=f"XXXX-{random.randint(1000,9999)}-{i}",
                           bank_id=random.choice(BANKS),
                           state=random.choice(STATES)[0],
                           recent_tx_count=random.randint(1, 40),
                           incoming_amount=random.choice([10000, 50000, 120000]),
                           outgoing_amount=random.choice([5000, 40000, 100000])))
        commit_batch(acct_batch)
    accts_by_state = {}
    for ref, st in db.query(Account.masked_account_ref, Account.state).all():
        accts_by_state.setdefault(st, []).append(ref)
    # --- Cases (NCRP shape, nullable suspects) ---
    # Money-flow pattern: victim (complainant_state) -> mule account, which is
    # in a DIFFERENT state 55% of the time (Delhi victim -> Rajasthan mule).
    mule_info = []  # parallel to case_batch: (mule_lat, mule_lon, mule_state)
    n_mule_x = 0
    if db.query(Case).count() == 0:
        base = datetime(2026, 6, 1, 10, 0)
        case_batch = []
        for i in range(n_case):
            st, dist, slat, slon, _ = random.choice(STATES)
            ist, idist, ilat, ilon = st, dist, slat, slon
            sub = random.choice(SUBCATS)
            amt = random.choice([15000, 45000, 120000, 250000])
            inc = base + timedelta(hours=random.randint(0, 2000))
            # cross-state: 40% incident state != complainant state
            if maybe(0.4):
                ist, idist, ilat, ilon, _ = random.choice([s for s in STATES if s[0] != st])
            # mule account: linked to a REAL account row; 55% cross-state
            if maybe(0.75):
                others = [s for s in STATES if s[0] != st]
                mstate = random.choice(others)[0] if maybe(0.55) and others else st
                pool = accts_by_state.get(mstate, []) or accts_by_state.get(st, [])
                dst_ref = random.choice(pool) if pool else None
            else:
                dst_ref, mstate = None, st  # unlinkable destination (goes to NULL)
            mlat, mlon = CENTROID[mstate]
            if mstate != st:
                n_mule_x += 1
            mule_info.append((mlat + random.uniform(-0.1, 0.1),
                              mlon + random.uniform(-0.1, 0.1), mstate))
            case_batch.append(Case(
                external_case_id=f"C-{1000+i}",
                incident_datetime=inc, reported_at=inc + timedelta(minutes=random.randint(5, 300)),
                incident_details=f"{sub} fraud of Rs.{amt}",
                crime_category="Online Financial Fraud", crime_subcategory=sub, fraud_type=sub,
                complainant_state=st, complainant_district=dist,
                incident_state=ist, incident_district=idist,
                victim_lat=slat + random.uniform(-0.1, 0.1),
                victim_lon=slon + random.uniform(-0.1, 0.1),
                bank_name=random.choice(BANKS),
                transaction_id=f"UTR{random.randint(10**11, 10**12-1)}" if maybe(0.85) else None,
                transaction_datetime=inc,
                fraud_amount=amt, amount=amt,
                debited_account_ref=f"XXXX-{random.randint(1000,9999)}",
                destination_bank=random.choice(BANKS),
                destination_account_ref=dst_ref,
                merchant="MerchantX" if maybe(0.5) else None,
                gateway="GatewayX" if maybe(0.45) else None,
                evidence_ref="screenshot.pdf",
                complainant_contact_ref="98XXXXXX01",
                suspect_mobile=f"98XXXXXX{random.randint(10,99)}" if maybe(0.35) else None,
                suspect_email="sus@x.com" if maybe(0.20) else None,
                suspect_account_ref=f"XXXX-{random.randint(1000,9999)}" if maybe(0.30) else None,
                suspect_address="Withheld" if maybe(0.10) else None,
                suspect_url="t.me/xyz" if maybe(0.15) else None,
            ))
        commit_batch(case_batch)
    # Snapshot plain tuples (no expired-ORM re-fetch on Neon pooler).
    # mule geo zipped by insertion order (guard above ensures fresh insert).
    case_rows = db.query(Case.id, Case.transaction_id, Case.transaction_datetime,
                         Case.reported_at, Case.debited_account_ref,
                         Case.destination_account_ref, Case.fraud_amount,
                         Case.crime_subcategory, Case.bank_name,
                         Case.victim_lat, Case.victim_lon).order_by(Case.id).limit(n_case).all()
    if len(mule_info) != len(case_rows):
        # Reseed-safe fallback: derive mule geo from victim (same-state pattern)
        mule_info = [((vlat or 28.6), (vlon or 77.2), "") for
                     (_, _, _, _, _, _, _, _, _, vlat, vlon) in case_rows]
    enriched = [tuple(row) + m for row, m in zip(case_rows, mule_info)]
    # --- Transactions: destination-side activity lives near the MULE ---
    if db.query(Transaction).count() == 0:
        txn_batch = []
        for (cid, utr, txn_dt, rep_at, src_ref, dst_ref,
             fraud_amt, subcat, bank, vlat, vlon, mlat, mlon, mstate) in enriched:
            for _ in range(random.randint(1, 3)):
                txn_batch.append(Transaction(
                    case_id=cid, transaction_id=utr or f"UTR{random.randint(10**11,10**12-1)}",
                    timestamp=(txn_dt or rep_at),
                    source_account_ref=src_ref,
                    destination_account_ref=dst_ref or f"XXXX-{random.randint(1000,9999)}",
                    amount=fraud_amt, transaction_type=subcat,
                    bank=bank, status="SETTLED",
                    lat=mlat + random.uniform(-0.15, 0.15),
                    lon=mlon + random.uniform(-0.15, 0.15)))
        commit_batch(txn_batch)
    # --- Layer-2 splits (layering topology): 35% of linked cases fan out
    # L1 mule -> 2-3 L2 accounts within minutes; 25% reuse shared funnel nodes.
    l2_exists = db.query(Account).filter(Account.masked_account_ref.like("%-L2%")).count() > 0
    l2_pool: list = []
    l2_accts, l2_txns = [], []
    l2_idx = 0
    if not l2_exists:
        for (cid, utr, txn_dt, rep_at, src_ref, dst_ref,
             fraud_amt, subcat, bank, vlat, vlon, mlat, mlon, mstate) in enriched:
            if not dst_ref or not maybe(0.35):
                continue
            T0 = txn_dt or rep_at
            for _ in range(random.randint(2, 3)):
                if l2_pool and maybe(0.25):
                    l2ref, l2state = random.choice(l2_pool)  # funnel node
                else:
                    l2state = mstate if maybe(0.5) else random.choice(STATES)[0]
                    l2ref = f"XXXX-{random.randint(1000,9999)}-L2{l2_idx}"
                    l2_idx += 1
                    l2_accts.append(Account(
                        masked_account_ref=l2ref, bank_id=random.choice(BANKS),
                        state=l2state, recent_tx_count=random.randint(5, 60),
                        incoming_amount=random.choice([20000, 80000]),
                        outgoing_amount=random.choice([15000, 70000])))
                    l2_pool.append((l2ref, l2state))
                share = round((fraud_amt or 0) / random.uniform(2.2, 3.5), 2)
                l2_txns.append(Transaction(
                    case_id=cid, transaction_id=f"UTR{random.randint(10**11,10**12-1)}",
                    timestamp=T0 + timedelta(minutes=random.randint(5, 20)),
                    source_account_ref=dst_ref, destination_account_ref=l2ref,
                    amount=share, transaction_type=subcat, bank=bank, status="SETTLED",
                    lat=mlat + random.uniform(-0.2, 0.2),
                    lon=mlon + random.uniform(-0.2, 0.2)))
    if l2_accts:
        commit_batch(l2_accts)
    if l2_txns:
        commit_batch(l2_txns)
    print(f"layer2: {len(l2_accts)} L2 accounts, {len(l2_txns)} split txns")
    # --- Historical withdrawals (ground truth) ---
    # Criminals use NEARBY ATMs: 70% from nearest-8 to mule point,
    # 20% nearest-8 to victim, 10% anywhere (hard cases).
    # Time: 65% fast cash-out (10-55 min, inside 60-min horizon),
    # 35% evening-batch hour snapped within 5h.
    def nearest_k(lat, lon, k=8):
        return sorted(atm_rows, key=lambda t: haversine_m(lat, lon, t[1], t[2]))[:k]

    if db.query(Withdrawal).count() == 0:
        wd_batch = []
        for (cid, utr, txn_dt, rep_at, src_ref, dst_ref,
             fraud_amt, subcat, bank, vlat, vlon, mlat, mlon, mstate) in enriched:
            if not maybe(0.7):
                continue
            T0 = txn_dt or rep_at
            r = random.random()
            if r < 0.70:
                # Mule crews reuse luckies: mostly hot ATMs (high history =
                # high risk), sometimes nearest-8 (distance signal).
                hot = HOT.get(mstate, [])
                if hot and maybe(0.60):
                    aid = random.choice(hot)
                else:
                    aid = random.choice([t[0] for t in nearest_k(mlat, mlon)])
            elif r < 0.90:
                aid = random.choice([t[0] for t in nearest_k(vlat or 28.6, vlon or 77.2)])
            else:
                aid = random.choice(atm_rows)[0]
            if maybe(0.65):
                ts = T0 + timedelta(minutes=random.randint(10, 55))
            else:
                hh = random.choice(EVENING_HOURS)
                nxt = T0.replace(minute=5, second=0, microsecond=0)
                dh = (hh - nxt.hour) % 24
                nxt = nxt + timedelta(hours=dh)
                ts = nxt if (nxt - T0) <= timedelta(minutes=300) else T0 + timedelta(minutes=120)
            wd_batch.append(Withdrawal(atm_id=aid, linked_case_id=cid,
                              amount=min(fraud_amt, random.choice([10000, 20000, 40000])),
                              timestamp=ts))
        commit_batch(wd_batch)
    print(f"seeded scale={scale} cases={db.query(Case).count()} "
          f"atms={db.query(ATM).count()} txns={db.query(Transaction).count()} "
          f"withdrawals={db.query(Withdrawal).count()}")
    n_x = db.query(Case).filter(Case.complainant_state != Case.incident_state).count()
    print(f"cross-state incident={n_x} cross-state mule={n_mule_x}")
    db.close()

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--scale", default="demo", choices=["demo", "full"])
    run(ap.parse_args().scale)
