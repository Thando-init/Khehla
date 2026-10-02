# Khehla Backend

Flask API for the Khehla money-coaching prototype.

## Boundaries

- `routes/api.py` validates HTTP requests and coordinates application services.
- `services/repository.py` persists the single demo profile, editable budget, goals, synthetic transaction ledger, and notification read state in SQLite.
- `services/financial_calculator.py` owns deterministic arithmetic and goal progress.
- `services/inflation.py` retrieves/caches public inflation observations used by the planner.
- `data/demo.py` owns the starter budget categories and deterministic demo records.
- `ai/provider.py` owns provider selection, structured-output validation, and the deterministic fallback.

## Run and test

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
pytest -q
python app.py
```

The app loads `.env` in the backend directory. The API listens at `http://127.0.0.1:5000` by default. The local SQLite database is initialized on first app start at `backend/instance/khehla.sqlite3`; set `KHEHLA_DATABASE_PATH` to override it. For tests, `create_app({"TESTING": True})` uses an isolated in-memory database unless a path is explicitly supplied.

## Data behavior and API

- `GET/PUT /api/onboarding` retrieves first-run state and saves a display name, take-home income, and initial category plan.
- `GET/PUT /api/budget` returns and replaces the saved monthly plan, including backend-computed totals and actual demo-category totals.
- `GET/POST /api/goals` reads and creates goals. A deadline is optional; the API does not invent a savings pace when none is supplied.
- `GET /api/transactions` reads the deterministic synthetic ledger. There is no transaction-write or bank-sync endpoint.
- `GET /api/notifications` reads the seeded inbox; `POST /api/notifications/<id>/read` persists a notification's read state.
- `GET /api/dashboard`, `GET /api/money-impact`, `POST /api/what-if`, and `POST /api/predictions/goal` return backend-calculated views and scenarios.
- `POST /api/coach/message` accepts a bounded prompt and recent chat history.

The repository seeds the synthetic activity and linked inbox entries only when the SQLite database is first initialized. Budget/profile changes and new goals persist in that database. Demo activity is not user bank data.

## Coach provider configuration

Default:

```dotenv
AI_PROVIDER=demo
```

Gemini uses the uploaded repository's existing OpenAI-compatible provider path; there is no separate Gemini provider or `GEMINI_*` configuration:

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=<Gemini API key>
OPENAI_MODEL=<Gemini model enabled for your API project>
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
```

Keep the key on the backend. `AI_PROVIDER=demo` remains the default. The provider implementation is preserved from the uploaded repository; this feature pass did not revalidate it against the partner's Gemini credentials.

## Security notes

The API limits request size, validates structured input, restricts CORS, emits browser security headers, and does not require bank credentials. Provider keys must be server-side only. Do not log financial messages or echo rejected request payloads. The Coach must not invent balances, rates, or category budgets.

## Prototype limitations / production path

The current repository is a single-profile demo, not a multi-tenant financial application. Before onboarding real users, add authentication and per-user authorization, tested schema migrations, a persistent managed database (for example PostgreSQL), deployment rate limits/monitoring, and a security/privacy review. The synthetic ledger should be replaced only through an explicit, separately tested integration—not by treating this demo data as bank data.
