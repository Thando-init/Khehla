"""Seed data for Khehla's deterministic demo persona.

The seeded transaction and goal records are copied into the SQLite demo store
on first boot. They stay synthetic and are clearly identified as demo data.
"""

from datetime import date, timedelta

DEMO_USER = {
    "id": "demo-grace",
    "name": "Grace",
    "preferred_language": "en",
    "currency": "ZAR",
    "monthly_income": 12000,
}

# Starter values mirror the example budget from the project brief. They are
# suggestions in first-run onboarding, not a saved plan until the user submits.
DEFAULT_BUDGET_CATEGORIES = [
    {"category": "rent", "label": "Rent or housing", "amount": 4500},
    {"category": "groceries", "label": "Groceries", "amount": 2200},
    {"category": "transport", "label": "Transport", "amount": 1200},
    {"category": "remittances", "label": "Money sent home", "amount": 1500},
    {"category": "school_fees", "label": "School fees", "amount": 800},
]

# Demo ledger amounts sum to R10,100 and make the dashboard calculations
# reproducible. SQLite, not React, serves these rows to the interface.
TRANSACTIONS = [
    {"id": "t1", "amount": 4500, "category": "rent", "merchant": "Home", "transaction_type": "expense"},
    {"id": "t2", "amount": 1850, "category": "groceries", "merchant": "Groceries", "transaction_type": "expense"},
    {"id": "t3", "amount": 1120, "category": "transport", "merchant": "Transport", "transaction_type": "expense"},
    {"id": "t4", "amount": 350, "category": "airtime", "merchant": "Airtime", "transaction_type": "expense"},
    {"id": "t5", "amount": 780, "category": "eating_out", "merchant": "Eating out", "transaction_type": "expense"},
    {"id": "t6", "amount": 1500, "category": "remittances", "merchant": "Family support", "transaction_type": "remittance"},
]

GOALS = [
    {
        "id": "g1",
        "name": "Sister's school fees",
        "target_amount": 2000,
        "saved_amount": 1350,
        "deadline": (date.today() + timedelta(days=18)).isoformat(),
        "priority": "high",
    }
]

ECONOMIC_CONTEXT = [
    {
        "event_type": "fuel",
        "change_percent": 10,
        "effective_date": date.today().isoformat(),
        "source_name": "Demo economic context",
        "source_url": "",
        "is_demo": True,
    }
]
