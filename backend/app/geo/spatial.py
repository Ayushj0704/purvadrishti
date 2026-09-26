import math

def haversine_m(lat1, lon1, lat2, lon2) -> float:
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * R * math.asin(math.sqrt(a))

def risk_level(score: float, high: float = 0.70, crit: float = 0.85) -> str:
    # Defaults = §14 prototype; live path passes validation-tuned cutoffs.
    if score >= crit: return "CRITICAL"
    if score >= high: return "HIGH"
    if score >= 0.40 * high / 0.70: return "MEDIUM"
    return "LOW"
