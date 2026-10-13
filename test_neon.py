import psycopg2
from psycopg2.extras import RealDictCursor

NEON_DATABASE_URL = "postgresql://neondb_owner:npg_8JNumA3pEPUY@ep-polished-river-b40ygioq-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require"

def run_neon():
    print("Connecting to Neon...")
    conn = psycopg2.connect(NEON_DATABASE_URL, cursor_factory=RealDictCursor)
    cur = conn.cursor()

    cur.execute("SELECT id, name, featured_star, total_salary FROM teams ORDER BY id ASC;")
    teams = cur.fetchall()

    print(f"\n[SUCCESS] Retrieved {len(teams)} teams from Neon via Python:\n")
    for team in teams:
        print(f"ID {team['id']}: {team['name']} | Star: {team['featured_star']} | Salary: ${team['total_salary']:,}")

    cur.close()
    conn.close()

# THIS LINE CALLS THE FUNCTION:
run_neon()