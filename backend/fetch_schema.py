import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("SUPABASE_URL") + "/rest/v1/"
headers = {
    "apikey": os.getenv("SUPABASE_KEY"),
    "Authorization": f"Bearer {os.getenv('SUPABASE_KEY')}",
    "Accept": "application/json"
}

response = requests.get(url, headers=headers)
data = response.json()

with open("supabase_schema_output.txt", "w") as f:
    if "definitions" in data:
        tables = list(data["definitions"].keys())
        f.write("Available Tables:\n")
        for t in tables:
            f.write(f"\n--- Table: {t} ---\n")
            props = data["definitions"][t].get("properties", {})
            for col, col_data in props.items():
                col_type = col_data.get("type", "unknown")
                col_format = col_data.get("format", "")
                f.write(f"  - {col} ({col_type} {col_format})\n")
    else:
        f.write("Failed to map schema definitions:\n")
        f.write(json.dumps(data, indent=2))
