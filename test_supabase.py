from supabase import create_client, Client

SUPABASE_URL = "https://qwdcayygktwzzjzscjkw.supabase.co"
SUPABASE_KEY = "sb_publishable_D5SGXtQXK8_sC6O2_16ZRw_BsSDNOiM"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def test_supabase():
    print("Connecting to Supabase...")
    response = supabase.table("teams").select("id, name, featured_star, total_salary").order("id").execute()
    teams = response.data

    print(f"\n[SUCCESS] Retrieved {len(teams)} teams from Supabase via Python:\n")
    for team in teams:
        print(f"ID {team['id']}: {team['name']} | Star: {team['featured_star']} | Salary: ${team['total_salary']:,}")

test_supabase()