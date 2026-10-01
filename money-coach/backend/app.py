"""Khehla Flask application.

The app factory keeps configuration and route registration explicit so the
same application can be used by local development, pytest, and Gunicorn.
"""

import logging
import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

from routes.api import api

load_dotenv()


def create_app(test_config=None):
    """Create and configure a Khehla application instance."""
    app = Flask(__name__)
    app.config.update(
        MAX_CONTENT_LENGTH=16 * 1024,
        JSON_SORT_KEYS=False,
    )
    if test_config:
        app.config.update(test_config)

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


app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "5000")), debug=False)
