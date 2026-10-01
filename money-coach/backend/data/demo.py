"""Seed data for the deterministic Grace demo persona.

This is intentionally in code for the hackathon. Replace it with a database
repository when multi-user persistence is introduced.
"""

from datetime import date, timedelta

DEMO_USER = {"id": "demo-grace", "name": "Grace", "preferred_language": "en", "currency": "ZAR", "monthly_income": 12000}

TRANSACTIONS = [
    {"id": "t1", "amount": 4500, "category": "rent", "merchant": "Home", "transaction_type": "expense"},
    {"id": "t2", "amount": 1850, "category": "groceries", "merchant": "Groceries", "transaction_type": "expense"},
    {"id": "t3", "amount": 1120, "category": "transport", "merchant": "Transport", "transaction_type": "expense"},
    {"id": "t4", "amount": 350, "category": "airtime", "merchant": "Airtime", "transaction_type": "expense"},
    {"id": "t5", "amount": 780, "category": "eating_out", "merchant": "Eating out", "transaction_type": "expense"},
    {"id": "t6", "amount": 1500, "category": "remittances", "merchant": "Family support", "transaction_type": "remittance"},
]

GOALS = [{"id": "g1", "name": "Sister's school fees", "target_amount": 2000, "saved_amount": 1350, "deadline": (date.today() + timedelta(days=18)).isoformat(), "priority": "high"}]

ECONOMIC_CONTEXT = [{"event_type": "fuel", "change_percent": 10, "effective_date": date.today().isoformat(), "source_name": "Demo economic context", "source_url": "", "is_demo": True}]
