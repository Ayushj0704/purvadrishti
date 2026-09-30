"""RBAC dependencies. Demo default: AUTH_ENABLED=false (open, hackathon mode).
Production: set AUTH_ENABLED=true and send `Authorization: Bearer <JWT>`
from POST /api/v1/auth/login. Roles: ADMIN > I4C_ANALYST > LEA_OFFICER > BANK_ANALYST.
"""
from fastapi import Depends, HTTPException, Header, Query
from app.core.config import settings
from app.core.security import decode_token

_RANK = {"BANK_ANALYST": 1, "LEA_OFFICER": 2, "I4C_ANALYST": 3, "ADMIN": 4}


def _role_from_token(token: str) -> str:
    try:
        return decode_token(token).get("role", "")
    except Exception:
        raise HTTPException(401, "invalid token")


def get_caller_role(
    authorization: str | None = Header(None),
    token: str | None = Query(None),
) -> str:
    if not settings.auth_enabled:
        return "ADMIN"  # demo mode: everything open
    # Header bearer primary; ?token= fallback for EventSource/SSE clients
    # that cannot set custom headers.
    if authorization and authorization.startswith("Bearer "):
        return _role_from_token(authorization[7:])
    if token:
        return _role_from_token(token)
    raise HTTPException(401, "missing bearer token")


def require_roles(*roles: str):
    need = max(_RANK.get(r, 0) for r in roles)
    def check(role: str = Depends(get_caller_role)):
        if _RANK.get(role, 0) < need:
            raise HTTPException(403, "forbidden for role")
        return role
    return check
