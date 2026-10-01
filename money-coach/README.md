# Money Coach

Money Coach is a mobile-first, chat-first financial coaching prototype. It helps Grace understand her spending, savings goals, remittances, and the personal impact of economic changes.

> **Money Coach translates financial activity and economic changes into realistic personal decisions.**

## Architecture

```text
React/Vite mobile frontend
        |
        v
Flask JSON API
        |
        ├── deterministic financial calculations
        ├── Money Impact engine
        ├── structured context builder
        └── AI provider adapter
```

The backend calculates financial facts. The AI explains them and offers practical options. The default local provider is deterministic so the project runs without an API key.

## Project layout

- `frontend/` — React/Vite chat-first interface.
- `backend/routes/` — thin HTTP route handlers.
- `backend/services/` — tested financial calculations.
- `backend/ai/` — provider boundary and demo fallback.
- `backend/data/` — seeded Grace data.
- `backend/tests/` — unit and API acceptance tests.

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

The API runs at `http://127.0.0.1:5000`.

### Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The Vite frontend runs at `http://localhost:5173` and proxies `/api` to Flask.

## API smoke checks

```bash
curl http://127.0.0.1:5000/api/health
curl http://127.0.0.1:5000/api/dashboard
curl http://127.0.0.1:5000/api/money-impact
curl -X POST http://127.0.0.1:5000/api/coach/message \\
  -H 'Content-Type: application/json' \\
  -d '{"user_id":"demo-grace","message":"What if I save R100 a week?"}'
```

## AI integration

The local app uses `DemoAIProvider`. To add OpenAI or Gemini:

1. Implement the `AIProvider` interface in `backend/ai/provider.py` or a separate adapter.
2. Read the API key only from backend environment variables.
3. Build a compact context from backend-calculated values.
4. Request structured output.
5. Validate the result before returning it.
6. Add timeout, rate limit, and fallback behavior.

Never call the provider directly from React and never place provider secrets in `VITE_*` variables.

## Deployment

### Backend: Render or Railway

Use the `backend/Dockerfile`, or run:

```bash
gunicorn --chdir backend --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 20 wsgi:app
```

Set:

```text
FLASK_DEBUG=0
FRONTEND_ORIGIN=https://your-frontend.vercel.app
AI_PROVIDER=demo
```

Add the provider key only when a real AI adapter is implemented.

### Frontend: Vercel

Set the project root to `frontend` and configure:

```text
VITE_API_URL=https://your-backend.example.com
```

## Security baseline

- Backend-only AI secrets.
- Restricted CORS.
- Request size and field length limits.
- Pydantic validation.
- Generic error responses.
- Security headers.
- No raw HTML rendering of AI output.
- No raw financial messages in normal logs.
- Financial arithmetic stays outside the AI.
- Estimates show an explicit estimate label.

## Product disclaimer

Money Coach provides educational guidance based on available information. It is not a bank, lender, or licensed financial adviser.
