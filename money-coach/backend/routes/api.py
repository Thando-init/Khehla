"""HTTP endpoints for Khehla's demo product flow.

Routes validate untrusted JSON, delegate persistence to the repository, and
keep financial arithmetic in deterministic backend services. User identity is
fixed to the seeded demo profile; this API is not a production auth boundary.
"""

from functools import lru_cache
from datetime import date
from typing import Literal

from flask import Blueprint, current_app, jsonify, request
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

from ai.provider import get_provider
from data.demo import DEMO_USER, ECONOMIC_CONTEXT
from services.financial_calculator import (
    goal_progress,
    impact_estimate,
    inflation_goal_projection,
    monthly_summary,
    spending_by_category,
    what_if,
)
from services.inflation import InflationUnavailable, get_inflation

api = Blueprint("api", __name__)


def _repository():
    """Get the application-scoped SQLite repository for this request."""
    return current_app.extensions["khehla_repository"]


@lru_cache(maxsize=1)
def _coach_provider():
    """Create the Coach provider on first use, after app.py has loaded .env."""
    return get_provider()


class ChatTurn(BaseModel):
    """One earlier chat message sent back by the client for follow-up context."""

    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=1000)


class CoachRequest(BaseModel):
    """Validate the bounded text accepted by the Coach endpoint."""

    model_config = ConfigDict(str_strip_whitespace=True)
    user_id: str = Field(min_length=1, max_length=80)
    message: str = Field(min_length=1, max_length=2000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=8)


class WhatIfRequest(BaseModel):
    """Validate a simple savings scenario."""

    user_id: str = Field(min_length=1, max_length=80)
    weekly_saving: float = Field(ge=0, le=1_000_000, allow_inf_nan=False)
    weeks: int = Field(ge=0, le=520)


class BudgetCategoryInput(BaseModel):
    """One planned category in an onboarding or budget-centre submission."""

    model_config = ConfigDict(str_strip_whitespace=True)
    category: str = Field(min_length=1, max_length=40, pattern=r"^[a-z0-9][a-z0-9_-]*$")
    label: str = Field(min_length=1, max_length=60)
    amount: float = Field(ge=0, le=10_000_000, allow_inf_nan=False)


class BudgetPlanRequest(BaseModel):
    """Validate the complete monthly plan before atomically replacing it."""

    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=80)
    monthly_income: float = Field(gt=0, le=100_000_000, allow_inf_nan=False)
    categories: list[BudgetCategoryInput] = Field(min_length=1, max_length=30)


class GoalCreateRequest(BaseModel):
    """Validate the goal fields accepted by the savings-goal centre."""

    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=2, max_length=80)
    target_amount: float = Field(gt=0, le=100_000_000, allow_inf_nan=False)
    saved_amount: float = Field(ge=0, le=100_000_000, allow_inf_nan=False)
    deadline: str | None = Field(default=None, max_length=10)
    priority: Literal["low", "normal", "high"] = "normal"

    @field_validator("deadline")
    @classmethod
    def valid_deadline(cls, value):
        if value is not None:
            date.fromisoformat(value)
        return value

    @model_validator(mode="after")
    def savings_do_not_exceed_target(self):
        if self.saved_amount > self.target_amount:
            raise ValueError("Saved amount cannot exceed target amount.")
        return self


class GoalProjectionRequest(BaseModel):
    """Validate a constant-inflation savings scenario."""

    goal_today: float = Field(gt=0, le=1_000_000_000, allow_inf_nan=False)
    current_savings: float = Field(ge=0, le=1_000_000_000, allow_inf_nan=False)
    months: int = Field(ge=1, le=120, strict=True)


def _progress_for_first_goal():
    """Return computed progress for the oldest goal, or None if no goal exists."""
    goals = _repository().list_goals(DEMO_USER["id"])
    return goal_progress(goals[0]) if goals else None


def _present_goal(goal: dict) -> dict:
    """Include identifiers and priority alongside deterministic progress."""
    return {**goal_progress(goal), "id": goal["id"], "priority": goal.get("priority", "normal")}


def _budget_category_rows(payload: BudgetPlanRequest) -> list[dict]:
    """Convert validated Pydantic categories to repository-ready dictionaries."""
    categories = [item.model_dump() for item in payload.categories]
    slugs = [item["category"].casefold() for item in categories]
    labels = [item["label"].casefold() for item in categories]
    if len(slugs) != len(set(slugs)) or len(labels) != len(set(labels)):
        raise ValueError("Duplicate budget categories are not allowed.")
    return categories


def _save_budget_payload(payload: BudgetPlanRequest):
    """Persist one complete plan for the sole seeded demo profile."""
    return _repository().save_budget(
        payload.name,
        payload.monthly_income,
        _budget_category_rows(payload),
        DEMO_USER["id"],
    )


@api.get("/health")
def health():
    """Provide a minimal liveness response for deployment checks."""
    return jsonify({"status": "ok", "service": "khehla"})


@api.get("/onboarding")
def get_onboarding():
    """Return profile and starter/saved budget values for first-run setup."""
    return jsonify(_repository().get_onboarding(DEMO_USER["id"]))


@api.put("/onboarding")
def save_onboarding():
    """Persist the user's initial profile and complete budget plan."""
    try:
        payload = BudgetPlanRequest.model_validate(request.get_json(silent=True) or {})
        budget = _save_budget_payload(payload)
    except ValidationError:
        return jsonify({"error": "Invalid onboarding details."}), 400
    except ValueError:
        return jsonify({"error": "Budget categories must be unique."}), 400
    return jsonify({"onboarding_complete": True, "budget": budget}), 201


@api.get("/dashboard")
def dashboard():
    """Return backend-calculated facts and onboarding state for the demo user."""
    repository = _repository()
    profile = repository.get_profile(DEMO_USER["id"])
    transactions = repository.list_transactions(user_id=DEMO_USER["id"])
    goals = repository.list_goals(DEMO_USER["id"])
    summary = monthly_summary(profile["monthly_income"], transactions)
    return jsonify(
        {
            "user": profile,
            "onboarding_complete": profile["onboarding_complete"],
            "financial_summary": summary,
            "budget": repository.get_budget(DEMO_USER["id"]),
            "spending_by_category": spending_by_category(transactions),
            "goal": _present_goal(goals[0]) if goals else None,
            "goals": goals,
        }
    )


@api.get("/budget")
def get_budget():
    """Return the saved plan, its unassigned income, and actual demo spending."""
    budget = _repository().get_budget(DEMO_USER["id"])
    transactions = _repository().list_transactions(user_id=DEMO_USER["id"])
    budget["actual_spending"] = spending_by_category(transactions)
    budget["is_demo"] = True
    return jsonify(budget)


@api.put("/budget")
def update_budget():
    """Replace the saved monthly budget with a validated plan."""
    try:
        payload = BudgetPlanRequest.model_validate(request.get_json(silent=True) or {})
        budget = _save_budget_payload(payload)
    except ValidationError:
        return jsonify({"error": "Invalid budget plan."}), 400
    except ValueError:
        return jsonify({"error": "Budget categories must be unique."}), 400
    budget["actual_spending"] = spending_by_category(
        _repository().list_transactions(user_id=DEMO_USER["id"])
    )
    budget["is_demo"] = True
    return jsonify(budget)


@api.get("/goals")
def get_goals():
    """List goals with computed progress for the demo profile."""
    goals = _repository().list_goals(DEMO_USER["id"])
    return jsonify({"goals": [_present_goal(goal) for goal in goals]})


@api.post("/goals")
def create_goal():
    """Create a savings goal and return its computed progress."""
    try:
        payload = GoalCreateRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError:
        return jsonify({"error": "Invalid savings goal."}), 400
    goal = _repository().create_goal(payload.model_dump(), DEMO_USER["id"])
    return jsonify(_present_goal(goal)), 201


@api.get("/transactions")
def get_transactions():
    """Return the SQLite-backed seeded demo transaction history."""
    try:
        limit = int(request.args.get("limit", "20"))
    except ValueError:
        return jsonify({"error": "Invalid transaction limit."}), 400
    if limit < 1 or limit > 100:
        return jsonify({"error": "Invalid transaction limit."}), 400
    transactions = _repository().list_transactions(limit, DEMO_USER["id"])
    return jsonify({"transactions": transactions, "is_demo": True})


@api.get("/notifications")
def get_notifications():
    """Return notification-center records and the unread count from SQLite."""
    notifications = _repository().list_notifications(DEMO_USER["id"])
    return jsonify(
        {
            "notifications": notifications,
            "unread_count": sum(not item["is_read"] for item in notifications),
            "is_demo": True,
        }
    )


@api.post("/notifications/<notification_id>/read")
def mark_notification_read(notification_id):
    """Persist a notification's read state for the demo user."""
    changed = _repository().mark_notification_read(notification_id, DEMO_USER["id"])
    if not changed:
        return jsonify({"error": "Notification not found."}), 404
    return jsonify({"id": notification_id, "is_read": True})


@api.get("/money-impact")
def money_impact():
    """Calculate personal economic impact from demo context and stored spending."""
    transactions = _repository().list_transactions(user_id=DEMO_USER["id"])
    transport = spending_by_category(transactions).get("transport", 0)
    event = ECONOMIC_CONTEXT[0]
    estimated_impact = impact_estimate(transport, event["change_percent"])
    return jsonify(
        {
            "cards": [
                {
                    "event_type": "fuel",
                    "title": "Fuel-cost scenario",
                    "description": f"The demo scenario estimates about R{estimated_impact:,.0f} extra per month from a {event['change_percent']}% transport-cost change.",
                    "monthly_spend": transport,
                    "change_percent": event["change_percent"],
                    "estimated_monthly_impact": estimated_impact,
                    "is_estimate": True,
                    "is_demo": True,
                    "source": event["source_name"],
                    "effective_date": event["effective_date"],
                }
            ]
        }
    )


@api.post("/coach/message")
def coach_message():
    """Validate a user message, build trusted backend context, and return coaching."""
    try:
        payload = CoachRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError:
        return jsonify({"error": "Invalid Coach request."}), 400
    if payload.user_id != DEMO_USER["id"]:
        return jsonify({"error": "User not found."}), 404

    repository = _repository()
    profile = repository.get_profile(DEMO_USER["id"])
    transactions = repository.list_transactions(user_id=DEMO_USER["id"])
    goals = repository.list_goals(DEMO_USER["id"])
    context = {
        "user": profile,
        "summary": monthly_summary(profile["monthly_income"], transactions),
        "spending": spending_by_category(transactions),
        "budget": repository.get_budget(DEMO_USER["id"]),
        "goal": goal_progress(goals[0]) if goals else {},
    }
    history = [turn.model_dump() for turn in payload.history]
    return jsonify(_coach_provider().coach(context, payload.message, history))


@api.post("/what-if")
def what_if_route():
    """Return a deterministic savings scenario marked as an estimate."""
    try:
        payload = WhatIfRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError:
        return jsonify({"error": "Invalid What-if request."}), 400
    if payload.user_id != DEMO_USER["id"]:
        return jsonify({"error": "User not found."}), 404
    goals = _repository().list_goals(DEMO_USER["id"])
    if not goals:
        return jsonify({"error": "Create a savings goal first."}), 404
    goal = goals[0]
    return jsonify(
        what_if(
            goal["saved_amount"],
            goal["target_amount"],
            payload.weekly_saving,
            payload.weeks,
        )
    )


@api.get("/economy/inflation")
def economy_inflation():
    """Return the latest World Bank inflation observation or a safe 503."""
    try:
        return jsonify(get_inflation())
    except InflationUnavailable:
        return jsonify({"error": "Inflation data unavailable. Please try again."}), 503


@api.post("/predictions/goal")
def predict_goal():
    """Build an explicitly labeled goal scenario from validated values and CPI."""
    try:
        payload = GoalProjectionRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError:
        return jsonify({"error": "Invalid goal request."}), 400
    try:
        economy = get_inflation()
    except InflationUnavailable:
        return jsonify({"error": "Inflation data unavailable. Please try again."}), 503
    result = inflation_goal_projection(
        payload.goal_today,
        payload.current_savings,
        economy["annual_inflation_percent"],
        payload.months,
    )
    return jsonify(
        {
            **result,
            "economy": economy,
            "projection_type": "constant_inflation_scenario",
            "assumptions": [
                "Historical annual inflation continues unchanged",
                "No interest, fees, withdrawals or price quote",
                "Equal monthly contributions",
            ],
        }
    )
