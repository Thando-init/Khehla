# Khehla

Khehla is a mobile-first money-coaching prototype for understanding a monthly plan, demo spending, savings goals, and the personal impact of economic changes.

> **Khehla translates financial activity and economic changes into realistic personal decisions.**

## What works in this prototype

- **Onboarding:** a two-step first-run setup for a display name, monthly take-home income, and editable starter categories.
- **Budget centre:** add, rename, remove, and adjust monthly plan categories; see planned amounts alongside seeded demo spending.
- **Savings goals:** create named goals with a target, current savings, optional target date, and priority.
- **Demo activity and notifications:** read synthetic transactions from SQLite; notifications are stored separately and can be marked read.
- **Money impact:** a clearly labelled demo scenario and the inflation planner, which retrieves the latest available South African inflation observation through the backend.
- **Coach:** structured, context-grounded responses with a deterministic fallback; Gemini can be configured as an optional server-side provider.

The prototype is **not connected to a bank**. Transaction rows and economic-impact examples are demo data. Inflation planning is an estimate, not a forecast.

## Architecture

```text
React/Vite mobile-first frontend
        |
        v
Flask JSON API
        |
        ├── validated onboarding, budget, goals, activity and notification routes
        ├── SQLite repository (profile, budget, goals, demo ledger and inbox)
        ├── deterministic financial calculations and Money Impact
        └── AI provider adapter (demo fallback or configured external provider)
```

Financial values are calculated in backend code. AI providers only explain trusted backend-calculated context; their response is schema-validated and bounded before it reaches the frontend.

## Project layout

- `frontend/` — React/Vite interface and API client.
- `backend/routes/` — validated HTTP route handlers.
- `backend/services/` — SQLite repository and deterministic financial calculations.
- `backend/ai/` — the uploaded OpenAI-compatible provider boundary (including its Gemini base-URL option) and deterministic demo fallback.
- `backend/data/` — starter budget categories and synthetic demo ledger/notifications.
- `backend/tests/` — unit and API acceptance tests.
- `GEMINI_API_REFERENCE.md` — official Gemini compatibility and structured-output reference notes.

## Local setup

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
pytest -q
python app.py
```

The Flask API runs at `http://127.0.0.1:5000`. On first boot it initializes `backend/instance/khehla.sqlite3` and seeds the demo ledger/inbox. The default demo profile starts with onboarding incomplete. The database and local secrets are ignored by Git.

Set `KHEHLA_DATABASE_PATH` to override the database location; `:memory:` can be used for isolated development and tests.

### Frontend

In a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

The Vite frontend runs at `http://localhost:5173` and proxies `/api` to Flask. Set `VITE_API_URL` only when the frontend must call a separately hosted backend.

## Optional Coach providers

The default is safe deterministic demo mode:

```dotenv
AI_PROVIDER=demo
```

To use Gemini through the provider configuration already present in the uploaded repository, put the key in the **backend** environment only:

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=your-Gemini-api-key
OPENAI_MODEL=a-Gemini-model-enabled-for-your-API-project
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
```

This preserves the original provider interface; this iteration does not introduce a separate `GeminiProvider` or `GEMINI_*` environment variables. The model must be enabled for the API project. The default remains `AI_PROVIDER=demo`; provider keys must not be put in React or any `VITE_*` variable.

For OpenAI, keep `AI_PROVIDER=openai` and configure its OpenAI API key/model; leave `OPENAI_BASE_URL` empty.

## API smoke checks

```bash
curl http://127.0.0.1:5000/api/health
curl http://127.0.0.1:5000/api/onboarding
curl http://127.0.0.1:5000/api/budget
curl http://127.0.0.1:5000/api/goals
curl http://127.0.0.1:5000/api/transactions
curl http://127.0.0.1:5000/api/notifications
curl http://127.0.0.1:5000/api/dashboard
curl http://127.0.0.1:5000/api/money-impact
curl -X POST http://127.0.0.1:5000/api/coach/message \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"demo-grace","message":"What if I save R100 a week?"}'
```

## Deployment and limits

The app can run behind a WSGI server such as Gunicorn. Set `FRONTEND_ORIGIN` to the deployed frontend origin and set `FLASK_DEBUG=0`. A deployed SQLite file is durable only when the hosting platform provides a persistent disk mounted for the database path.

This is currently a **single demo profile**, without authentication or real bank integration. Before multi-user or production use, add identity/access control, per-user authorization, database migrations and a managed persistent database (for example PostgreSQL), rate limiting, and a reviewed deployment/security model.

## Security baseline

- Backend-only AI secrets.
- Restricted CORS and request-size/field-length limits.
- Pydantic request and model-response validation.
- Generic error responses; submitted financial values are not echoed in validation messages.
- Browser security headers and no raw HTML rendering of Coach output.
- Financial arithmetic stays outside the AI.
- Demo rows and estimates are identified as such.

## Product disclaimer

Khehla provides educational guidance based on available information. It is not a bank, lender, or licensed financial adviser.
