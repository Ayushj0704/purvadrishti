from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, HTMLResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import asyncio, json, time, uuid

from app.core.config import settings
from app.core.logging import log
from app.core.security import DEMO_USERS, create_token, decode_token
from app.db.session import Base, engine, get_db
from app.db.models import Case, ATM, Prediction, Alert
from app.services.candidate_service import generate_candidates
from app.ml.predict import score_multi, model_available, model_label, get_thresholds, _load as _load_model
from app.geo.spatial import risk_level

Base.metadata.create_all(bind=engine)
app = FastAPI(title="PurvaDrishti Backend", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

EVENT_QUEUE: asyncio.Queue = asyncio.Queue()

# P1: In-memory ATM cache — loaded once at startup, avoids 500-row DB fetch per request
_ATM_CACHE: list = []

@app.on_event("startup")
def startup_warmup():
    """P5+P6: Eager model load + Neon warm-up ping + ATM cache load."""
    # P6: Wake up Neon (free tier suspends when idle — multi-second penalty on first request)
    try:
        db = next(get_db())
        db.execute(text("SELECT 1"))
        # P1: Load all ATMs into memory once
        _ATM_CACHE.extend(db.query(ATM).filter(ATM.is_active == 1).limit(500).all())
        db.close()
        log.info(f"startup: ATM cache loaded ({len(_ATM_CACHE)} ATMs)")
    except Exception as e:
        log.warning(f"startup warm-up failed (will retry on first request): {e}")
    # P5: Load XGBoost at startup — avoids 1-2s init on first prediction request
    _load_model()
    log.info(f"startup: model={'loaded' if model_available() else 'heuristic-fallback'}")
    # Demo feed: keep recent-withdrawal layer alive so history features work
    # out of the box. Skipped under pytest and when disabled for production.
    import os as _os
    if settings.demo_autostage and not _os.environ.get("PYTEST_CURRENT_TEST"):
        try:
            from scripts.stage_demo_withdrawals import run as _stage
            _stage(count=10)
        except Exception as e:
            log.warning(f"demo autostage skipped: {e}")



class LoginIn(BaseModel):
    username: str
    password: str

class CaseIn(BaseModel):
    # NCRP complaint fields (suspect/optional all nullable)
    fraud_type: str = "UPI"
    crime_subcategory: str | None = None
    amount: float = 0
    victim_location: dict | None = None
    external_case_id: str | None = None
    incident_datetime: str | None = None
    incident_details: str = ""
    complainant_state: str = ""
    complainant_district: str = ""
    incident_state: str = ""
    incident_district: str = ""
    bank_name: str = ""
    transaction_id: str | None = None
    destination_bank: str = ""
    destination_account_ref: str | None = None
    merchant: str | None = None
    gateway: str | None = None
    suspect_mobile: str | None = None
    suspect_email: str | None = None
    suspect_account_ref: str | None = None
    suspect_address: str | None = None
    suspect_url: str | None = None

class PredictIn(BaseModel):
    horizon_minutes: int = 60
    ref_lat: float | None = None
    ref_lon: float | None = None

def err(code: str, msg: str, rid: str):
    return {"error": {"code": code, "message": msg, "request_id": rid}}

def audit(db, role: str, action: str, rtype: str, rid):
    try:
        from app.db.models import AuditLog
        db.add(AuditLog(actor_role=role or "demo", action=action,
                        resource_type=rtype, resource_id=str(rid)))
        db.commit()
    except Exception as e:
        log.warning(f"audit failed: {e}")

@app.get("/health")
def health():
    return {"status": "ok", "database": "ok",
            "model": "loaded" if model_available() else "heuristic-fallback"}

@app.get("/ready")
def ready():
    return health()

@app.post("/api/v1/auth/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    u = DEMO_USERS.get(body.username)
    if not u or u["password"] != body.password:
        raise HTTPException(401, "invalid credentials")
    audit(db, u["role"], "login", "user", body.username)
    return {"access_token": create_token(body.username, u["role"]), "role": u["role"]}

@app.post("/api/v1/cases")
def create_case(body: CaseIn, db: Session = Depends(get_db)):
    rid = str(uuid.uuid4())[:8]
    ext = body.external_case_id or f"C-{int(time.time())}"
    lat = (body.victim_location or {}).get("lat")
    lon = (body.victim_location or {}).get("lon")
    from datetime import datetime as dt
    inc_dt = None
    try:
        if body.incident_datetime:
            inc_dt = dt.fromisoformat(body.incident_datetime.replace("Z", ""))
    except Exception:
        inc_dt = None
    sub = body.crime_subcategory or body.fraud_type
    c = Case(external_case_id=ext, fraud_type=body.fraud_type,
             crime_subcategory=sub, amount=body.amount, fraud_amount=body.amount,
             victim_lat=lat, victim_lon=lon, incident_datetime=inc_dt,
             incident_details=body.incident_details,
             complainant_state=body.complainant_state,
             complainant_district=body.complainant_district,
             incident_state=body.incident_state or body.complainant_state,
             incident_district=body.incident_district,
             bank_name=body.bank_name, transaction_id=body.transaction_id,
             destination_bank=body.destination_bank,
             destination_account_ref=body.destination_account_ref,
             merchant=body.merchant, gateway=body.gateway,
             suspect_mobile=body.suspect_mobile, suspect_email=body.suspect_email,
             suspect_account_ref=body.suspect_account_ref,
             suspect_address=body.suspect_address, suspect_url=body.suspect_url)
    db.add(c); db.commit(); db.refresh(c)
    log.info(f"case_created case_id={c.id}")
    return {"case_id": c.id, "external_case_id": ext, "request_id": rid}

from app.api.deps import require_roles


class IngestIn(CaseIn):
    """I4C/CFCFRMS portal push (auto-fetch path). Same NCRP shape + source."""
    source_system: str = "CFCFRMS"

@app.post("/api/v1/cases/ingest")
def ingest_case(body: IngestIn, db: Session = Depends(get_db),
                role: str = Depends(require_roles("LEA_OFFICER"))):
    """Portal auto-fetch: idempotent on acknowledgement ID.
    Manual dashboard entry stays as fallback (POST /cases)."""
    from app.db.models import Transaction
    ext = body.external_case_id
    if not ext:
        raise HTTPException(422, "external_case_id (ack ID) required for ingest")
    c = db.query(Case).filter(Case.external_case_id == ext).first()
    if c:
        return {"case_id": c.id, "external_case_id": ext, "deduped": True}
    sub = body.crime_subcategory or body.fraud_type
    lat = (body.victim_location or {}).get("lat")
    lon = (body.victim_location or {}).get("lon")
    c = Case(external_case_id=ext, fraud_type=body.fraud_type,
             crime_subcategory=sub, amount=body.amount, fraud_amount=body.amount,
             victim_lat=lat, victim_lon=lon,
             complainant_state=body.complainant_state,
             complainant_district=body.complainant_district,
             incident_state=body.incident_state or body.complainant_state,
             incident_district=body.incident_district,
             bank_name=body.bank_name, transaction_id=body.transaction_id,
             destination_bank=body.destination_bank,
             destination_account_ref=body.destination_account_ref,
             merchant=body.merchant, gateway=body.gateway,
             suspect_mobile=body.suspect_mobile, suspect_email=body.suspect_email,
             suspect_account_ref=body.suspect_account_ref,
             suspect_address=body.suspect_address, suspect_url=body.suspect_url,
             source=body.source_system.lower())
    db.add(c); db.commit(); db.refresh(c)
    if body.transaction_id:  # link the portal's UTR as first feed row
        db.add(Transaction(case_id=c.id, transaction_id=body.transaction_id,
                           amount=body.amount, bank=body.bank_name,
                           transaction_type=sub, lat=lat, lon=lon))
        db.commit()
    log.info(f"case_ingested case_id={c.id} source={c.source}")
    audit(db, role, "ingest", "case", c.id)
    return {"case_id": c.id, "external_case_id": ext, "deduped": False}

class TxnIn(BaseModel):
    transaction_id: str = ""
    amount: float = 0
    source_account_ref: str = ""
    destination_account_ref: str = ""
    transaction_type: str = "UPI"
    bank: str = ""
    lat: float | None = None
    lon: float | None = None

@app.post("/api/v1/cases/{case_id}/transactions")
def add_txn(case_id: int, body: TxnIn, db: Session = Depends(get_db)):
    from app.db.models import Transaction
    c = db.query(Case).filter(Case.id == case_id).first()
    if not c: raise HTTPException(404, "case not found")
    t = Transaction(case_id=case_id, transaction_id=body.transaction_id,
                    amount=body.amount, source_account_ref=body.source_account_ref,
                    destination_account_ref=body.destination_account_ref,
                    transaction_type=body.transaction_type, bank=body.bank,
                    lat=body.lat, lon=body.lon)
    db.add(t); db.commit()
    return {"ok": True, "txn_id": t.id}

@app.get("/api/v1/cases/{case_id}/transactions")
def list_txn(case_id: int, db: Session = Depends(get_db)):
    from app.db.models import Transaction
    return [{"txn_id": t.id, "transaction_id": t.transaction_id, "amount": t.amount,
             "type": t.transaction_type, "bank": t.bank}
            for t in db.query(Transaction).filter(Transaction.case_id == case_id).limit(100).all()]

@app.get("/api/v1/cases")
def list_cases(db: Session = Depends(get_db)):
    return [{"case_id": c.id, "external_case_id": c.external_case_id,
             "fraud_type": c.fraud_type, "amount": c.amount,
             "status": c.status} for c in db.query(Case).limit(100).all()]

@app.get("/api/v1/cases/samples")
def sample_cases(limit: int = 20, state: str | None = None,
                 db: Session = Depends(get_db)):
    """Demo pool for 'Simulate I4C portal fetch': random seeded cases.
    Real deployment replaces this with the CFCFRMS poller."""
    import random as _r
    q = db.query(Case).order_by(Case.id.desc()).limit(500).all()
    if state:
        q = [c for c in q if c.incident_state == state or c.complainant_state == state]
    picks = _r.sample(q, min(limit, len(q))) if q else []
    return [{"case_id": c.id, "external_case_id": c.external_case_id,
             "subcategory": c.crime_subcategory, "amount": c.fraud_amount,
             "incident_state": c.incident_state,
             "complainant_state": c.complainant_state,
             "source": getattr(c, "source", "manual")} for c in picks]

@app.get("/api/v1/cases/{case_id}")
def get_case(case_id: int, db: Session = Depends(get_db)):
    c = db.query(Case).filter(Case.id == case_id).first()
    if not c: raise HTTPException(404, "case not found")
    return {"case_id": c.id, "external_case_id": c.external_case_id,
            "fraud_type": c.fraud_type, "amount": c.amount, "status": c.status,
            "victim_location": {"lat": c.victim_lat, "lon": c.victim_lon}}

@app.get("/api/v1/cases/{case_id}/candidates")
def candidates(case_id: int, db: Session = Depends(get_db)):
    c = db.query(Case).filter(Case.id == case_id).first()
    if not c: raise HTTPException(404, "case not found")
    return {"case_id": case_id,
            "candidates": [{"atm_id": a.id, "atm_code": a.atm_code,
                            "lat": a.lat, "lon": a.lon, "state": a.state}
                           for a in generate_candidates(db, c)]}

@app.post("/api/v1/cases/{case_id}/predictions")
async def predict(case_id: int, body: PredictIn, db: Session = Depends(get_db)):
    c = db.query(Case).filter(Case.id == case_id).first()
    if not c: raise HTTPException(404, "case not found")
    # P1: use in-memory ATM cache if populated, else fall back to DB
    cached = _ATM_CACHE if _ATM_CACHE else None
    cands = generate_candidates(db, c, body.ref_lat, body.ref_lon, atm_cache=cached)
    multi = score_multi(db, c, cands, body.ref_lat, body.ref_lon)
    # Burst heat (unsupervised, observed counts — spec §16 second signal)
    from datetime import datetime as _dtm
    from app.ml.burst import burst_levels
    heat = burst_levels(db, [a.id for a in cands], _dtm.utcnow())
    for a, m in zip(cands, multi):
        h = heat.get(a.id, {"n2h": 0, "n6h": 0, "level": "LOW"})
        if h["level"] != "LOW":
            m["basis"] = f"burst-heat ({h['level']}, {h['n2h']} in 2h)"
            m["reasons"] = [f"Burst: {h['n2h']} withdrawals in last 2 hours "
                            f"at this ATM (observed)"] + m["reasons"][:3]
    label = model_label() if model_available() else "heuristic-fallback"
    HIGH_T, CRIT_T = get_thresholds(60) if model_available() else (0.70, 0.85)
    scored = []
    new_preds = []
    for a, m in zip(cands, multi):
        s, reasons = m["scores"][60], m["reasons"]
        cell = getattr(a, "h3_cell", "") or ""
        if not cell:
            try:  # H3 cell, best-effort
                import h3
                cell = h3.latlng_to_cell(a.lat, a.lon, settings.h3_resolution)
            except Exception:
                cell = ""
        p = Prediction(case_id=c.id, atm_id=a.id, h3_cell=cell,
                       prediction_score=s, risk_level=risk_level(s, HIGH_T, CRIT_T),
                       horizon_minutes=body.horizon_minutes,
                       model_version=label)
        new_preds.append((s, a, p, reasons, m))
    db.add_all([p for (_, _, p, _, _) in new_preds])
    db.flush()  # single round-trip (was: flush per row)
    scored = [(s, a, p, r) for (s, a, p, r, _) in new_preds]
    db.commit()
    scored.sort(key=lambda x: -x[0])
    top = scored[:settings.top_k]
    by_key = {(s, a.id): m for (s, a, p, r, m) in new_preds}
    margin = round(top[0][0] - top[1][0], 3) if len(top) > 1 else 0.0
    preds = []
    for i, (s, a, p, r) in enumerate(top):
        m = by_key[(s, a.id)]
        h = heat.get(a.id, {"n2h": 0, "n6h": 0, "level": "LOW"})
        preds.append({"atm_id": a.atm_code, "lat": a.lat, "lon": a.lon,
                      "score": s, "risk_level": risk_level(s, HIGH_T, CRIT_T),
                      "scores": m["scores"],
                      "predicted_window": m["predicted_window"],
                      "basis": m["basis"],
                      "heat": h,
                      "best_bet": i == 0,
                      "h3_cell": p.h3_cell, "top_reasons": r})
    n_hot = sum(1 for (s, a, p, r, m) in new_preds
                if heat.get(a.id, {}).get("level", "LOW") != "LOW")
    basis_note = (f"{n_hot}/{len(new_preds)} candidates show recent burst activity; "
                  "rest ranked on geography + case profile."
                  if n_hot < len(new_preds) else
                  "All top candidates show recent burst activity + geography.")
    # Heat watch: bursting ATMs anywhere among candidates (independent of
    # case-rank — patrol needs to know even if the case model ranks it #20).
    heat_watch = []
    for (s, a, p, r) in scored:
        h = heat.get(a.id, {})
        if h.get("level") == "HIGH":
            heat_watch.append({"atm_id": a.atm_code, "lat": a.lat, "lon": a.lon,
                               "score": s, "n2h": h.get("n2h", 0),
                               "n6h": h.get("n6h", 0), "h3_cell": p.h3_cell})
    heat_watch.sort(key=lambda x: (-x["n2h"], -x["score"]))
    # Alert on HIGH case-score OR HIGH burst heat (either signal fires)
    fire = None
    if top and top[0][0] >= HIGH_T:
        fire = (top[0], "model")
    if not fire and heat_watch:
        w0 = heat_watch[0]
        match = next(((s, a, p, r) for (s, a, p, r) in scored
                      if a.atm_code == w0["atm_id"]), None)
        if match:
            fire = (match, "burst")
    if fire:
        (s, a, p, r), why = fire
        al = Alert(case_id=c.id, prediction_id=p.id,
                   severity="CRITICAL" if (s >= CRIT_T or why == "burst") else "HIGH",
                   channel=settings.alert_channels,
                   message=f"Predicted cash-out {a.atm_code} score={s} via={why} "
                           f"heat={heat.get(a.id, {}).get('level')}")
        db.add(al); db.commit(); db.refresh(al)
        from app.notifications.providers import fan_out
        window = by_key[(s, a.id)]["predicted_window"]
        delivery = await fan_out(al.id, c.id, al.severity, a.atm_code, s,
                                 window, EVENT_QUEUE)
        log.info(f"alert_fanout alert_id={al.id} {delivery}")
    await EVENT_QUEUE.put({"event": "prediction.completed",
                           "data": {"case_id": c.id,
                                    "top_score": top[0][0] if top else 0}})
    return {"case_id": c.external_case_id, "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "horizon_minutes": body.horizon_minutes, "model_version": label,
            "basis_note": basis_note,
            "ranking_note": (f"Best bet {top[0][1].atm_code} leads runner-up by {margin} "
                             f"among {len(scored)} candidates." if top else "No candidates."),
            "heat_watch": heat_watch,
            "predictions": preds}

@app.get("/api/v1/risk/hotspots")
def hotspots(state: str | None = None, risk: str | None = None,
             min_score: float = 0.0, limit: int = 200,
             category: str | None = None, hours_back: int | None = None,
             db: Session = Depends(get_db)):
    from datetime import datetime as _dt, timedelta as _td
    q = db.query(Prediction).join(Case, Prediction.case_id == Case.id)
    if category:
        q = q.filter(Case.crime_subcategory == category)
    if hours_back:
        q = q.filter(Prediction.generated_at >= _dt.utcnow() - _td(hours=hours_back))
    q = q.order_by(Prediction.prediction_score.desc()).limit(1000).all()
    # P7 FIX: build ATM lookup from cache (O(1)) instead of N individual DB queries
    atm_lookup = {a.id: a for a in _ATM_CACHE} if _ATM_CACHE else {}
    cells = {}
    for p in q:
        if p.prediction_score < min_score:
            continue
        if risk and p.risk_level != risk.upper():
            continue
        a = atm_lookup.get(p.atm_id) or db.query(ATM).filter(ATM.id == p.atm_id).first()
        if state and a and a.state != state: continue
        key = p.h3_cell or f"{a.lat:.2f},{a.lon:.2f}" if a else "unknown"
        if key not in cells or cells[key]["risk_score"] < p.prediction_score:
            cells[key] = {"h3_cell": key, "risk_score": p.prediction_score,
                          "risk_level": p.risk_level, "active_cases": 1,
                          "state": a.state if a else ""}
    out = sorted(cells.values(), key=lambda c: -c["risk_score"])[:limit]
    return {"cells": out, "count": len(out)}

@app.get("/api/v1/alerts")
def list_alerts(db: Session = Depends(get_db)):
    return [{"alert_id": a.id, "case_id": a.case_id, "severity": a.severity,
             "status": a.status, "message": a.message}
            for a in db.query(Alert).order_by(Alert.id.desc()).limit(100).all()]

@app.post("/api/v1/alerts/{alert_id}/acknowledge")
def ack(alert_id: int, db: Session = Depends(get_db),
        role: str = Depends(require_roles("LEA_OFFICER"))):
    a = db.query(Alert).filter(Alert.id == alert_id).first()
    if not a: raise HTTPException(404, "alert not found")
    a.status = "ACKED"; db.commit()
    audit(db, role, "acknowledge", "alert", alert_id)
    return {"alert_id": alert_id, "status": "ACKED"}

@app.get("/api/v1/cases/{case_id}/timeline")
def timeline(case_id: int, db: Session = Depends(get_db)):
    """Investigator timeline: complaint → txns → withdrawals → predictions → alerts."""
    from app.db.models import Transaction, Withdrawal
    c = db.query(Case).filter(Case.id == case_id).first()
    if not c: raise HTTPException(404, "case not found")
    ev = []
    if c.reported_at: ev.append({"t": c.reported_at.isoformat(), "kind": "complaint",
                                 "text": f"{c.crime_subcategory} ₹{c.fraud_amount} ({c.external_case_id})"})
    for t in db.query(Transaction).filter(Transaction.case_id == case_id).all():
        ev.append({"t": (t.timestamp or c.reported_at).isoformat(), "kind": "transaction",
                   "text": f"{t.transaction_type} ₹{t.amount} {t.transaction_id}"})
    for w in db.query(Withdrawal).filter(Withdrawal.linked_case_id == case_id).all():
        a = db.query(ATM).filter(ATM.id == w.atm_id).first()
        ev.append({"t": w.timestamp.isoformat(), "kind": "withdrawal",
                   "text": f"₹{w.amount} at {a.atm_code if a else w.atm_id}"})
    for p in db.query(Prediction).filter(Prediction.case_id == case_id).all():
        a = db.query(ATM).filter(ATM.id == p.atm_id).first()
        ev.append({"t": p.generated_at.isoformat(), "kind": "prediction",
                   "text": f"{a.atm_code if a else p.atm_id} {p.prediction_score} {p.risk_level}"})
    for al in db.query(Alert).filter(Alert.case_id == case_id).all():
        ev.append({"t": al.created_at.isoformat(), "kind": "alert",
                   "text": f"{al.severity}: {al.message} [{al.status}]"})
    ev.sort(key=lambda e: e["t"])
    return {"case_id": case_id, "events": ev}


@app.get("/api/v1/cases/{case_id}/explanations")
def explanations(case_id: int, db: Session = Depends(get_db)):
    """Top prediction + honest feature values behind its reasons."""
    from app.ml.features import build_features_batch, FEATURES
    c = db.query(Case).filter(Case.id == case_id).first()
    if not c: raise HTTPException(404, "case not found")
    p = db.query(Prediction).filter(Prediction.case_id == case_id).order_by(
        Prediction.prediction_score.desc()).first()
    if not p: raise HTTPException(404, "no predictions yet")
    a = db.query(ATM).filter(ATM.id == p.atm_id).first()
    pairs = build_features_batch(db, c, [a])
    feats = pairs[0][1] if pairs else {}
    return {"case_id": case_id, "atm_id": a.atm_code if a else None,
            "score": p.prediction_score, "risk_level": p.risk_level,
            "model_version": p.model_version,
            "features": {k: round(float(v), 1) for k, v in feats.items()}}


@app.get("/api/v1/cases/{case_id}/similar-cases")
def similar_cases(case_id: int, limit: int = 5, db: Session = Depends(get_db)):
    c = db.query(Case).filter(Case.id == case_id).first()
    if not c: raise HTTPException(404, "case not found")
    lo, hi = (c.fraud_amount or 0) * 0.5, (c.fraud_amount or 0) * 2.0 + 1
    rows = db.query(Case).filter(
        Case.id != case_id, Case.crime_subcategory == c.crime_subcategory,
        Case.fraud_amount.between(lo, hi)).order_by(Case.id.desc()).limit(limit).all()
    return [{"case_id": r.id, "external_case_id": r.external_case_id,
             "subcategory": r.crime_subcategory, "amount": r.fraud_amount,
             "incident_state": r.incident_state,
             "reported_at": r.reported_at.isoformat() if r.reported_at else None}
            for r in rows]


@app.post("/api/v1/cases/{case_id}/report")
def report(case_id: int, db: Session = Depends(get_db)):
    """Draft intelligence report from REAL backend rows only (DEMO data
    labelled; nothing invented — LLM wording layer may polish later)."""
    from app.db.models import Transaction
    c = db.query(Case).filter(Case.id == case_id).first()
    if not c: raise HTTPException(404, "case not found")
    preds = db.query(Prediction).filter(Prediction.case_id == case_id).order_by(
        Prediction.prediction_score.desc()).limit(5).all()
    lines = [f"Top-{len(preds)} predicted cash-out locations (model: " +
             (preds[0].model_version if preds else "n/a") + "):"]
    for p in preds:
        a = db.query(ATM).filter(ATM.id == p.atm_id).first()
        lines.append(f"- {a.atm_code if a else p.atm_id} ({a.state if a else '?'}) "
                     f"score={p.prediction_score} risk={p.risk_level} cell={p.h3_cell}")
    n_tx = db.query(Transaction).filter(Transaction.case_id == case_id).count()
    return {
        "case_id": case_id, "banner": "DRAFT",
        "title": f"Cash-out intelligence — {c.external_case_id}",
        "summary": (f"{c.crime_subcategory} fraud of ₹{c.fraud_amount}; victim context "
                    f"{c.complainant_state}; incident {c.incident_state}; "
                    f"{n_tx} linked transactions on record."),
        "predictions": lines,
        "note": "Ranked intelligence for authorized human decision-makers; "
                "not a directive for field action.",
    }


@app.get("/api/v1/cases/{case_id}/trail")
def trail(case_id: int, db: Session = Depends(get_db)):
    """Money-trail graph for chain visualisation:
    victim → L1 mule → L2 mules → top predicted ATMs (nodes + edges)."""
    import networkx as nx
    from app.db.models import Transaction
    c = db.query(Case).filter(Case.id == case_id).first()
    if not c: raise HTTPException(404, "case not found")
    G = nx.DiGraph()
    G.add_node("victim", kind="victim", label=f"Victim ({c.complainant_state})",
               amount=c.fraud_amount)
    txns = db.query(Transaction).filter(Transaction.case_id == case_id).all()
    for t in txns:
        G.add_node(t.destination_account_ref or "?", kind="mule",
                   label=(t.destination_account_ref or "?")[-9:])
        G.add_edge(t.source_account_ref or "victim",
                   t.destination_account_ref or "?",
                   amount=t.amount, type=t.transaction_type)
    if c.destination_account_ref and c.destination_account_ref not in G:
        G.add_node(c.destination_account_ref, kind="mule",
                   label=c.destination_account_ref[-9:])
        G.add_edge("victim", c.destination_account_ref, amount=c.fraud_amount)
    preds = db.query(Prediction).filter(Prediction.case_id == case_id).order_by(
        Prediction.prediction_score.desc()).limit(5).all()
    for p in preds:
        a = db.query(ATM).filter(ATM.id == p.atm_id).first()
        node = a.atm_code if a else f"ATM-{p.atm_id}"
        G.add_node(node, kind="atm", label=node, score=p.prediction_score,
                   risk=p.risk_level, lat=a.lat if a else None,
                   lon=a.lon if a else None)
        src = c.destination_account_ref if c.destination_account_ref in G else "victim"
        G.add_edge(src, node, amount=None, type="predicted cash-out")
    try:
        order = list(nx.topological_sort(G))
        depth = int(nx.dag_longest_path_length(G)) + 1
    except Exception:
        order = list(G.nodes)
        depth = None
    return {"case_id": case_id,
            "nodes": [{"id": n, **G.nodes[n]} for n in order],
            "edges": [{"from": u, "to": v, **G.edges[u, v]} for u, v in G.edges],
            "depth": depth}


@app.get("/", response_class=HTMLResponse)
def dashboard():
    import pathlib
    p = pathlib.Path(__file__).parent / "static" / "index.html"
    return p.read_text() if p.exists() else "<a href='/docs'>/docs</a>"

@app.get("/test", response_class=HTMLResponse)
def test_page():
    import pathlib
    p = pathlib.Path(__file__).parent / "static" / "test.html"
    return p.read_text() if p.exists() else "<a href='/docs'>/docs</a>"

@app.get("/api/v1/events/stream")
async def sse():
    async def gen():
        yield ": connected\n\n"
        while True:
            try:
                msg = await asyncio.wait_for(EVENT_QUEUE.get(), timeout=15)
                yield f"event: {msg['event']}\ndata: {json.dumps(msg['data'])}\n\n"
            except asyncio.TimeoutError:
                yield ": heartbeat\n\n"
    return StreamingResponse(gen(), media_type="text/event-stream")
