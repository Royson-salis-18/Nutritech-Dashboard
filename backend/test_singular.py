import requests

import os
base_url = os.getenv("SUPABASE_URL") + "/rest/v1"
headers = {
    "apikey": os.getenv("SUPABASE_KEY"),
    "Authorization": f"Bearer {os.getenv('SUPABASE_KEY')}"
}

for tb in ["experiment", "tub", "buckets", "bucket"]:
    r = requests.get(f"{base_url}/{tb}?select=*&limit=1", headers=headers)
    print(f"{tb} -> {r.status_code}")
