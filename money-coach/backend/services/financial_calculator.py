"""Pure financial calculations for Money Coach.

This module intentionally has no Flask or AI dependencies. Keeping arithmetic
here makes the backend the source of truth and makes the rules easy to test.
"""

from collections import defaultdict
from datetime import date
from decimal import Decimal, ROUND_HALF_UP


def money(value):
    """Round a number to cents and return a JSON-friendly float."""
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def monthly_summary(income, transactions):
    """Calculate income, spending, remittances, and remaining balance."""
    expenses = sum(float(t["amount"]) for t in transactions if t["transaction_type"] == "expense")
    remittances = sum(float(t["amount"]) for t in transactions if t["transaction_type"] == "remittance")
    return {"income": money(income), "expenses": money(expenses), "remittances": money(remittances), "spent": money(expenses + remittances), "remaining": money(float(income) - expenses - remittances)}


def spending_by_category(transactions):
    """Aggregate expense and remittance transactions by category."""
    totals = defaultdict(float)
    for transaction in transactions:
        if transaction["transaction_type"] in {"expense", "remittance"}:
            totals[transaction["category"]] += float(transaction["amount"])
    return {category: money(amount) for category, amount in sorted(totals.items())}


def goal_progress(goal, today=None):
    """Calculate goal progress and saving pace without dividing by zero."""
    today = today or date.today()
    target = float(goal["target_amount"])
    saved = float(goal["saved_amount"])
    remaining = max(target - saved, 0)
    deadline = date.fromisoformat(goal["deadline"])
    days = max((deadline - today).days, 0)
    required_per_day = 0 if remaining == 0 or days == 0 else remaining / days
    return {"name": goal["name"], "target_amount": money(target), "saved_amount": money(saved), "remaining": money(remaining), "progress_percent": money(min(saved / target * 100 if target else 0, 100)), "deadline": goal["deadline"], "days_remaining": days, "required_per_day": money(required_per_day), "required_per_week": money(required_per_day * 7), "on_track": remaining == 0 or days > 0}


def impact_estimate(monthly_spend, change_percent):
    """Estimate a category's monthly change; callers must label it as an estimate."""
    return money(float(monthly_spend) * float(change_percent) / 100)


def what_if(current_saved, target, weekly_saving, weeks):
    """Calculate a transparent savings scenario without involving AI."""
    estimated_saved = max(float(weekly_saving), 0) * max(int(weeks), 0)
    new_saved = float(current_saved) + estimated_saved
    return {"estimated_saved": money(estimated_saved), "new_saved_amount": money(new_saved), "new_amount_remaining": money(max(float(target) - new_saved, 0)), "is_estimate": True}
