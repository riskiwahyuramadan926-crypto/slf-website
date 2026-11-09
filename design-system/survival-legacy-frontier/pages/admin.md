# Admin — Page Override

Read `../MASTER.md` first. This file covers the Owner/Admin operations interface.

## Objective
Make operational tasks predictable, auditable, and safe. Clarity and data integrity outrank decorative styling.

## Structure
- Clear role-aware navigation and current section title.
- Summary metrics only when backed by real D1 data.
- Search and filters near the list they control.
- Tables/cards that show status, date, player/order identity, and next valid action.
- Forms grouped by purpose with inline validation and save feedback.
- Destructive actions separated from normal save/update actions.

## Visual rules
- Keep the dark SLF panel theme, restrained cyan/lavender accents, and consistent 13–14px cards.
- Dense data can use compact rows but must remain legible on mobile; use horizontal table wrappers or stacked cards.
- Status colors always include text labels.
- No gratuitous animation, glow, decorative dashboards, fake KPI, or invented chart data.

## Safety and interaction
- Role restrictions are enforced server-side; front-end tab visibility is only presentation.
- Confirm destructive actions and explain what is deleted.
- Disable a submit button while a save is in progress, then restore it on failure.
- Preserve form input after recoverable errors.
- Use `aria-live` for non-blocking save feedback; don't steal focus for ordinary success.
- Do not expose secret values, private buyer data, or unneeded personal data in logs/diagnostics.
- Keep payment verification manual and evidence-based.
- Test unauthorized access, empty data, failed API calls, and mobile layouts.
