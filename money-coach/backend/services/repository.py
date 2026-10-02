"""SQLite persistence for the single-user Khehla prototype.

The repository keeps SQL out of Flask routes and gives the demo a real,
repeatable persistence boundary. It is intentionally scoped to one seeded demo
profile; production multi-user access still requires authenticated ownership
checks and a managed database.
"""

from __future__ import annotations

import sqlite3
import threading
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from data.demo import DEFAULT_BUDGET_CATEGORIES, DEMO_USER, ECONOMIC_CONTEXT, GOALS, TRANSACTIONS


class SQLiteRepository:
    """Persist Khehla demo records in a process-safe SQLite connection."""

    def __init__(self, database_path: str):
        self.database_path = str(database_path)
        if self.database_path != ":memory:":
            Path(self.database_path).parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._connection = sqlite3.connect(
            self.database_path,
            check_same_thread=False,
            timeout=10,
        )
        self._connection.row_factory = sqlite3.Row
        self._connection.execute("PRAGMA foreign_keys = ON")
        if self.database_path != ":memory:":
            self._connection.execute("PRAGMA journal_mode = WAL")
        self._create_schema()
        self._seed_demo_records()

    def _create_schema(self) -> None:
        """Create the small relational schema if this database is new."""
        schema = """
        CREATE TABLE IF NOT EXISTS profiles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            monthly_income REAL NOT NULL,
            preferred_language TEXT NOT NULL DEFAULT 'en',
            currency TEXT NOT NULL DEFAULT 'ZAR',
            onboarding_complete INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS budget_categories (
            user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            category TEXT NOT NULL,
            label TEXT NOT NULL,
            amount REAL NOT NULL,
            position INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, category)
        );
        CREATE TABLE IF NOT EXISTS goals (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            target_amount REAL NOT NULL,
            saved_amount REAL NOT NULL DEFAULT 0,
            deadline TEXT,
            priority TEXT NOT NULL DEFAULT 'normal',
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            merchant TEXT NOT NULL,
            transaction_type TEXT NOT NULL,
            occurred_at TEXT NOT NULL,
            note TEXT NOT NULL DEFAULT '',
            is_demo INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            kind TEXT NOT NULL,
            created_at TEXT NOT NULL,
            source_id TEXT,
            is_read INTEGER NOT NULL DEFAULT 0
        );
        """
        with self._lock, self._connection:
            self._connection.executescript(schema)

    def _seed_demo_records(self) -> None:
        """Seed one demo profile, transaction ledger, goal, and inbox once."""
        now = datetime.now(timezone.utc).isoformat()
        with self._lock, self._connection:
            existing = self._connection.execute(
                "SELECT id FROM profiles WHERE id = ?", (DEMO_USER["id"],)
            ).fetchone()
            if existing is None:
                self._connection.execute(
                    """INSERT INTO profiles
                       (id, name, monthly_income, preferred_language, currency, onboarding_complete)
                       VALUES (?, ?, ?, ?, ?, 0)""",
                    (
                        DEMO_USER["id"],
                        DEMO_USER["name"],
                        DEMO_USER["monthly_income"],
                        DEMO_USER["preferred_language"],
                        DEMO_USER["currency"],
                    ),
                )

            transaction_count = self._connection.execute(
                "SELECT COUNT(*) AS count FROM transactions WHERE user_id = ?",
                (DEMO_USER["id"],),
            ).fetchone()["count"]
            if transaction_count == 0:
                for index, transaction in enumerate(TRANSACTIONS):
                    occurred_at = (date.today() - timedelta(days=index)).isoformat()
                    self._connection.execute(
                        """INSERT INTO transactions
                           (id, user_id, amount, category, merchant, transaction_type, occurred_at, note, is_demo)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)""",
                        (
                            transaction["id"],
                            DEMO_USER["id"],
                            transaction["amount"],
                            transaction["category"],
                            transaction["merchant"],
                            transaction["transaction_type"],
                            occurred_at,
                            "Seeded demonstration transaction",
                        ),
                    )

            goal_count = self._connection.execute(
                "SELECT COUNT(*) AS count FROM goals WHERE user_id = ?",
                (DEMO_USER["id"],),
            ).fetchone()["count"]
            if goal_count == 0:
                for goal in GOALS:
                    self._connection.execute(
                        """INSERT INTO goals
                           (id, user_id, name, target_amount, saved_amount, deadline, priority, created_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                        (
                            goal["id"],
                            DEMO_USER["id"],
                            goal["name"],
                            goal["target_amount"],
                            goal["saved_amount"],
                            goal["deadline"],
                            goal["priority"],
                            now,
                        ),
                    )

            notification_count = self._connection.execute(
                "SELECT COUNT(*) AS count FROM notifications WHERE user_id = ?",
                (DEMO_USER["id"],),
            ).fetchone()["count"]
            if notification_count == 0:
                demo_transaction = self._connection.execute(
                    "SELECT id FROM transactions WHERE user_id = ? AND category = 'eating_out'",
                    (DEMO_USER["id"],),
                ).fetchone()
                goal = self._connection.execute(
                    "SELECT id, target_amount, saved_amount FROM goals WHERE user_id = ? ORDER BY created_at LIMIT 1",
                    (DEMO_USER["id"],),
                ).fetchone()
                eating_out_total = next(
                    (row["amount"] for row in TRANSACTIONS if row["category"] == "eating_out"),
                    0,
                )
                fuel_event = ECONOMIC_CONTEXT[0]
                notifications = [
                    (
                        "demo-goal-progress",
                        "School-fees goal",
                        f"R{goal['target_amount'] - goal['saved_amount']:,.0f} remains on the seeded goal.",
                        "goal",
                        goal["id"],
                    ),
                    (
                        "demo-eating-out",
                        "Demo spending activity",
                        f"Seeded transactions show R{eating_out_total:,.0f} for eating out this month.",
                        "transaction",
                        demo_transaction["id"] if demo_transaction else None,
                    ),
                    (
                        "demo-fuel-scenario",
                        "Fuel-cost scenario",
                        f"The demo economic context uses a {fuel_event['change_percent']}% change; this is not a live price alert.",
                        "demo_scenario",
                        None,
                    ),
                ]
                for notification_id, title, body, kind, source_id in notifications:
                    self._connection.execute(
                        """INSERT INTO notifications
                           (id, user_id, title, body, kind, created_at, source_id, is_read)
                           VALUES (?, ?, ?, ?, ?, ?, ?, 0)""",
                        (notification_id, DEMO_USER["id"], title, body, kind, now, source_id),
                    )

    def get_profile(self, user_id: str = DEMO_USER["id"]) -> dict:
        """Return the demo profile without exposing database implementation details."""
        with self._lock:
            row = self._connection.execute(
                "SELECT * FROM profiles WHERE id = ?", (user_id,)
            ).fetchone()
        if row is None:
            return {}
        return {
            "id": row["id"],
            "name": row["name"],
            "monthly_income": row["monthly_income"],
            "preferred_language": row["preferred_language"],
            "currency": row["currency"],
            "onboarding_complete": bool(row["onboarding_complete"]),
        }

    def get_onboarding(self, user_id: str = DEMO_USER["id"]) -> dict:
        """Return saved plan details or gentle starter values for first-run onboarding."""
        profile = self.get_profile(user_id)
        categories = self._budget_category_rows(user_id)
        if not categories:
            categories = [dict(item) for item in DEFAULT_BUDGET_CATEGORIES]
        return {
            "profile": profile,
            "categories": categories,
            "onboarding_complete": profile.get("onboarding_complete", False),
        }

    def _budget_category_rows(self, user_id: str) -> list[dict]:
        with self._lock:
            rows = self._connection.execute(
                "SELECT category, label, amount, position FROM budget_categories WHERE user_id = ? ORDER BY position, label",
                (user_id,),
            ).fetchall()
        return [dict(row) for row in rows]

    def get_budget(self, user_id: str = DEMO_USER["id"]) -> dict:
        """Return a saved monthly plan and a backend-calculated unassigned amount."""
        profile = self.get_profile(user_id)
        categories = self._budget_category_rows(user_id)
        total_planned = round(sum(float(item["amount"]) for item in categories), 2)
        return {
            "monthly_income": profile.get("monthly_income", 0),
            "categories": categories,
            "total_planned": total_planned,
            "unassigned_income": round(float(profile.get("monthly_income", 0)) - total_planned, 2),
        }

    def save_budget(self, name: str, monthly_income: float, categories: list[dict], user_id: str = DEMO_USER["id"]) -> dict:
        """Replace the saved plan in a single database transaction."""
        with self._lock, self._connection:
            self._connection.execute(
                "UPDATE profiles SET name = ?, monthly_income = ?, onboarding_complete = 1 WHERE id = ?",
                (name, monthly_income, user_id),
            )
            self._connection.execute(
                "DELETE FROM budget_categories WHERE user_id = ?", (user_id,)
            )
            self._connection.executemany(
                """INSERT INTO budget_categories (user_id, category, label, amount, position)
                   VALUES (?, ?, ?, ?, ?)""",
                [
                    (user_id, row["category"], row["label"], row["amount"], position)
                    for position, row in enumerate(categories)
                ],
            )
        return self.get_budget(user_id)

    def list_goals(self, user_id: str = DEMO_USER["id"]) -> list[dict]:
        """Return all active savings goals in stable creation order."""
        with self._lock:
            rows = self._connection.execute(
                "SELECT id, name, target_amount, saved_amount, deadline, priority, created_at FROM goals WHERE user_id = ? ORDER BY created_at, name",
                (user_id,),
            ).fetchall()
        return [dict(row) for row in rows]

    def create_goal(self, goal: dict, user_id: str = DEMO_USER["id"]) -> dict:
        """Persist a new goal and return the stored row."""
        goal_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        with self._lock, self._connection:
            self._connection.execute(
                """INSERT INTO goals
                   (id, user_id, name, target_amount, saved_amount, deadline, priority, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    goal_id,
                    user_id,
                    goal["name"],
                    goal["target_amount"],
                    goal["saved_amount"],
                    goal.get("deadline"),
                    goal.get("priority", "normal"),
                    now,
                ),
            )
        return next(item for item in self.list_goals(user_id) if item["id"] == goal_id)

    def list_transactions(self, limit: int = 50, user_id: str = DEMO_USER["id"]) -> list[dict]:
        """Read seeded demo transaction history from SQLite, newest first."""
        with self._lock:
            rows = self._connection.execute(
                """SELECT id, amount, category, merchant, transaction_type, occurred_at, note, is_demo
                   FROM transactions WHERE user_id = ? ORDER BY occurred_at DESC, id LIMIT ?""",
                (user_id, max(1, min(int(limit), 100))),
            ).fetchall()
        return [
            {**dict(row), "is_demo": bool(row["is_demo"])}
            for row in rows
        ]

    def list_notifications(self, user_id: str = DEMO_USER["id"]) -> list[dict]:
        """Return the persisted notification-center items, unread first."""
        with self._lock:
            rows = self._connection.execute(
                """SELECT id, title, body, kind, created_at, source_id, is_read
                   FROM notifications WHERE user_id = ?
                   ORDER BY is_read, created_at DESC, id""",
                (user_id,),
            ).fetchall()
        return [
            {**dict(row), "is_read": bool(row["is_read"])}
            for row in rows
        ]

    def mark_notification_read(self, notification_id: str, user_id: str = DEMO_USER["id"]) -> bool:
        """Mark one notification as read; return False for an unknown ID."""
        with self._lock, self._connection:
            cursor = self._connection.execute(
                "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
                (notification_id, user_id),
            )
            return cursor.rowcount > 0
