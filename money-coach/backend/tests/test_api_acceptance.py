"""Black-box acceptance tests for the Money Coach HTTP contract."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app  # noqa: E402


def client():
    """Create an isolated Flask test client for each acceptance test."""
    return create_app({"TESTING": True}).test_client()


def test_health_and_dashboard_are_available():
    c = client()
    assert c.get("/api/health").status_code == 200
    response = c.get("/api/dashboard?user_id=demo-grace")
    assert response.status_code == 200
    body = response.get_json()
    assert body["user"]["name"] == "Grace"
    # Grace's seeded transactions total R10,100, so the calculator truthfully
    # reports R1,900 remaining from R12,000 income.
    assert body["financial_summary"]["remaining"] == 1900.0
    assert body["goal"]["remaining"] == 650.0


def test_money_impact_is_deterministic_and_explicitly_an_estimate():
    body = client().get("/api/money-impact").get_json()
    card = body["cards"][0]
    assert card["estimated_monthly_impact"] == 112.0
    assert card["is_estimate"] is True
    assert card["source"]


def test_coach_returns_concise_structured_response():
    response = client().post("/api/coach/message", json={"user_id": "demo-grace", "message": "What if I save R100 a week?"})
    assert response.status_code == 200
    body = response.get_json()
    assert body["message"]
    assert isinstance(body["actions"], list)
    assert body["tone"] == "supportive"


def test_what_if_is_backend_calculated():
    response = client().post("/api/what-if", json={"user_id": "demo-grace", "weekly_saving": 100, "weeks": 4})
    assert response.status_code == 200
    assert response.get_json()["estimated_saved"] == 400.0


def test_invalid_requests_and_unknown_users_are_rejected():
    c = client()
    assert c.post("/api/coach/message", json={"user_id": "demo-grace", "message": ""}).status_code == 400
    assert c.post("/api/coach/message", json={"user_id": "other", "message": "Hello"}).status_code == 404
    assert c.post("/api/what-if", json={"user_id": "demo-grace", "weekly_saving": -1, "weeks": 4}).status_code == 400


def test_security_headers_are_present():
    response = client().get("/api/health")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
