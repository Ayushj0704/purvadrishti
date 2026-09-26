from sqlalchemy import create_engine, text
url = open('.env').read().split('DATABASE_URL=')[1].split()[0]
e = create_engine(url, connect_args={'connect_timeout': 10}, isolation_level='AUTOCOMMIT')
c = e.connect()
try:
    c.execute(text('CREATE EXTENSION IF NOT EXISTS postgis'))
    print('POSTGIS_OK')
except Exception as ex:
    print('POSTGIS_FAIL', str(ex)[:300])
print(c.execute(text('select extname from pg_extension')).fetchall())
c.close()
