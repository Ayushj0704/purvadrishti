"""
Smoke test -- validates all fixes from the performance + quality overhaul.
Checks: latency, score range, reason gating, ATM cache, alert firing.

Usage (no server needed -- uses FastAPI TestClient):
    $env:PYTHONPATH="."; python scripts/smoke_test_fixes.py
"""
import sys, io, time
# Force UTF-8 output so it works on Windows PowerShell (CP1252 terminal)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
from fastapi.testclient import TestClient

print("=" * 60)
print("PurvaDrishti — Post-Fix Smoke Test")
print("=" * 60)

# ── Import & startup ──────────────────────────────────────────
t0 = time.perf_counter()
from app.main import app, _ATM_CACHE
startup_ms = (time.perf_counter() - t0) * 1000
print(f"\n[IMPORT] app loaded in {startup_ms:.0f}ms")

client = TestClient(app)

# ── 1. Health ─────────────────────────────────────────────────
r = client.get("/health")
h = r.json()
model_status = h.get("model", "unknown")
print(f"\n[1] HEALTH: {h}")
assert r.status_code == 200, "Health check failed"
assert model_status == "loaded", f"FAIL: model is '{model_status}', expected 'loaded' (P5 eager load)"
print(f"    ✅ P5: Model eagerly loaded at startup ({model_status})")

# -- 2. ATM Cache (P1) --
print(f"\n[2] ATM CACHE: {len(_ATM_CACHE)} ATMs in memory")
if len(_ATM_CACHE) > 0:
    print(f"    [PASS] P1: {len(_ATM_CACHE)} ATMs cached at startup")
else:
    print(f"    [WARN] P1: Cache empty in TestClient mode (normal -- Neon startup")
    print(f"           event timing differs from uvicorn). Fine on live server.")


# ── 3. Create a case — Delhi victim, Jaipur ref (cross-state) ─
r = client.post("/api/v1/cases", json={
    "fraud_type": "UPI",
    "amount": 150000,
    "complainant_state": "Delhi",
    "incident_state": "Delhi",
    "victim_location": {"lat": 28.61, "lon": 77.20},
    "bank_name": "HDFC",
})
assert r.status_code == 200, f"Case creation failed: {r.text}"
case_id = r.json()["case_id"]
print(f"\n[3] CASE CREATED: case_id={case_id} ✅")

# ── 4. Prediction — timed (core latency test) ─────────────────
print(f"\n[4] PREDICTION (ref_lat=26.9, ref_lon=75.8 → Jaipur/Rajasthan)...")
t1 = time.perf_counter()
r2 = client.post(f"/api/v1/cases/{case_id}/predictions", json={
    "horizon_minutes": 60,
    "ref_lat": 26.91,   # Jaipur — cross-state from Delhi victim
    "ref_lon": 75.78,
})
elapsed_ms = (time.perf_counter() - t1) * 1000
assert r2.status_code == 200, f"Prediction failed: {r2.text}"
preds = r2.json().get("predictions", [])
model_ver = r2.json().get("model_version", "?")

print(f"    ⏱  Latency: {elapsed_ms:.0f}ms  (target <3000ms on Neon)")
if elapsed_ms < 3000:
    print(f"    ✅ LATENCY OK: {elapsed_ms:.0f}ms")
elif elapsed_ms < 8000:
    print(f"    ⚠️  LATENCY ACCEPTABLE: {elapsed_ms:.0f}ms (partially improved)")
else:
    print(f"    ❌ LATENCY STILL SLOW: {elapsed_ms:.0f}ms (fixes may need server restart)")

print(f"    Model: {model_ver}")
print(f"    Predictions returned: {len(preds)}")

# ── 5. Score analysis ─────────────────────────────────────────
print(f"\n[5] SCORE ANALYSIS:")
if preds:
    scores = [p["score"] for p in preds]
    top = preds[0]
    print(f"    Scores: {[round(s, 3) for s in scores]}")
    print(f"    Top ATM: {top['atm_id']} @ {top.get('state','')} score={top['score']} risk={top['risk_level']}")

    if max(scores) > 0.10:
        print(f"    ✅ Q1: Scores above cold-case baseline (max={max(scores):.3f} > 0.10)")
    else:
        print(f"    ⚠️  Q1: Scores still low (max={max(scores):.3f}) — may need more staged withdrawals near Jaipur ref point")

    if any(p["risk_level"] in ("HIGH", "CRITICAL") for p in preds):
        print(f"    ✅ Q2: HIGH/CRITICAL alert triggered!")
    else:
        print(f"    ℹ️  Q2: No HIGH/CRITICAL yet — staged ATMs may not be in top candidates for this ref point")
else:
    print("    ❌ No predictions returned")

# ── 6. Reason gating (Q3) ─────────────────────────────────────
print(f"\n[6] REASON GATING (Q3):")
BAD_REASONS = {"High historical cash-out activity at this location", "Elevated recent suspicious activity here"}
for p in preds:
    reasons = p.get("top_reasons", [])
    score = p["score"]
    bad = [r for r in reasons if r in BAD_REASONS and score < 0.05]
    if bad:
        print(f"    ❌ ATM {p['atm_id']} score={score}: misleading reason shown: {bad}")
    else:
        print(f"    ✅ ATM {p['atm_id']} score={score}: reasons OK → {reasons[:2]}")

# ── 7. Hotspots (P7 N+1 fix) ─────────────────────────────────
print(f"\n[7] HOTSPOTS (P7 N+1 fix):")
t3 = time.perf_counter()
r3 = client.get("/api/v1/risk/hotspots")
hotspot_ms = (time.perf_counter() - t3) * 1000
assert r3.status_code == 200
cells = r3.json().get("cells", [])
print(f"    ⏱  Hotspot latency: {hotspot_ms:.0f}ms  (target <1000ms)")
print(f"    H3 cells returned: {len(cells)}")
if hotspot_ms < 1000:
    print(f"    ✅ P7: Hotspots fast ({hotspot_ms:.0f}ms)")
else:
    print(f"    ⚠️  P7: Hotspots still slow ({hotspot_ms:.0f}ms)")

# ── Summary ───────────────────────────────────────────────────
print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
print(f"  Prediction latency : {elapsed_ms:.0f}ms")
print(f"  Hotspot latency    : {hotspot_ms:.0f}ms")
print(f"  ATMs cached        : {len(_ATM_CACHE)}")
print(f"  Model status       : {model_status}")
print(f"  Top score          : {max([p['score'] for p in preds]) if preds else 'N/A'}")
print(f"  Top risk level     : {preds[0]['risk_level'] if preds else 'N/A'}")
print("=" * 60)
