from app.db.session import SessionLocal
from app.db.models import ATM
from app.geo.spatial import haversine_m

db = SessionLocal(expire_on_commit=False)
atms = db.query(ATM).filter(ATM.is_active == 1).all()
print('n=', len(atms))
a0 = atms[0]
print('a0:', a0.atm_code, a0.lat, a0.lon, a0.state)
d = sorted([(haversine_m(a0.lat, a0.lon, b.lat, b.lon), b.atm_code) for b in atms if b.id != a0.id])[:6]
print('nearest 6 (m, code):', [(round(x), c) for x, c in d])
same_state = sum(1 for b in atms if b.state == a0.state)
print('same-state count:', same_state)
db.close()
