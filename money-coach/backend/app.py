"""Khehla Flask application.

The app factory makes API configuration and SQLite repository ownership
explicit so local development, pytest, and Gunicorn share the same setup.
"""

import logging
import os

from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS

from routes.api import api
from services.repository import SQLiteRepository

load_dotenv()


def _database_path(app):
    """Resolve an environment/test database path without writing into source files."""
    configured_path = app.config.get("DATABASE_PATH") or os.getenv("KHEHLA_DATABASE_PATH", "").strip()
    if configured_path:
        if configured_path == ":memory:" or os.path.isabs(configured_path):
            return configured_path
        return os.path.join(app.root_path, configured_path)
    if app.config.get("TESTING"):
        return ":memory:"
    return os.path.join(app.instance_path, "khehla.sqlite3")


def create_app(test_config=None):
    """Create the Flask application and attach its durable demo repository."""
    app = Flask(__name__)
    app.config.update(
        MAX_CONTENT_LENGTH=16 * 1024,
        JSON_SORT_KEYS=False,
    )
    if test_config:
        app.config.update(test_config)

    app.extensions["khehla_repository"] = SQLiteRepository(_database_path(app))

    origins = ["http://localhost:5173", "http://localhost:3000"]
    configured_origin = os.getenv("FRONTEND_ORIGIN", "").strip().rstrip("/")
    if configured_origin:
        origins.append(configured_origin)
    CORS(app, resources={r"/api/*": {"origins": origins}})
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

    @app.after_request
    def security_headers(response):
        """Add low-risk browser protections to API responses."""
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response

    @app.errorhandler(413)
    def request_too_large(_error):
        """Return JSON instead of an HTML error for oversized requests."""
        return jsonify({"error": "Request is too large."}), 413

    app.register_blueprint(api, url_prefix="/api")
    return app


# Gunicorn imports this application object; the SQLite database is created on first boot.
app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "5000")), debug=False)
