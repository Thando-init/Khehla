# Khehla — Repository Review and Way Forward

## Executive summary

The repository is a good hackathon/prototype foundation: React/Vite presents the mobile-first product, Flask owns API validation and deterministic calculations, and a provider adapter separates the Coach from the UI. The backend and frontend both build cleanly, and the prototype preview has been verified end-to-end.

This is **not yet safe for real customer financial data**. The most important missing control is authentication and per-user authorization; the current API is a single-user seeded demo. Other important work is to make every screen and Coach claim traceable to the same backend data, and to mark demo economic context clearly.

## Current verification

- Backend: **31 tests pass** (`backend/.venv/bin/pytest -q`).
- Frontend: **production build passes** (`npm run build`).
- Live preview: first-run onboarding, budget editing, goal creation, demo activity, notifications, the Coach, and the Money Impact/inflation planner were exercised through the Vite-to-Flask flow. The inflation planner returned a live World Bank observation.
- Emoji scan: **no emoji characters were found** in project source or documentation. The interface uses a few ordinary symbols (for example, the close mark and arrow), not emoji.
- The UI is a responsive web app with a PWA manifest; it is **not a native iOS/Android app**.

## Changes made in this review

1. Removed Pydantic validation detail payloads from error responses. Those details contained the submitted message or financial value. Added an acceptance regression test covering invalid Coach, What-if, and goal-projection inputs.
2. Replaced a demo Coach claim that invented an R500 eating-out budget and asserted the user was over it. The fallback now uses seeded spending context and explicitly says that no category limit is configured. What-if fallback wording now points to the planner rather than asserting a fixed R400 result for an arbitrary question.
3. Removed duplicate financial-calculator and Decimal imports.
4. Added docstrings explaining the inflation-projection assumptions and documenting the inflation endpoints.

## Product USP: what Khehla should own

Avoid positioning this as another “AI budgeting chatbot.” A stronger, more defensible angle is:

> **Khehla shows people how a money change affects their real month—after essentials, family support, and savings goals—and offers a small, explainable next step. The numbers come from tested backend rules; economic context is sourced and dated; AI can explain the result but cannot move money or invent the calculation.**

The product opportunity is the combination of:

- **South African cost-of-living context**, translated into an individual’s actual spending mix rather than presented as generic news.
- **Respect for family commitments and remittances** as part of the user’s plan, not as “bad spending” to eliminate.
- **Goal-aware trade-offs**: show what a change means for a concrete goal and timeframe.
- **Explainability and provenance**: show the amount, inputs, source, observation date, assumptions, and whether a number is seeded, live, or estimated.
- **A bounded coaching layer**: AI explains verified facts; deterministic backend code calculates money; no autonomous financial transactions.

The current prototype supports the architectural story, but the distinctiveness is not fully demonstrated yet: the SQLite repository and API-backed screens still use one seeded demo profile and synthetic transaction rows, and the fuel impact is demo context. Pitch those as prototype behavior, not as an integrated live service.

## Security review and recommended priorities

### P0 — Before connecting real users or financial records

1. **Add authentication and authorization.** The API currently accepts a caller-provided `user_id` and only recognizes `demo-grace`. This is a demo identity check, not authentication. Use the host platform’s approved identity flow (for example, verified OIDC/JWT claims), derive the user identity from the verified principal, and scope every database read/write to that principal.
2. **Keep real data out of the current demo model.** SQLite now persists one demo profile, its budget/goals, and the synthetic ledger; this is not per-user authorization. Add authentication and user-scoped database queries before any multi-user use, and test that one user can never retrieve another user’s records.
3. **Protect the browser session and transport.** Use HTTPS, secure/HttpOnly/SameSite cookies or a short-lived token flow approved by the host app, strict origin allowlists, and CSRF protections if cookie authentication is used. CORS is a browser policy, not an authorization control.
4. **Establish privacy controls.** Minimize what is sent to an AI provider, obtain appropriate consent, define retention/deletion rules, encrypt data at rest and in transit, and prevent chat/history or account identifiers from appearing in logs. The current chat history is saved in browser `localStorage`, which is unsuitable for sensitive financial conversations on shared devices; provide a clear opt-in/retention approach or avoid persisting it.

### P1 — Before a public pilot

1. **Use a single source of truth for product facts.** Recent activity now comes from the backend's seeded SQLite ledger. Keep it clearly labelled as demo data and do not imply a live transaction feed until an authorized bank/data integration exists.
2. **Make demo/live provenance visible.** The inflation planner shows a source and observation year, which is good. The Money Impact card should also show whether it is a seeded scenario or a verified current event, with source and effective date. Do not label demo context as a live price change.
3. **Add rate and cost controls.** Apply per-account and per-IP request limits, concurrency/timeouts, AI spend ceilings, and safe provider fallbacks before enabling a real model. Consider a queue/cache for slow external calls.
4. **Harden error handling and output validation.** The validation-echo issue is fixed and tested. Keep responses generic, bound every field (including disclaimers), validate provider output against the response schema, and add prompt-injection and unsupported-claim tests. Do not render model HTML.
5. **Set frontend response headers at the frontend host.** Flask API security headers do not set policy for the separately hosted React site. Configure a Content Security Policy, HSTS, and appropriate cache rules at the static host/reverse proxy; test the production headers.
6. **Add observability without financial content.** Log request IDs, status, latency, provider, and error class—not message bodies, account numbers, or transaction descriptions.

### P2 — Production readiness

- Add dependency scanning/automated updates, secret scanning, pinned frontend dependency versions, and CI that runs unit tests, API acceptance tests, production build, and security checks.
- Define database backup/restore, key rotation, incident response, deletion/export behavior, and operational ownership.
- Perform a threat model and privacy review with the platform/security owners before using real user information.

## Product and engineering roadmap

### Phase 1 — Make the demo truthful and reliable (prototype foundation implemented)

- Dashboard, budget, goals, Coach context, recent activity, and notifications now use backend API/SQLite data; transaction rows remain seeded synthetic examples.
- Seeded/demo figures and estimates are labelled; the inflation planner shows source, observation year, and data freshness.
- The core controls now work: onboarding, add/edit budget categories, create goals, navigate history/inbox, and open Money Impact. More advanced goal editing and live integrations remain future work.
- Add tests for the inflation parser/cache, stale-data behavior, source attribution, missing data, and projection assumptions.
- Keep the Coach fallback grounded in the supplied context and make its language match the selected locale where possible.

### Phase 2 — Build the differentiated feature

- Implement an explainable **Money Impact** flow: select a household category, fetch a trusted dated economic indicator, compute an estimated monthly rand effect in Flask, then show inputs/assumptions and 1–3 user-controlled options.
- Treat broad CPI as a planning input, not an individual forecast. The existing constant-inflation goal projection should remain explicitly labeled as a scenario and should disclose that actual prices may differ.
- Add a “why am I seeing this?” explanation: source, observation period, user spending input, formula, and uncertainty/limitations.
- Test that changes to the input spending, goal, and observation date change the result predictably.

### Phase 3 — Integrate safely with the host platform

- Agree an authorized data contract with the host platform: identity, account/transaction fields, consent, scopes, freshness, revocation, and error behavior.
- A SQLite repository now persists the single demo profile, budget/goals, and notification read state; add authentication and user-scoped persistence before real-user data, and do not let React become the source of financial truth.
- Add authentication/authorization and privacy controls before any real personal data is enabled.
- Introduce a production AI adapter only after the deterministic path, safety tests, rate limits, and output checks are in place. Keep the demo provider available for local development and tests.

## Suggested demo sequence

1. Show the two-step onboarding and save the initial editable monthly budget.
2. Open Budget Centre, adjust a category, and show the persisted plan alongside the separate seeded activity totals.
3. Create a savings goal and explain that its pace is only calculated when a deadline exists.
4. Show the demo transaction history and notification centre; both use seeded backend records, not bank data.
5. Open Money Impact and distinguish the seeded fuel scenario from the live-source World Bank inflation planner.
6. Show the Coach's backend-derived context and the passing API/frontend checks.
7. Close with the remaining boundary: authorized host-app data → Flask validation/calculations → sourced explanation → mobile UI.

## Deployment guidance

Vercel for the frontend and Render or Railway for the Flask API are reasonable **prototype** hosting choices, as described in the project README. Keep provider keys only in backend secrets. For production, deploy behind the platform’s identity and API controls, add a managed database and monitoring, and confirm the hosting region, data-processing terms, and retention requirements with the platform/security owners. Do not treat a public demo URL or CORS configuration as a production security boundary.
