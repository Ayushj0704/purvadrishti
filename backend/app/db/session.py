from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool
from app.core.config import settings

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
# Supabase/Neon pooler (Supavisor/pgbouncer, usually :6543 or 'pooler' host):
# external pooler already pools — use NullPool to avoid double-pooling and
# transaction-mode incompatibilities. Plain Postgres keeps default pool.
_use_null = ":6543" in settings.database_url or "pooler" in settings.database_url
_engine_kw = {"poolclass": NullPool} if _use_null else {"pool_pre_ping": True}
# SSL for hosted Postgres (via ?sslmode=require in URL)
engine = create_engine(settings.database_url, connect_args=connect_args, **_engine_kw)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
