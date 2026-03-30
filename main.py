import os
from flask import Flask, send_from_directory, jsonify, request, session, redirect
import requests

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LANDING_DIR = os.path.join(BASE_DIR, "landing")
ASSETS_DIR = os.path.join(LANDING_DIR, "assets")

app = Flask(__name__)
app.secret_key = "mite-nutritech-2026-secret-key"

SUPABASE_URL = "https://ciosgjvbflsnrkhbriqh.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpb3NnanZiZmxzbnJraGJyaXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzOTMxNzcsImV4cCI6MjA4Njk2OTE3N30.srqPJAD4P92O9MykAfaLklWYV_iZo11WlIAlDDamXiM"


@app.route("/")
def index():
    return send_from_directory(LANDING_DIR, "index.html")

@app.route("/dashboard")
def dashboard():
    return redirect("https://nutritech-rpi-dashboard-0qd4.onrender.com")

@app.route("/login")
def login_page():
    return send_from_directory(LANDING_DIR, "login.html")

@app.route("/login-control")
def login_control_page():
    return send_from_directory(LANDING_DIR, "login-control.html")

@app.route("/entry")
def entry():
    return redirect("/login")

@app.route("/assets/<path:filename>")
def assets(filename: str):
    return send_from_directory(ASSETS_DIR, filename)

@app.route("/api/health")
def health():
    return jsonify({"status": "ok"}), 200

@app.route("/api/auth", methods=["POST"])
def api_auth():
    token = request.json.get("access_token")
    if not token:
        return jsonify({"error": "No token"}), 400
    try:
        r = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_KEY},
            timeout=5
        )
        if r.status_code == 200:
            user = r.json()
            session["user"] = {"email": user.get("email"), "id": user.get("id")}
            session.permanent = True
            return jsonify({"ok": True, "email": user.get("email")})
        return jsonify({"error": "Invalid token"}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port)
