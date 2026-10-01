# Khehla Backend

Flask API for the Khehla prototype.

## Boundaries

- `routes/api.py` validates HTTP requests and orchestrates services.
- `services/financial_calculator.py` owns deterministic arithmetic.
- `data/demo.py` owns seeded Grace data.
- `ai/provider.py` owns the AI boundary and local fallback.

## Run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest -q
python app.py
```

## Security notes

The API limits request size, validates structured input, restricts CORS, emits browser security headers, and does not need to receive sensitive credentials. A real AI provider must be called from a backend adapter with a server-only secret.

## Future persistence

Replace `data/demo.py` with repository/model code backed by PostgreSQL. Preserve the service interfaces and test the migration before enabling multiple users.
