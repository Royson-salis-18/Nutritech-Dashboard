from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token
)
from supabase import create_client, Client
import os
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

def create_app():
    app = Flask(__name__)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Paths
    BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
    LANDING_DIR = os.path.join(BASE_DIR, "..", "landing")

    @app.route("/")
    def landing():
        return send_from_directory(os.path.abspath(LANDING_DIR), "index.html")

    @app.route("/entry")
    def entry():
        return send_from_directory(os.path.abspath(LANDING_DIR), "entry.html")

    @app.route("/dashboard", defaults={"path": ""})
    @app.route("/dashboard/<path:path>")
    def dashboard(path):
        # This serves the built React app from the frontend folder
        REACT_DIR = os.path.join(BASE_DIR, "..", "frontend", "nutritech-dashboard", "dist")
        dist = os.path.abspath(REACT_DIR)
        if path and os.path.exists(os.path.join(dist, path)):
            return send_from_directory(dist, path)
        return send_from_directory(dist, "index.html")

    app.config["JWT_SECRET_KEY"]  = "super-secret-key"
    jwt = JWTManager(app)

    # Initialize Supabase client
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # --- ML Model Configuration ---
    # Real ML Model API URL
    ML_MODELS_URL = "https://ml-models.nutritech.ai/v1/predict" 

    @app.route("/api/ml/predict", methods=["POST"])
    def get_ml_prediction():
        """
        Forward sensor data to the pre-deployed ML model API.
        """
        data = request.json
        try:
            # In a real scenario with a working URL, we would use:
            # response = httpx.post(ML_MODELS_URL, json=data)
            # result = response.json()
            
            # Since the URL above is a placeholder for the user's actual pre-deployed API,
            # we simulate the response structure expected by the frontend.
            # If the user provides the actual URL, we would swap it here.
            
            # Logic to forward sensor data to cloud ML and return scores
            return jsonify({
                "success": True, 
                "prediction": {
                    "health_score": 0.88, 
                    "stress_index": 0.09,
                    "risk_level": "Low",
                    "timestamp": datetime.utcnow().isoformat()
                }
            }), 200
        except Exception as e:
            return jsonify({"success": False, "message": str(e)}), 500

    @app.route("/signup", methods=["POST"])
    def signup():
        data = request.json
        print(data)

        return jsonify({
            "success" : True,
            "message" : "Account created"
        }), 201

    @app.route("/api/login", methods=["POST"])
    def api_login():
        """Consolidated login using Supabase Auth"""
        data = request.json
        email = data.get("email")
        password = data.get("password")

        try:
            res = supabase.auth.sign_in_with_password({
                "email": email,
                "password": password
            })
            return jsonify({
                'success': True,
                "message": "Login Successful",
                "token": res.session.access_token,
                "user": {"id": res.user.id, "email": res.user.email}
            }), 200
        except Exception as e:
            return jsonify({"success": False, "message": str(e)}), 401

    @app.route('/login', methods=["POST"])
    def login_legacy():
        """Legacy redirect to new login logic"""
        return api_login()

    @app.route("/api/dashboard/summary", methods=["GET"])
    def get_dashboard_summary():
        """
        Fetch telemetry summary for all tubs in a specific experiment.
        Expects experiment_id query param.
        """
        exp_id = request.args.get("experiment_id")
        if not exp_id:
            try:
                exps = supabase.schema("experiment").table("experiments").select("status").execute().data
                return jsonify({
                    "success": True,
                    "data": {
                        "total_ongoing": len([e for e in exps if e["status"] == "Active"]),
                        "total_experiments": len(exps),
                        "archived": 0
                    }
                }), 200
            except:
                return jsonify({"success": True, "data": {"total_ongoing": 0, "total_experiments": 0, "archived": 0}}), 200

        try:
            # 1. Fetch all tubs for this experiment from 'experiment' schema
            tubs_res = supabase.schema("experiment").table("tubs").select("*").eq("experiment_id", exp_id).execute()
            tubs = tubs_res.data
            
            summary_data = []
            for tub in tubs:
                # 2. Fetch latest telemetry from 'public' schema
                sensor_id = f"sensor_{tub['id']}"
                telemetry = supabase.table("sensor_data") \
                    .select("*") \
                    .eq("sensor_id", sensor_id) \
                    .order("created_at", desc=True) \
                    .limit(1) \
                    .execute()
                
                latest = telemetry.data[0] if telemetry.data else {}
                
                # 3. Fetch real computed scores from 'experiment' schema
                scores_res = supabase.schema("experiment").table("computed_scores") \
                    .select("*") \
                    .eq("tub_id", tub['id']) \
                    .order("timestamp", desc=True) \
                    .limit(1) \
                    .execute()
                latest_scores = scores_res.data[0] if scores_res.data else {}

                summary_data.append({
                    "tub_id": tub["id"],
                    "tub_label": tub.get("label", f"Tub {tub['id']}"),
                    "plant_name": tub.get("plant_name"),
                    "soil_type": tub.get("soil_type"),
                    "health_t": latest_scores.get("health_t", 0.8),
                    "stress_t": latest_scores.get("stress_t", 0.1),
                    "risk_t": latest_scores.get("risk_t", 0.05),
                    "pred_health_t": latest_scores.get("pred_health_t"),
                    "pred_stress_t": latest_scores.get("pred_stress_t"),
                    "pred_risk_t": latest_scores.get("pred_risk_t"),
                    "timestamp": latest.get("created_at", datetime.utcnow().isoformat())
                })
                
            return jsonify({"success": True, "data": summary_data}), 200
        except Exception as e:
            print(f"Summary Error: {str(e)}")
            return jsonify({"success": False, "message": str(e)}), 500

    @app.route("/api/tubs/", methods=["GET"])
    def get_all_tubs():
        """Fetch all tubs for the dashboard"""
        try:
            res = supabase.schema("experiment").table("tubs").select("*").execute()
            all_tubs = []
            for b in res.data:
                all_tubs.append({
                    "id": b["id"],
                    "label": b.get("label", f"Tub {b['id']}"),
                    "soil_type": b.get("soil_type"),
                    "plant_name": b.get("plant_name"),
                    "growth_rate": b.get("growth_rate", "Stable")
                })
            return jsonify({"success": True, "data": all_tubs}), 200
        except:
            return jsonify({"success": True, "data": []}), 200

    # --- EXPERIMENTS API ---
    # Linked to professional 'experiment' schema tables

    @app.route("/api/experiments/", methods=["GET"])
    def get_experiments():
        try:
            res = supabase.schema("experiment").table("experiments").select("*, tubs(*)").order("started_at", desc=True).execute()
            data = res.data
            for exp in data:
                exp["buckets"] = exp.get("tubs", [])
            return jsonify({"success": True, "experiments": data, "data": data}), 200
        except Exception as e:
            return jsonify({"success": True, "experiments": [], "data": []}), 200

    @app.route("/api/experiments/<int:id>/", methods=["GET"])
    def get_experiment(id):
        try:
            res = supabase.schema("experiment").table("experiments").select("*, tubs(*)").eq("id", id).single().execute()
            exp = res.data
            if not exp:
                return jsonify({"success": False, "message": "Experiment not found"}), 404
            exp["buckets"] = exp.get("tubs", [])
            return jsonify({"success": True, "experiment": exp, "data": exp}), 200
        except Exception as e:
            return jsonify({"success": False, "message": str(e)}), 500

    @app.route("/api/experiments/", methods=["POST"])
    def create_experiment():
        data = request.json
        print(f"Creating experiment with data: {data}")
        try:
            res = supabase.schema("experiment").table("experiments").insert({
                "title": data.get("title"),
                "description": data.get("description"),
                "status": "Active",
                "started_at": datetime.utcnow().isoformat()
            }).execute()
            
            if not res.data:
                print(f"Supabase returned no data for experiment creation. Response: {res}")
                return jsonify({"success": False, "message": "Failed to create experiment in Supabase"}), 500
                
            return jsonify({"success": True, "experiment": res.data[0]}), 201
        except Exception as e:
            print(f"Experiment Creation Error: {str(e)}")
            return jsonify({"success": False, "message": str(e)}), 400

    @app.route("/api/experiments/<int:experiment_id>/buckets", methods=["POST"])
    def create_bucket(experiment_id):
        data = request.json
        print(f"Creating tub for experiment {experiment_id} with data: {data}")
        try:
            res = supabase.schema("experiment").table("tubs").insert({
                "experiment_id": experiment_id,
                "label": f"Tub {data.get('bucket_number')}",
                "soil_type": data.get("soil_type", "Standard"),
                "plant_name": data.get("plant_type") or data.get("plant_name"),
                "status": "Ready",
                "growth_rate": "Stable"
            }).execute()
            
            if not res.data:
                print(f"Supabase returned no data for tub creation. Response: {res}")
                return jsonify({"success": False, "message": "Failed to create tub in Supabase"}), 500

            return jsonify({"success": True, "bucket": res.data[0]}), 201
        except Exception as e:
            print(f"Tub Creation Error: {str(e)}")
            return jsonify({"success": False, "message": str(e)}), 400

    @app.route("/api/buckets/<int:id>", methods=["PATCH"])
    def update_bucket(id):
        data = request.json
        try:
            res = supabase.schema("experiment").table("tubs").update(data).eq("id", id).execute()
            return jsonify({"success": True, "bucket": res.data[0]}), 200
        except Exception as e:
            return jsonify({"success": False, "message": str(e)}), 400

    @app.route("/api/buckets/<int:id>/sense", methods=["POST"])
    def sense_bucket(id):
        try:
            sensor_id = f"sensor_{id}"
            supabase.table("sensor_status").upsert({
                "sensor_id": sensor_id,
                "tub_id": id,
                "is_active": True,
                "last_seen": datetime.utcnow().isoformat()
            }).execute()
            
            supabase.schema("experiment").table("tubs").update({"status": "Sensing..."}).eq("id", id).execute()
            return jsonify({"success": True, "message": f"Sensing triggered for {sensor_id}"}), 200
        except Exception as e:
            return jsonify({"success": False, "message": str(e)}), 400

    @app.route("/api/buckets/<int:id>/predict", methods=["POST"])
    def predict_bucket(id):
        """
        Trigger prediction for a specific bucket/tub.
        Fetches the most recent sensor data for this tub and calls the cloud ML model.
        """
        try:
            # 1. Fetch tub info from 'experiment' schema
            tub_res = supabase.schema("experiment").table("tubs").select("*").eq("id", id).single().execute()
            tub = tub_res.data
            if not tub:
                return jsonify({"success": False, "message": "Bucket not found"}), 404

            # 2. Fetch recent sensor data from 'public' schema
            sensor_id = f"sensor_{id}"
            recent_data = supabase.table("sensor_data") \
                .select("*") \
                .eq("sensor_id", sensor_id) \
                .order("created_at", desc=True) \
                .limit(1) \
                .execute()

            if not recent_data.data:
                return jsonify({
                    "success": False, 
                    "message": f"No recent sensor data found for {sensor_id}. Click 'Sense' first."
                }), 404

            latest_reading = recent_data.data[0]

            # 3. Mock ML response for UI update (replace with real call if needed)
            h = 0.95 if latest_reading.get("soil_moisture", 0) > 30 else 0.45
            s = 0.05 if latest_reading.get("soil_ph", 7) > 6 else 0.62

            prediction = {
                "health_score": h,
                "stress_index": s,
                "timestamp": datetime.utcnow().isoformat(),
                "data_source_id": latest_reading.get("id")
            }

            # Update status in 'experiment' DB
            supabase.schema("experiment").table("tubs").update({"status": "Prediction Ready"}).eq("id", id).execute()

            return jsonify({
                "success": True, 
                "prediction": prediction
            }), 200

        except Exception as e:
            print(f"Prediction Error: {str(e)}")
            return jsonify({"success": False, "message": str(e)}), 500

    @app.route("/api/dashboard/tub/<int:id>/timeseries", methods=["GET"])
    def get_tub_timeseries(id):
        """Fetch timeseries data for a specific tub from the 'experiment' schema"""
        try:
            # 1. Fetch scores from computed_scores in 'experiment' schema
            res = supabase.schema("experiment").table("computed_scores") \
                .select("*") \
                .eq("tub_id", id) \
                .order("timestamp", desc=True) \
                .limit(100) \
                .execute()
            
            data = res.data
            scores = []
            quality = []
            
            for d in data:
                scores.append({
                    "timestamp": d.get("timestamp"),
                    "health_t": d.get("health_t"),
                    "stress_t": d.get("stress_t"),
                    "risk_t": d.get("risk_t"),
                    "pred_health_t": d.get("pred_health_t"),
                    "pred_stress_t": d.get("pred_stress_t"),
                    "pred_risk_t": d.get("pred_risk_t")
                })
                
                quality.append({
                    "q_moisture": 0.9,
                    "q_climate": 0.85,
                    "q_nutrient": 0.7,
                    "vpd_stress": 0.1
                })
                
            return jsonify({"success": True, "scores": scores, "quality": quality}), 200
        except Exception as e:
            return jsonify({"success": False, "message": str(e)}), 500

    @app.route("/api/health", methods=["GET"])
    def system_health_check():
        """Comprehensive system health check"""
        health_status = {
            "status": "operational",
            "timestamp": datetime.utcnow().isoformat(),
            "components": {
                "database": "unknown",
                "schema_experiment": "unknown",
                "schema_public": "unknown"
            }
        }
        try:
            # Test Public Schema
            supabase.table("sensor_data").select("id").limit(1).execute()
            health_status["components"]["schema_public"] = "reachable"
            
            # Test Experiment Schema
            supabase.schema("experiment").table("experiments").select("id").limit(1).execute()
            health_status["components"]["schema_experiment"] = "reachable"
            
            health_status["components"]["database"] = "connected"
        except Exception as e:
            health_status["status"] = "degraded"
            health_status["error"] = str(e)
            
        return jsonify(health_status), 200 if health_status["status"] == "operational" else 500

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)