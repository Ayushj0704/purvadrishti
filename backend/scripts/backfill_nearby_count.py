"""P2 FIX: Precompute nearby_atm_count for all ATMs.

Replaces the O(n²) haversine loop that runs on EVERY prediction request
(30 candidates × 500 ATMs = 15,000 haversine calls) with a one-time
column value read.

Adds a nearby_atm_count column to the atms table (safe — defaults to 0).
Calculates and stores the count of active ATMs within 5km for each ATM.

Usage:
    PYTHONPATH=. python scripts/backfill_nearby_count.py
"""
from app.db.session import SessionLocal, Base, engine
from app.db.models import ATM
from app.geo.spatial import haversine_m
import math

RADIUS_M = 5000  # must match the value used in features.py

Base.metadata.create_all(bind=engine)  # creates nearby_atm_count column if missing

def run():
    db = SessionLocal(expire_on_commit=False)
    atms = db.query(ATM).filter(ATM.is_active == 1).all()
    print(f"[backfill_nearby] Computing nearby counts for {len(atms)} ATMs...")

    coords = [(a.lat, a.lon) for a in atms]
    updated = 0
    batch = []

    for i, a in enumerate(atms):
        count = 0
        for j, (la, lo) in enumerate(coords):
            if i == j:
                continue
            # cheap box pre-filter before expensive haversine
            if abs(la - a.lat) < 0.15 and abs(lo - a.lon) < 0.15:
                if haversine_m(a.lat, a.lon, la, lo) <= RADIUS_M:
                    count += 1
        if a.nearby_atm_count != count:
            a.nearby_atm_count = count
            updated += 1
        if (i + 1) % 100 == 0:
            db.commit()
            print(f"  [{i+1}/{len(atms)}] committed batch...")

    db.commit()
    print(f"[backfill_nearby] Done. Updated {updated}/{len(atms)} ATMs.")
    print(f"[backfill_nearby] Sample: {[(a.atm_code, a.nearby_atm_count) for a in atms[:5]]}")
    db.close()

if __name__ == "__main__":
    run()
