from sqlalchemy import create_engine, text
url = open('.env').read().split('DATABASE_URL=')[1].split()[0]
e = create_engine(url, connect_args={'connect_timeout': 15}, isolation_level='AUTOCOMMIT')
c = e.connect()
c.execute(text('TRUNCATE alerts, predictions, withdrawals, transactions, cases, accounts, atms RESTART IDENTITY CASCADE'))
print('WIPED')
c.close()
