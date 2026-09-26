"""Candidate generation (§11). Money-flow context, not victim-only."""
from app.geo.spatial import haversine_m
from app.core.config import settings

def generate_candidates(db, case, ref_lat: float | None = None,
                        ref_lon: float | None = None,
                        atm_cache: list | None = None):
    from app.db.models import ATM
    # P1 FIX: use in-memory cache when available — avoids 500-row DB fetch per request
    atms = atm_cache if atm_cache else db.query(ATM).filter(ATM.is_active == 1).limit(500).all()
    if not atms:  # auto-seed minimal demo ATMs so MVP never returns empty
        seeds = [("ATM-DL-01", 28.61, 77.20, "Delhi"),
                 ("ATM-RJ-01", 26.91, 75.78, "Rajasthan"),
                 ("ATM-RJ-02", 26.95, 75.82, "Rajasthan"),
                 ("ATM-HR-03", 28.41, 77.31, "Haryana")]
        for code, lat, lon, st in seeds:
            db.add(ATM(atm_code=code, lat=lat, lon=lon, state=st, district="D-1"))
        db.commit()
        atms = db.query(ATM).filter(ATM.is_active == 1).limit(500).all()
    # Reference point: explicit ref (recent tx activity) else victim location
    plat = ref_lat if ref_lat is not None else (case.victim_lat or 28.6)
    plon = ref_lon if ref_lon is not None else (case.victim_lon or 77.2)
    scored = []
    for a in atms:
        d = haversine_m(plat, plon, a.lat, a.lon)
        scored.append((d, a))
    scored.sort(key=lambda x: x[0])
    # Union: nearest within radius + top historical (here: nearest N, capped)
    out = [a for d, a in scored if d <= settings.candidate_radius_m * 10]
    if not out:
        out = [a for _, a in scored[:settings.max_candidates]]
    return out[:settings.max_candidates]

