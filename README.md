# PurvaDrishti — Predictive Cash-Out Intelligence for Cybercrime

> Hackathon build: AI/ML framework that analyses cybercrime + financial
> signals to **forecast likely cash-withdrawal locations** of financial
> fraud — including cross-state trails (Delhi victim → Rajasthan cash-out).
>
> Demo note: all data shown is self-generated synthetic (no real citizen
> data); production plugs into authorised CFCFRMS/bank feeds.

![Dashboard](docs/screenshots/dashboard.png)
*Temp dashboard: case → top-5 predictions with time windows → H3 heatmap.*
*(Screenshot placeholder — replace `docs/screenshots/dashboard.png`.)*

## What it does

| PS deliverable | Status |
|---|---|
| a. Predictive Analytics Engine (XGBoost, multi-horizon 30/60/240/720 min) | ✅ Live |
| b. Risk Heatmap (H3 cells, state/risk/category/time filters) | ✅ API + temp UI |
| c. Law Enforcement Interface (timeline, explanations, report, RBAC, audit) | ✅ API + temp UI |
| d. Alert System (dashboard + SSE + webhook live; email/SMS on keys) | ✅ Live |

![Heatmap](docs/screenshots/heatmap.png)
![Alert](docs/screenshots/alert.png)
*(Placeholders — add real captures under `docs/screenshots/`.)*

## Quickstart (backend)

```bash
cd purvadrishti/backend
pip install -r requirements.txt
# .env → DATABASE_URL (Supabase/Neon Postgres), JWT_SECRET
uvicorn app.main:app --reload
# Dashboard: http://127.0.0.1:8000/   API docs: /docs
```

Demo staging (fresh history so HIGH alerts fire), retrain, tests:

```bash
$env:PYTHONPATH = (Get-Location).Path
python scripts/stage_demo_withdrawals.py --count 10
python scripts/train.py --horizons 30,60,240,720
python -m pytest tests -q
```

## Architecture

```text
React/Leaflet (team) ──REST/SSE──▶ FastAPI ──▶ XGBoost v0.2.0 ──▶ H3 risk cells
                                        │              alerts (dashboard/SSE/webhook/email/SMS)
                                   Supabase Postgres + PostGIS
```

* Model metrics (test): ROC-AUC 0.78 (60m), Top-5 recall 0.47–0.57.
* Scores are per-ATM probabilities + predicted time windows — rank matters.
* Full build history: see local `BUILD_LOG.md` (not committed).
* Frontend contract: local `FRONTEND_HANDOFF.md` (not committed — send file directly).

## Deploy

Render (`render.yaml` present) or Koyeb/HF Spaces via `backend/Dockerfile`.
Env: `DATABASE_URL`, `JWT_SECRET`, `AUTH_ENABLED=false`.
Free tiers sleep when idle — Supabase DB stays warm; first app request ~10 s.

## Team

Backend: API + ML + DB + alerts (this repo) · Frontend: dashboard app ·
ML flows with backend retraining (`scripts/train.py`).
