"""Backfill h3_cell for ATMs missing it (computed at res from settings)."""
from app.db.session import SessionLocal
from app.db.models import ATM
from app.core.config import settings
import h3

db = SessionLocal(expire_on_commit=False)
rows = db.query(ATM).filter((ATM.h3_cell == "") | (ATM.h3_cell.is_(None))).all()
print(f"missing={len(rows)}")
for a in rows:
    try:
        a.h3_cell = h3.latlng_to_cell(a.lat, a.lon, settings.h3_resolution)
    except Exception:
        a.h3_cell = ""
db.commit()
print("backfilled:", db.query(ATM).filter(ATM.h3_cell != "").count(), "/", db.query(ATM).count())
db.close()
