# Frontend design notes

## Design direction

Khehla is a warm editorial money companion: calm enough for everyday money decisions, with a memorable orange balance card that makes the most important number feel clear and encouraging. Keep orange and cream dominant; the supplied mobile reference also informs a single pale-sage insight surface, never green navigation or primary-action chrome.

- Warm cream page canvas with cream-tinted secondary surfaces.
- Orange is the primary brand colour for the logo, primary actions, selected navigation, progress, and Money Impact hero.
- Dark warm-brown text; pale sage is reserved for the contextual demo-insight surface.
- White rounded cards with restrained warm shadows.
- Home-screen hierarchy inspired by the supplied reference: editorial headline, orange monthly balance with a real activity link, four compact existing-function shortcuts, and one transparent demo insight.
- At wide browser widths, present the same phone-first app centered on a quiet gray surround. At phone widths, use the full viewport rather than shrinking the usable screen.
- Self-hosted **Fraunces** display type and **Manrope** interface type. The WOFF2 subsets and SIL Open Font License 1.1 texts are in `public/fonts/`; no font host is contacted at runtime.
- A quiet cream radial wash and concentric rings on orange feature surfaces provide context-specific depth without stock imagery or visual noise.
- Short, staggered entrance motion; disable it under `prefers-reduced-motion`.
- A quiet fixed bottom navigation with a small orange active-state marker; all existing destinations remain available.
- Clear dashboard metrics and progress bars.
- Money Impact as an actionable card, not a generic news feed.
- A compact Coach control in the header and a direct Khehla shortcut in the home action row.
- Existing quick actions and navigation continue to route to the budget, goals, activity, Money Impact, and Coach flows.
- No decorative emoji dependency; hierarchy comes from type, spacing, colour and compact controls.

## Mobile behavior

The app targets a 375–430px viewport first. It includes:

- `viewport-fit=cover`.
- Safe-area padding on the application shell where appropriate.
- Large touch targets for tabs and buttons, with a compact Coach header control on mobile.
- No forced full-screen behavior.
- Preserved browser zoom and text selection.
- A manifest for Add to Home Screen installation.

A real iPhone/iPad installed-app check remains device-specific and should be performed by the team before release.
