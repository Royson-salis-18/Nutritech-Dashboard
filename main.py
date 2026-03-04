import os
from flask import Flask, send_from_directory, jsonify

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LANDING_DIR = os.path.join(BASE_DIR, "landing")
ASSETS_DIR = os.path.join(LANDING_DIR, "assets")

app = Flask(__name__)


@app.route("/")
def index():
    return send_from_directory(LANDING_DIR, "index.html")


@app.route("/entry")
def entry():
    return send_from_directory(LANDING_DIR, "entry.html")


@app.route("/assets/<path:filename>")
def assets(filename: str):
    return send_from_directory(ASSETS_DIR, filename)


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port)

