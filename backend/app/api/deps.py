"""RBAC dependencies. Demo default: AUTH_ENABLED=false (open, hackathon mode).
Production: set AUTH_ENABLED=true and send `Authorization: Bearer <JWT>`
from POST /api/v1/auth/login. Roles: ADMIN > I4C_ANALYST > LEA_OFFICER > BANK_ANALYST.
"""
from fastapi import Depends, HTTPException, Header
from app.core.config import settings
from app.core.security import decode_token

_RANK = {"BANK_ANALYST": 1, "LEA_OFFICER": 2, "I4C_ANALYST": 3, "ADMIN": 4}


def get_caller_role(authorization: str | None = Header(None)) -> str:
    if not settings.auth_enabled:
        return "ADMIN"  # demo mode: everything open
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "missing bearer token")
    try:
        return decode_token(authorization[7:]).get("role", "")
    except Exception:
        raise HTTPException(401, "invalid token")


def require_roles(*roles: str):
    need = max(_RANK.get(r, 0) for r in roles)
    def check(role: str = Depends(get_caller_role)):
        if _RANK.get(role, 0) < need:
            raise HTTPException(403, "forbidden for role")
        return role
    return check
