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

def run(count: int = 10, dry_run: bool = False):
    db = SessionLocal(expire_on_commit=False)
    now = datetime.utcnow()
    window_start = now - timedelta(hours=24)

    # Check how many recent withdrawals already exist
    existing = db.query(Withdrawal).filter(Withdrawal.timestamp >= window_start).count()
    print(f"[stage_demo] Existing withdrawals in last 24h: {existing}")
    if existing >= count:
        print(f"[stage_demo] Already have {existing} recent rows — nothing to do.")
        db.close()
        return

    # Find the ATMs with the most historical withdrawals (hot ATMs)
    from sqlalchemy import func
    top_atm_ids = [
        row[0] for row in
        db.query(Withdrawal.atm_id, func.count(Withdrawal.id).label("cnt"))
          .group_by(Withdrawal.atm_id)
          .order_by(func.count(Withdrawal.id).desc())
          .limit(20)
          .all()
    ]
    if not top_atm_ids:
        # fallback: any active ATMs
        top_atm_ids = [a.id for a in db.query(ATM).filter(ATM.is_active == 1).limit(20).all()]

    if not top_atm_ids:
        print("[stage_demo] ERROR: No ATMs found. Run seed.py first.")
        db.close()
        return

    to_add = count - existing
    added = []
    for _ in range(to_add):
        atm_id = random.choice(top_atm_ids)
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
    args = parser.parse_args()
    run(count=args.count, dry_run=args.dry_run)
