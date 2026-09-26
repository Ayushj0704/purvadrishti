import time
from app.db.session import SessionLocal
from app.db.models import Case
from app.services.candidate_service import generate_candidates
from app.ml.predict import score_candidates_batch
from app.main import _ATM_CACHE

db = SessionLocal(expire_on_commit=False)
t0 = time.time()
if not _ATM_CACHE:
    from app.db.models import ATM
    _ATM_CACHE.extend(db.query(ATM).filter(ATM.is_active == 1).limit(500).all())
print(f'cache-load: {time.time()-t0:.2f}s n={len(_ATM_CACHE)}')

c = db.query(Case).order_by(Case.id.desc()).first()
t0 = time.time()
cands = generate_candidates(db, c, 12.97, 77.59, atm_cache=_ATM_CACHE)
print(f'candidates: {time.time()-t0:.2f}s n={len(cands)}')
t0 = time.time()
scores = score_candidates_batch(db, c, cands, 12.97, 77.59)
print(f'scoring: {time.time()-t0:.2f}s n={len(scores)} top={scores and max(s[0] for s in scores)}')
db.close()
