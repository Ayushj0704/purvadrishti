from datetime import datetime, timedelta
from jose import jwt
from .config import settings

DEMO_USERS = {  # §37 demo seeds
    "admin": {"password": "demo", "role": "ADMIN"},
    "lea": {"password": "demo", "role": "LEA_OFFICER"},
    "bank": {"password": "demo", "role": "BANK_ANALYST"},
    "i4c": {"password": "demo", "role": "I4C_ANALYST"},
}

def create_token(sub: str, role: str) -> str:
    exp = datetime.utcnow() + timedelta(minutes=settings.access_minutes)
    return jwt.encode({"sub": sub, "role": role, "exp": exp},
                      settings.jwt_secret, algorithm=settings.jwt_algorithm)

def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
