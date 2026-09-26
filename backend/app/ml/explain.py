"""Structured reasons from model output (§15).
Flow: XGBoost -> contribution values -> templated reason strings.
Gain-weighted fallback is the default (fast). SHAP only when
ENABLE_SHAP=1, because `import shap` costs ~11s (numba) — never on the
request path by default. LLM never invents.
"""
import os
from app.ml.features import FEATURES

_ENABLE_SHAP = os.environ.get("ENABLE_SHAP", "0") == "1"
_GAIN_CACHE: dict = {}

REASONS = {
    "fraud_withdrawals_30d": "High historical cash-out activity at this location",
    "fraud_withdrawals_7d": "Elevated recent suspicious activity here",
    "distance_ref_to_candidate_m": "Candidate is close to recent relevant transaction activity",
    "hour_match_score": "Current time matches historical withdrawal pattern",
    "cross_state_flag": "Cross-state money-flow pattern detected",
    "avg_withdrawal_amount": "Withdrawal amounts match fraud profile",
    "dst_recent_tx_count": "Destination account shows elevated activity",
    "src_recent_tx_count": "Source account shows elevated activity",
    "nearby_atm_count": "Dense ATM cluster favoured for cash-outs",
    "transaction_amount": "Large fraud amount — fast cash-out likely",
    "suspect_info_count": "Suspect entities linked to this trail",
    "travel_impossible_flag": "Money moved faster than any flight — impossible travel",
    "geo_velocity_kmh": "High-speed money movement across states",
    "dst_in_degree": "Destination fed by multiple accounts (funnel node)",
    "src_fan_out": "Source spraying money to many accounts",
    "chain_depth": "Multi-layer laundering chain detected",
    "l2_count": "Onward Layer-2 splits seen on this trail",
}


def _gain_weights(booster):
    key = id(booster)
    if key not in _GAIN_CACHE:
        try:
            score = booster.get_score(importance_type="gain")
            _GAIN_CACHE[key] = {f: score.get(f, 0.0) for f in FEATURES}
        except Exception:
            _GAIN_CACHE[key] = {f: 1.0 for f in FEATURES}
    return _GAIN_CACHE[key]


def _normalize(X):
    import numpy as _np
    mins = X.min(axis=0)
    ptp = _np.ptp(X, axis=0) + 1e-9
    return (X - mins) / ptp


def top_reasons(booster, X_row, feature_dict, k=4):
    """X_row: 1xF raw values. Returns ordered reason strings.
    Q3 FIX: each reason is gated on its actual feature value —
    prevents 'High historical activity' when count is 0.
    """
    import numpy as np
    # SHAP only when explicitly enabled (import costs ~11s via numba).
    vals = None
    if _ENABLE_SHAP:
        try:
            import shap
            ex = shap.TreeExplainer(booster)
            sv = ex.shap_values(X_row.reshape(1, -1))
            vals = np.abs(sv[0] if isinstance(sv, list) else sv[0])
        except Exception:
            vals = None
    if vals is None:  # gain x normalized magnitude fallback
        w = _gain_weights(booster)
        mag = _normalize(X_row.reshape(1, -1))[0]
        vals = np.array([w[f] * (0.2 + mag[i]) for i, f in enumerate(FEATURES)])
    order = np.argsort(-vals)

    # Q3 FIX: gate each reason on actual feature value so display is honest
    VALUE_GATES = {
        "fraud_withdrawals_30d":        lambda v: v > 0,
        "fraud_withdrawals_7d":         lambda v: v > 0,
        "avg_withdrawal_amount":        lambda v: v > 0,
        "dst_recent_tx_count":          lambda v: v > 0,
        "src_recent_tx_count":          lambda v: v > 0,
        "cross_state_flag":             lambda v: v == 1,
        "distance_ref_to_candidate_m":  lambda v: v < 100_000,
        "transaction_amount":           lambda v: v > 10_000,
        "nearby_atm_count":             lambda v: v > 3,
        "suspect_info_count":           lambda v: v > 0,
        "travel_impossible_flag":       lambda v: v == 1,
        "geo_velocity_kmh":             lambda v: v > 800,
        "dst_in_degree":                lambda v: v >= 2,
        "src_fan_out":                  lambda v: v >= 2,
        "chain_depth":                  lambda v: v >= 2,
        "l2_count":                     lambda v: v > 0,
    }

    out = []
    for i in order:
        f = FEATURES[int(i)]
        if f in REASONS:
            gate = VALUE_GATES.get(f, lambda v: True)
            fval = feature_dict.get(f, 0)
            if gate(fval) and REASONS[f] not in out:
                out.append(REASONS[f])
        if len(out) == k:
            break
    # Fallback: if all features gated out (cold case), return generic reason
    if not out:
        out = ["Candidate within regional money-flow radius",
               "Prediction based on available case signals"]
    return out
