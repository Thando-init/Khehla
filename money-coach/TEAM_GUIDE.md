# Team Guide

## Recommended work order

1. Run backend tests before changing the data model.
2. Start Flask and verify `/api/health`.
3. Start Vite and verify the chat screen.
4. Connect the dashboard and Money Impact endpoint.
5. Connect `/api/coach/message`.
6. Replace the demo provider only after the vertical slice works.
7. Add a provider timeout and fallback.
8. Run all tests and build the frontend.

## Ownership split

### Backend owner

- Financial calculations
- Demo data
- API validation
- Money Impact logic
- AI provider adapter
- Tests

### Frontend owner

- Chat-first mobile UI
- Suggested prompts
- Financial cards in chat
- Loading and error states
- Accessibility and responsive behavior

### Demo/documentation owner

- Grace narrative
- Data source notes
- Deployment variables
- Three-minute presentation
- Security explanation

## Product guardrails

- Do not shame Grace for remittances or financial pressure.
- Do not tell users to cut essential needs automatically.
- Do not represent estimates as guarantees.
- Do not make the AI the source of financial arithmetic.
- Do not expose provider keys to the browser.
- Do not render model responses as HTML.
- Do not log raw personal financial messages by default.

## Acceptance flow

1. Open the app on a phone viewport.
2. See a concise Money Coach welcome.
3. See Grace's remaining money and school-fees goal in the chat.
4. See a Money Impact card with an estimate and source field.
5. Tap a suggested question.
6. Confirm the user message appears safely as text.
7. Confirm the Coach response appears with actions.
8. Turn off the backend and confirm a readable connection error.
9. Run `pytest -q`.
10. Run `npm run build`.

## Demo script

Ask:

> I do not think I can save R650.

Then show a supportive, practical answer.

Ask:

> What if I save R100 a week?

Show a deterministic R400 four-week estimate.

End with:

> Money Coach does not just show Grace where her money went. It helps her understand what is changing, what it means personally, and what she can realistically do next.
