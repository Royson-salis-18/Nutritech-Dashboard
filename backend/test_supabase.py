import os
from dotenv import load_dotenv
from supabase import create_client
import json

load_dotenv()

URL = os.getenv("SUPABASE_URL")
KEY = os.getenv("SUPABASE_KEY")

def check():
    if not URL or not KEY:
        print("Missing URL or KEY")
        return
    
    s = create_client(URL, KEY)
    
    print(f"Connecting to: {URL}")
    try:
        # Check experiments
        exps = s.schema("experiment").table("experiments").select("*").execute()
        print(f"Experiments found: {len(exps.data or [])}")
        if exps.data:
            print(json.dumps(exps.data[:2], indent=2))
        
        # Check tubs
        tubs = s.schema("experiment").table("tubs").select("*").execute()
        print(f"Tubs found: {len(tubs.data or [])}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check()
