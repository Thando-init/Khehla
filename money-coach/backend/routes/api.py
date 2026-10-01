"""HTTP endpoints for the Khehla vertical slice."""

from functools import lru_cache
from typing import Literal

from flask import Blueprint, jsonify, request
from pydantic import BaseModel, Field, ValidationError

from ai.provider import get_provider
from data.demo import DEMO_USER, ECONOMIC_CONTEXT, GOALS, TRANSACTIONS
from services.financial_calculator import goal_progress, impact_estimate, monthly_summary, spending_by_category, what_if
from services.financial_calculator import goal_progress, impact_estimate, inflation_goal_projection, monthly_summary, spending_by_category, what_if
from services.inflation import InflationUnavailable, get_inflation

api = Blueprint("api", __name__)


@lru_cache(maxsize=1)
def _coach_provider():
    """Create the coach provider on first use, after app.py has loaded .env."""
    return get_provider()


class ChatTurn(BaseModel):
    """One earlier chat message sent back by the client for follow-up context."""
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=1000)


class CoachRequest(BaseModel):
    """Validate the bounded text accepted by the Coach endpoint."""
    user_id: str = Field(min_length=1, max_length=80)
    message: str = Field(min_length=1, max_length=2000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=8)


class WhatIfRequest(BaseModel):
    """Validate a simple savings scenario."""
    user_id: str = Field(min_length=1, max_length=80)
    weekly_saving: float = Field(ge=0, le=1_000_000)
    weeks: int = Field(ge=0, le=520)

class GoalProjectionRequest(BaseModel):
    goal_today: float = Field(gt=0, le=1_000_000_000, allow_inf_nan=False)
    current_savings: float = Field(ge=0, le=1_000_000_000, allow_inf_nan=False)
    months: int = Field(ge=1, le=120, strict=True)


def _goal():
    """Return Grace's primary goal with a stable demo date calculation."""
    return goal_progress(GOALS[0])


@api.get("/health")
def health():
    """Provide a minimal liveness response for deployment checks."""
    return jsonify({"status": "ok", "service": "khehla"})


@api.get("/dashboard")
def dashboard():
    """Return backend-calculated dashboard facts for the demo user."""
    summary = monthly_summary(DEMO_USER["monthly_income"], TRANSACTIONS)
    return jsonify({"user": DEMO_USER, "financial_summary": summary, "spending_by_category": spending_by_category(TRANSACTIONS), "goal": _goal(), "nudge": {"title": "Your goal is within reach", "message": f"You need about R{_goal()['required_per_day']:,.0f} per day to stay on track."}})


@api.get("/money-impact")
def money_impact():
    """Calculate personal economic impact without calling an AI model."""
    transport = spending_by_category(TRANSACTIONS).get("transport", 0)
    event = ECONOMIC_CONTEXT[0]
    return jsonify({"cards": [{"event_type": "fuel", "title": "Fuel prices changed", "description": "Based on your transport spending, this could add approximately R{} per month.".format(f"{impact_estimate(transport, event['change_percent']):,.0f}"), "monthly_spend": transport, "change_percent": event["change_percent"], "estimated_monthly_impact": impact_estimate(transport, event["change_percent"]), "is_estimate": True, "source": event["source_name"], "effective_date": event["effective_date"]}]})


@api.post("/coach/message")
def coach_message():
    """Validate a user message, build trusted context, and return coaching."""
    try:
        payload = CoachRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError as error:
        return jsonify({"error": "Invalid Coach request.", "details": error.errors(include_url=False)}), 400
    if payload.user_id != DEMO_USER["id"]:
        return jsonify({"error": "User not found."}), 404
    context = {"user": DEMO_USER, "summary": monthly_summary(DEMO_USER["monthly_income"], TRANSACTIONS), "spending": spending_by_category(TRANSACTIONS), "goal": _goal()}
    history = [turn.model_dump() for turn in payload.history]
    return jsonify(_coach_provider().coach(context, payload.message, history))


@api.post("/what-if")
def what_if_route():
    """Return a deterministic savings scenario marked as an estimate."""
    try:
        payload = WhatIfRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError as error:
        return jsonify({"error": "Invalid What-if request.", "details": error.errors(include_url=False)}), 400
    if payload.user_id != DEMO_USER["id"]:
        return jsonify({"error": "User not found."}), 404
    goal = GOALS[0]
    return jsonify(what_if(goal["saved_amount"], goal["target_amount"], payload.weekly_saving, payload.weeks))

@api.get("/economy/inflation")
def economy_inflation():
    try:
        return jsonify(get_inflation())
    except InflationUnavailable:
        return jsonify({"error": "Inflation data unavailable. Please try again."}), 503


@api.post("/predictions/goal")
def predict_goal():
    try:
        payload = GoalProjectionRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError as error:
        return jsonify({"error": "Invalid goal request.", "details": error.errors(include_url=False)}), 400
    try:
        economy = get_inflation()
    except InflationUnavailable:
        return jsonify({"error": "Inflation data unavailable. Please try again."}), 503
    result = inflation_goal_projection(
        payload.goal_today, payload.current_savings,
        economy["annual_inflation_percent"], payload.months,
    )
    return jsonify({
        **result,
        "economy": economy,
        "projection_type": "constant_inflation_scenario",
        "assumptions": [
            "Historical annual inflation continues unchanged",
            "No interest, fees, withdrawals or price quote",
            "Equal monthly contributions",
        ],
    })
