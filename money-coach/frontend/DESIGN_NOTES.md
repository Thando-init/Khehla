# Frontend design notes

The dashboard now follows the supplied reference direction without copying its product branding:

- Warm cream page background.
- Orange primary accent and hero card.
- White rounded cards with restrained shadows.
- Sticky section tabs.
- Clear dashboard metrics and progress bars.
- Money Impact as an actionable card, not a generic news feed.
- Floating Coach action for conversational follow-up.
- Responsive 12-column desktop grid collapsing into a single mobile column.
- No decorative emoji dependency; hierarchy comes from type, spacing, colour and compact controls.

## Mobile behavior

The app targets a 375–430px viewport first. It includes:

- `viewport-fit=cover`.
- Safe-area padding on the application shell where appropriate.
- Large touch targets for tabs, buttons, and the floating Coach control.
- No forced full-screen behavior.
- Preserved browser zoom and text selection.
- A manifest for Add to Home Screen installation.

A real iPhone/iPad installed-app check remains device-specific and should be performed by the team before release.
