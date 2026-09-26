from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool
from app.core.config import settings

_db_url = settings.database_url
# Normalize: plain postgresql:// (or legacy postgres://) as pasted from
# dashboards must use our installed driver psycopg2, else SQLAlchemy 2.x
# defaults to psycopg (v3) -> ModuleNotFoundError on Render.
if _db_url.startswith("postgres://"):
    _db_url = "postgresql+psycopg2://" + _db_url[len("postgres://"):]
elif _db_url.startswith("postgresql://"):
    _db_url = "postgresql+psycopg2://" + _db_url[len("postgresql://"):]

connect_args = {"check_same_thread": False} if _db_url.startswith("sqlite") else {}
# Supabase/Neon pooler (Supavisor/pgbouncer, usually :6543 or 'pooler' host):
# external pooler already pools — use NullPool to avoid double-pooling and
# transaction-mode incompatibilities. Plain Postgres keeps default pool.
_use_null = ":6543" in _db_url or "pooler" in _db_url
_engine_kw = {"poolclass": NullPool} if _use_null else {"pool_pre_ping": True}
# SSL for hosted Postgres (via ?sslmode=require in URL)
engine = create_engine(_db_url, connect_args=connect_args, **_engine_kw)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
