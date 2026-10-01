# Money Coach Frontend

Responsive React/Vite dashboard with a floating Coach entry point. The visual
direction is warm, practical, and product-designed rather than chat-only: an
orange hero, sticky sections, metric cards, progress bars, Money Impact cards,
and concise transaction rows.

## Run

```bash
npm install
npm run dev
```

The development server proxies `/api` requests to Flask at `127.0.0.1:5000`.

## Production build

```bash
npm run build
npm run preview
```

For Vercel, set the project root to this directory and configure:

```text
VITE_API_URL=https://your-backend.example.com
```

## UX rules

- Keep the dashboard information hierarchy clear.
- Keep the Coach available from every section through the floating action.
- Use cards for financial context, not long reports.
- Keep responses short enough for a phone screen.
- Show Money Impact as a personal estimate with a clear label.
- Treat model output as plain text; never render raw HTML.
- Show readable loading and connection-error states.
- Keep the financial disclaimer available without overwhelming the chat.

## Mobile web app

The shell includes `viewport-fit=cover`, safe-area-aware spacing, and a
`manifest.webmanifest` for Add to Home Screen. Test installed behavior on a
real iPhone/iPad before claiming device-specific status-bar or splash behavior.
