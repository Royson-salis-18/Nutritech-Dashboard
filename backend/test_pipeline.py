import requests
import json

base_url = "http://localhost:5000/api"

# 1. Create exp
print("Creating Exp...")
exp_res = requests.post(f"{base_url}/experiments", json={
    "experiment_number": "EXP-MIG-1",
    "title": "Migration Test Exp",
    "num_buckets": 1,
    "description": "Testing the DB connection"
}).json()
print("Exp:", exp_res)

# 2. Add bucket
print("\nCreating Bucket...")
exp_id = exp_res["experiment"]["id"]
bkt_res = requests.post(f"{base_url}/experiments/{exp_id}/buckets", json={
    "bucket_number": "1",
    "soil_type": "Peat",
    "plant_type": "Tomato"
}).json()
print("Bucket:", bkt_res)

# 3. Simulate sensor data snapshot
print("\nSimulating bucket data collected...")
bkt_id = bkt_res["bucket"]["id"]
snap_res = requests.patch(f"{base_url}/buckets/{bkt_id}", json={
    "status": "Data Collected",
    "sensor_data": json.dumps({
        "temperature": 25.5,
        "humidity": 65,
        "light": 1000,
        "moisture": 45.2,
        "ph": 6.5
    })
}).json()
print("Snapshot:", snap_res)

print("\nThe backend should have attempted to push to Supabase sensor_tables")
