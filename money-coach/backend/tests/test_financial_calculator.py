"""Unit tests for Money Coach arithmetic; no network or Flask required."""

from datetime import date

from services.financial_calculator import goal_progress, impact_estimate, monthly_summary, spending_by_category, what_if


def test_monthly_summary_includes_remittances():
    transactions = [{"amount": 100, "transaction_type": "expense", "category": "food"}, {"amount": 50, "transaction_type": "remittance", "category": "remittances"}]
    assert monthly_summary(500, transactions) == {"income": 500.0, "expenses": 100.0, "remittances": 50.0, "spent": 150.0, "remaining": 350.0}


def test_spending_by_category_aggregates_expenses_and_remittances():
    transactions = [{"amount": 100, "transaction_type": "expense", "category": "food"}, {"amount": 25, "transaction_type": "expense", "category": "food"}, {"amount": 50, "transaction_type": "remittance", "category": "family"}]
    assert spending_by_category(transactions) == {"family": 50.0, "food": 125.0}


def test_goal_progress_handles_zero_days_without_division_error():
    goal = {"name": "Fees", "target_amount": 1000, "saved_amount": 400, "deadline": date.today().isoformat()}
    result = goal_progress(goal)
    assert result["remaining"] == 600.0
    assert result["days_remaining"] == 0
    assert result["required_per_day"] == 0


def test_completed_goal_has_zero_remaining():
    goal = {"name": "Fees", "target_amount": 1000, "saved_amount": 1200, "deadline": date.today().isoformat()}
    result = goal_progress(goal)
    assert result["remaining"] == 0.0
    assert result["progress_percent"] == 100.0


def test_impact_and_what_if_are_marked_by_callers_as_estimates():
    assert impact_estimate(1200, 10) == 120.0
    assert what_if(1350, 2000, 100, 4) == {"estimated_saved": 400.0, "new_saved_amount": 1750.0, "new_amount_remaining": 250.0, "is_estimate": True}
