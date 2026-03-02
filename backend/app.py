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
    # ML models are stored online in the cloud. 
    # They provide predictive scoring for health, stress, and risk.
    ML_MODELS_URL = "https://ml-models.nutritech.ai/v1" 

    @app.route("/api/ml/predict", methods=["POST"])
    def get_ml_prediction():
        """
        Placeholder for cloud ML model inference.
        In a real scenario, this would call the cloud-hosted XGBoost/Sklearn models.
        """
        data = request.json
        # Logic to forward sensor data to cloud ML and return scores
        return jsonify({
            "success": True, 
            "prediction": {
                "health_score": 0.85, 
                "stress_index": 0.12,
                "risk_level": "Low"
            }
        }), 200

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
            # Return global stats if no exp_id provided (fallback for other components)
            try:
                exps = supabase.table("experiments").select("status").execute().data
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
            # 1. Fetch all tubs for this experiment
            tubs_res = supabase.table("tubs").select("*").eq("experiment_id", exp_id).execute()
            tubs = tubs_res.data
            
            summary_data = []
            for tub in tubs:
                # 2. Fetch latest telemetry for each tub
                sensor_id = f"sensor_{tub['id']}"
                telemetry = supabase.table("sensor_data") \
                    .select("*") \
                    .eq("sensor_id", sensor_id) \
                    .order("created_at", desc=True) \
                    .limit(1) \
                    .execute()
                
                latest = telemetry.data[0] if telemetry.data else {}
                
                # Mock scoring logic (replace with real formulas if needed)
                h = 0.85 if latest.get("soil_moisture", 0) > 30 else 0.42
                s = 0.12 if latest.get("soil_ph", 7) > 6 else 0.55
                r = 0.05 if h > 0.7 else 0.48

                summary_data.append({
                    "tub_id": tub["id"],
                    "tub_label": f"Tub {tub['bucket_number']}",
                    "plant_name": tub["plant_type"],
                    "soil_type": tub["soil_type"],
                    "health_t": h,
                    "stress_t": s,
                    "risk_t": r,
                    "pred_health_t": h + 0.05, # mock prediction
                    "pred_stress_t": s - 0.02,
                    "pred_risk_t": r,
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
            res = supabase.table("tubs").select("*").execute()
            all_tubs = []
            for b in res.data:
                all_tubs.append({
                    "id": b["id"],
                    "label": f"Tub {b['bucket_number']}",
                    "soil_type": b["soil_type"],
                    "plant_name": b["plant_type"],
                    "growth_rate": "Stable"
                })
            return jsonify({"success": True, "data": all_tubs}), 200
        except:
            return jsonify({"success": True, "data": []}), 200

    # --- EXPERIMENTS API ---
    # Linked to live Supabase tables

    @app.route("/api/experiments/", methods=["GET"])
    def get_experiments():
        try:
            # In reality, you'd use a real 'experiments' table. 
            # For now, we fetch from the public schema if available, else return our tracker.
            res = supabase.table("experiments").select("*, tubs(*)").order("created_at", desc=True).execute()
            data = res.data
            for exp in data:
                exp["buckets"] = exp.get("tubs", [])
            return jsonify({"success": True, "experiments": data, "data": data}), 200
        except Exception as e:
            # Fallback to empty list if table doesn't exist yet
            return jsonify({"success": True, "experiments": [], "data": []}), 200

    @app.route("/api/experiments/<int:id>/", methods=["GET"])
    def get_experiment(id):
        try:
            res = supabase.table("experiments").select("*, tubs(*)").eq("id", id).single().execute()
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
        try:
            res = supabase.table("experiments").insert({
                "title": data.get("title"),
                "description": data.get("description"),
                "num_buckets": data.get("num_buckets", 1),
                "crop_type": data.get("crop_type"),
                "status": "Active"
            }).execute()
            return jsonify({"success": True, "experiment": res.data[0]}), 201
        except Exception as e:
            return jsonify({"success": False, "message": str(e)}), 400

    @app.route("/api/experiments/<int:experiment_id>/buckets", methods=["POST"])
    def create_bucket(experiment_id):
        data = request.json
        try:
            res = supabase.table("tubs").insert({
                "experiment_id": experiment_id,
                "bucket_number": data.get("bucket_number"),
                "soil_type": data.get("soil_type", "Standard"),
                "plant_type": data.get("plant_type"),
                "status": "Ready"
            }).execute()
            return jsonify({"success": True, "bucket": res.data[0]}), 201
        except Exception as e:
            return jsonify({"success": False, "message": str(e)}), 400

    @app.route("/api/buckets/<int:id>", methods=["PATCH"])
    def update_bucket(id):
        data = request.json
        try:
            # Map frontend 'plant_type' to db if different, or just update directly
            res = supabase.table("tubs").update(data).eq("id", id).execute()
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
                "last_sensed_at": datetime.utcnow().isoformat()
            }).execute()
            
            supabase.table("tubs").update({"status": "Sensing..."}).eq("id", id).execute()
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
            # 1. Fetch tub info from Supabase
            tub_res = supabase.table("tubs").select("*").eq("id", id).single().execute()
            tub = tub_res.data
            if not tub:
                return jsonify({"success": False, "message": "Bucket not found"}), 404

            # 2. Fetch recent sensor data
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

            # 3. Mock ML response (replace with real call if needed)
            h = 0.95 if latest_reading.get("soil_moisture", 0) > 30 else 0.45
            s = 0.05 if latest_reading.get("soil_ph", 7) > 6 else 0.62

            prediction = {
                "health_score": h,
                "stress_index": s,
                "timestamp": datetime.utcnow().isoformat(),
                "data_source_id": latest_reading.get("id")
            }

            # Update status in DB
            supabase.table("tubs").update({"status": "Prediction Ready"}).eq("id", id).execute()

            return jsonify({
                "success": True, 
                "prediction": prediction
            }), 200

        except Exception as e:
            print(f"Prediction Error: {str(e)}")
            return jsonify({"success": False, "message": str(e)}), 500

    @app.route("/api/dashboard/tub/<int:id>/timeseries", methods=["GET"])
    def get_tub_timeseries(id):
        """Fetch timeseries data for a specific tub"""
        try:
            # 1. Fetch sensor data for this tub
            sensor_id = f"sensor_{id}"
            res = supabase.table("sensor_data") \
                .select("*") \
                .eq("sensor_id", sensor_id) \
                .order("created_at", desc=True) \
                .limit(100) \
                .execute()
            
            data = res.data
            scores = []
            quality = []
            
            for d in data:
                # Mock scoring for each history point
                h = 0.85 if d.get("soil_moisture", 0) > 30 else 0.42
                s = 0.12 if d.get("soil_ph", 7) > 6 else 0.55
                r = 0.05 if h > 0.7 else 0.48
                
                scores.append({
                    "timestamp": d.get("created_at"),
                    "health_t": h,
                    "stress_t": s,
                    "risk_t": r,
                    "pred_health_t": h + 0.02,
                    "pred_stress_t": s - 0.01,
                    "pred_risk_t": r
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

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)