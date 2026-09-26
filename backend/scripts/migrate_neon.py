"""One-time Neon migration: columns + indexes that create_all() skips on
existing tables. Safe to re-run (IF NOT EXISTS)."""
from sqlalchemy import create_engine, text

url = open('.env').read().split('DATABASE_URL=')[1].split()[0]
e = create_engine(url, connect_args={'connect_timeout': 15}, isolation_level='AUTOCOMMIT')
c = e.connect()
stmts = [
    "ALTER TABLE atms ADD COLUMN IF NOT EXISTS nearby_atm_count INTEGER DEFAULT 0",
    "ALTER TABLE cases ADD COLUMN IF NOT EXISTS source VARCHAR DEFAULT 'manual'",
    "CREATE INDEX IF NOT EXISTS ix_withdrawal_atm_ts ON withdrawals (atm_id, timestamp)",
    "CREATE INDEX IF NOT EXISTS ix_pred_case_id ON predictions (case_id)",
    "CREATE INDEX IF NOT EXISTS ix_txn_case_id ON transactions (case_id)",
]
for s in stmts:
    c.execute(text(s))
    print('OK:', s[:70])
c.close()
