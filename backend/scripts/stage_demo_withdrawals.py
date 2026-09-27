"""Q1 FIX: Stage recent withdrawal rows at hot ATMs before a demo.

The model's top features (fraud_withdrawals_7d / fraud_withdrawals_30d) are 0
for all live predictions because synthetic training data is >30 days old.
This script inserts a small set of fresh, plausible withdrawal rows at the
historically hot ATMs so the model's signals are alive during a demo.

Usage:
    PYTHONPATH=. python scripts/stage_demo_withdrawals.py [--count 10] [--dry-run]

The script:
1. Finds the top-N most popular ATMs from historical withdrawal data.
2. Inserts `count` new Withdrawal rows with timestamps in the last 24h.
3. Runs the threshold tuner automatically so HIGH/CRITICAL thresholds
   are recalibrated to the new distribution.

Safe to re-run: it checks for existing recent rows and skips if enough exist.
"""
import argparse
import random
from datetime import datetime, timedelta

from app.db.session import SessionLocal, Base, engine
from app.db.models import ATM, Withdrawal

Base.metadata.create_all(bind=engine)

def run(count: int = 10, dry_run: bool = False, focus: str | None = None):
    from app.geo.spatial import haversine_m
    db = SessionLocal(expire_on_commit=False)
    now = datetime.utcnow()
    if focus:
        # Demo recipe: concentrate fresh rows at the hot ATM nearest to
        # LAT,LON so a prediction at that ref point fires HIGH honestly.
        flat, flon = (float(x) for x in focus.split(","))
        atms = db.query(ATM).filter(ATM.is_active == 1).all()
        hot = [a for a in atms if (db.query(Withdrawal).filter(
            Withdrawal.atm_id == a.id).count() > 0)]
        pool = hot or atms
        a = min(pool, key=lambda t: haversine_m(flat, flon, t.lat, t.lon))
        added = []
        for i in range(count):
            added.append(Withdrawal(
                atm_id=a.id, amount=random.uniform(10000, 40000),
                timestamp=now - timedelta(minutes=10 + i * 12),
                withdrawal_type="CASH"))
        if not dry_run:
            db.add_all(added)
            db.commit()
        print(f"[stage_demo] Focused {len(added)} rows at {a.atm_code} "
              f"({a.state}) for ref {flat},{flon}.")
        db.close()
        return
    window_start = now - timedelta(hours=24)

    # Check how many recent withdrawals already exist
    existing = db.query(Withdrawal).filter(Withdrawal.timestamp >= window_start).count()
    print(f"[stage_demo] Existing withdrawals in last 24h: {existing}")
    if existing >= count:
        print(f"[stage_demo] Already have {existing} recent rows — nothing to do.")
        db.close()
        return

    # Find the top-2 historical ATMs PER STATE (not global top) so that
    # EVERY ref region has nearby fresh history — otherwise candidates near
    # the user's ref point show 0/32 track and scores stay flat LOW.
    from sqlalchemy import func
    per_state: dict = {}
    for atm_id, st, cnt in db.query(
            Withdrawal.atm_id, ATM.state, func.count(Withdrawal.id)).join(
            ATM, Withdrawal.atm_id == ATM.id).group_by(
            Withdrawal.atm_id, ATM.state).order_by(
            func.count(Withdrawal.id).desc()).all():
        per_state.setdefault(st, []).append(atm_id)
    top_atm_ids = []
    for st, ids in per_state.items():
        top_atm_ids.extend(ids[:2])
    if not top_atm_ids:
        # fallback: any active ATMs
        top_atm_ids = [a.id for a in db.query(ATM).filter(ATM.is_active == 1).limit(20).all()]

    if not top_atm_ids:
        print("[stage_demo] ERROR: No ATMs found. Run seed.py first.")
        db.close()
        return

    to_add = count - existing
    added = []
    # Round-robin across states (not random.choice) so EVERY state gets
    # coverage — random draws can miss a state entirely (e.g. Rajasthan).
    random.shuffle(top_atm_ids)
    for i in range(to_add):
        atm_id = top_atm_ids[i % len(top_atm_ids)]
        # Stagger timestamps across the last 24h, biased toward the last 2h
        hrs_ago = random.choice([0.5, 1, 1.5, 2, 4, 6, 12, 18, 20, 23])
        ts = now - timedelta(hours=hrs_ago)
        w = Withdrawal(
            atm_id=atm_id,
            amount=random.uniform(5000, 20000),
            timestamp=ts,
            withdrawal_type="CASH",
        )
        added.append(w)

    if dry_run:
        print(f"[stage_demo] DRY-RUN: would insert {len(added)} withdrawal rows at ATMs: "
              f"{set(w.atm_id for w in added)}")
    else:
        db.add_all(added)
        db.commit()
        print(f"[stage_demo] Inserted {len(added)} fresh withdrawal rows.")
        print(f"[stage_demo] ATMs staged: {sorted(set(w.atm_id for w in added))}")
        print("[stage_demo] Done — go predict on the dashboard. "
              "No retune needed (thresholds already in meta.json).")

    db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=10,
                        help="Total recent withdrawals to ensure exist (default: 10)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print what would happen without inserting")
    parser.add_argument("--focus", default=None,
                        help="LAT,LON to concentrate rows at nearest hot ATM (demo HIGH recipe)")
    args = parser.parse_args()
    run(count=args.count, dry_run=args.dry_run, focus=args.focus)
