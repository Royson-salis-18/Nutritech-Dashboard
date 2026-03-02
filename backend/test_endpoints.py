import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

base_url = os.getenv("SUPABASE_URL") + "/rest/v1"
headers = {
    "apikey": os.getenv("SUPABASE_KEY"),
    "Authorization": f"Bearer {os.getenv('SUPABASE_KEY')}",
    "Accept": "application/json"
}

def test_endpoint(endpoint):
    url = f"{base_url}/{endpoint}?limit=1"
    response = requests.get(url, headers=headers)
    print(f"\n--- Testing Endpoint: /{endpoint} ---")
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print("Data:", json.dumps(response.json(), indent=2))
    else:
        print("Error/Message:", response.text)

test_endpoint("experiments")
test_endpoint("tubs")
test_endpoint("plants")
test_endpoint("sensors")
