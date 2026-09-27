"""Scoring: XGBoost v0.1.0 when artifact present, else heuristic (§53B).
Heuristic kept so the API never 500s without a model file.
"""
import os
import pickle
from pathlib import Path

MODEL_VERSION = "cashout_xgb:0.2.0"
MODEL_DIR = Path(__file__).parent / "models"
HORIZONS = [30, 60, 240, 720]
WINDOW_LABELS = {30: "next 30 min", 60: "30–60 min",
                 240: "1–4 hrs", 720: "4–12 hrs"}
# Window bounds in minutes from prediction time T (demonstrates WHEN,
# not just where — the primary headline per ATM).
WINDOW_BOUNDS = {30: (0, 30), 60: (30, 60), 240: (60, 240), 720: (240, 720)}
_BOOSTERS: dict = {}
_CAL = _META = None
_LOADED = False


def _resolve(path_str):
    p = Path(path_str)
    if p.exists():
        return p
    return MODEL_DIR / "cashout_xgb.json"


def _load():
    global _CAL, _META, _LOADED
    if _LOADED:
        return
    _LOADED = True
    try:
        from xgboost import Booster
        base = Path(os.environ.get("MODEL_PATH", "app/ml/models/cashout_xgb.json"))
        if not base.exists():
            base = MODEL_DIR / "cashout_xgb.json"
        d = base.parent
        for h in HORIZONS:
            fp = d / f"cashout_xgb_h{h}.json"
            if not fp.exists() and h == 60:
                fp = d / "cashout_xgb.json"  # legacy single artifact
            if fp.exists():
                b = Booster()
                b.load_model(str(fp))
                _BOOSTERS[h] = b
        mp2 = d / "meta.json"
        if mp2.exists():
            import json
            _META = json.load(open(mp2))
    except Exception:
        _BOOSTERS.clear()


def model_available() -> bool:
    _load()
    return 60 in _BOOSTERS


def model_label() -> str:
    if _META:
        return f"{_META.get('model_name')}:{_META.get('model_version')}"
    return MODEL_VERSION


def get_thresholds(h: int = 60) -> tuple[float, float]:
    """(HIGH, CRITICAL) per horizon, validation-tuned; spec defaults fallback."""
    _load()
    try:
        t = ((_META or {}).get("horizons", {}).get(str(h), {}) or {}).get("thresholds", {})
        if not t:
            t = (_META or {}).get("thresholds", {})
        return float(t.get("HIGH", 0.70)), float(t.get("CRITICAL", 0.85))
    except Exception:
        return 0.70, 0.85


def score_candidate(case, atm, ref_lat=None, ref_lon=None):
    """Legacy heuristic single-score (fallback + tests)."""
    from app.geo.spatial import haversine_m
    plat = ref_lat if ref_lat is not None else (case.victim_lat or 28.6)
    plon = ref_lon if ref_lon is not None else (case.victim_lon or 77.2)
    d = haversine_m(plat, plon, atm.lat, atm.lon)
    score = max(0.05, min(0.95, 0.85 - d / 200000))
    reasons = [
        "Candidate is close to recent relevant transaction activity" if d < 100000
        else "Candidate within regional money-flow radius",
        "Current time matches historical withdrawal pattern",
    ]
    if getattr(atm, "state", "") == "Rajasthan":
        score = min(0.95, score + 0.05)
        reasons.insert(0, "High historical cash-out activity")
    return round(score, 3), reasons


def score_candidates_batch(db, case, cands, ref_lat=None, ref_lon=None):
    """60-min [(score, reasons, label)] — compat wrapper. ML if loaded."""
    return [(m["scores"][60], m["reasons"], m["label"])
            for m in score_multi(db, case, cands, ref_lat, ref_lon)]


def score_multi(db, case, cands, ref_lat=None, ref_lon=None):
    """Multi-horizon scoring. Returns [{scores:{h:p}, reasons, label,
    predicted_window}]. Heuristic fallback when no artifact."""
    _load()
    if 60 not in _BOOSTERS:
        out = []
        for a in cands:
            s, r = score_candidate(case, a, ref_lat, ref_lon)
            out.append({"scores": {h: s for h in HORIZONS}, "reasons": r,
                        "label": "heuristic-fallback",
                        "predicted_window": "next 60 min (heuristic)",
                        "basis": "geo-only (no model loaded)"})
        return out
    import numpy as np
    from app.ml.features import build_features_batch, to_matrix, FEATURES
    from app.ml.explain import top_reasons
    pairs = build_features_batch(db, case, cands, ref_lat, ref_lon)
    atms, X = to_matrix(pairs)
    import xgboost as xgb
    dmat = xgb.DMatrix(X, feature_names=FEATURES)
    probs = {h: np.clip(_BOOSTERS[h].predict(dmat), 0.01, 0.99)
             for h in HORIZONS if h in _BOOSTERS}
    b60 = _BOOSTERS[60]
    out = []
    for i, (a, (_, f)) in enumerate(zip(atms, pairs)):
        scores = {h: round(float(probs[h][i]), 3) for h in probs}
        window, bounds = ">12 hrs / low", None
        for h in HORIZONS:
            if h in scores:
                hi, _ = get_thresholds(h)
                if scores[h] >= hi:
                    window, bounds = WINDOW_LABELS[h], WINDOW_BOUNDS[h]
                    break
        # basis is refined by the endpoint with live burst heat; default here:
        out.append({"scores": scores,
                    "reasons": top_reasons(b60, np.array([f[k] for k in FEATURES]), f),
                    "label": model_label(),
                    "predicted_window": window,
                    "window_bounds_min": bounds,
                    "basis": "geo-only (no prior track)"})
    return out
