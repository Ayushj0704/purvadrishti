from sqlalchemy import create_engine, text
url = open('.env').read().split('DATABASE_URL=')[1].split()[0]
e = create_engine(url, connect_args={'connect_timeout': 15})
c = e.connect()
print('distinct cells:', c.execute(text('select count(distinct h3_cell) from predictions')).fetchone()[0])
print('empty cells:', c.execute(text("select count(*) from predictions where h3_cell=''")).fetchone()[0])
for row in c.execute(text('select h3_cell, round(max(prediction_score)::numeric,3), count(*) from predictions group by h3_cell order by 2 desc limit 5')).fetchall():
    print(row)
c.close()
