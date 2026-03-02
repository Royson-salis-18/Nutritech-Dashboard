import os
import logging
from flask import Flask, send_from_directory
from flask_cors import CORS

from routes.tubs import tubs_bp
from routes.experiments import experiments_bp
from routes.pipeline import pipeline_bp
from routes.dashboard import dashboard_bp

logging.basicConfig(level=logging.INFO)

# Paths
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
LANDING_DIR = os.path.join(BASE_DIR, "..", "landing")
REACT_DIR   = os.path.join(BASE_DIR, "..", "frontend", "nutritech-dashboard", "dist")


def create_app():
    app = Flask(
        __name__,
        static_folder=None,  # We manage static ourselves
    )
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # ── API blueprints ────────────────────────────────────────────────────────
    app.register_blueprint(tubs_bp,        url_prefix="/api/tubs")
    app.register_blueprint(experiments_bp, url_prefix="/api/experiments")
    app.register_blueprint(pipeline_bp,    url_prefix="/api/pipeline")
    app.register_blueprint(dashboard_bp,   url_prefix="/api/dashboard")

    # ── Landing page (root) ───────────────────────────────────────────────────
    @app.route("/")
    def landing():
        return send_from_directory(os.path.abspath(LANDING_DIR), "index.html")

    @app.route("/entry")
    def entry():
        # Placeholder page until the real Experiment Entry app is added
        return send_from_directory(os.path.abspath(LANDING_DIR), "entry.html")

    # ── React dashboard (built assets) ────────────────────────────────────────
    @app.route("/dashboard", defaults={"path": ""})
    @app.route("/dashboard/<path:path>")
    def react_app(path):
        dist = os.path.abspath(REACT_DIR)
        if not os.path.exists(dist):
            return (
                "Dashboard build not found. Run `npm install` and `npm run build` in "
                "`frontend/nutritech-dashboard/` to generate the `dist/` folder.",
                501,
            )
        if path and os.path.exists(os.path.join(dist, path)):
            return send_from_directory(dist, path)
        return send_from_directory(dist, "index.html")

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, host="0.0.0.0", port=5000)