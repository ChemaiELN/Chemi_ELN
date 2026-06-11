import psycopg2
conn = psycopg2.connect(host='localhost', port=5432, user='postgres', password='1728', dbname='postgres')
conn.autocommit = True
cur = conn.cursor()
cur.execute("SELECT 1 FROM pg_database WHERE datname='chemia_eln'")
exists = cur.fetchone()
if not exists:
    cur.execute("CREATE DATABASE chemia_eln")
    print("Created database chemia_eln")
else:
    print("Database chemia_eln already exists")
cur.close()
conn.close()
