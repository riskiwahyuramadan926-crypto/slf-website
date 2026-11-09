# Survival Legacy Frontier — UI/UX Design System

Status: **Project design source of truth**  
Scope: Beranda, Store, Wiki, pusat bantuan, halaman status pesanan/tiket, dan Admin.  
Implementation: HTML, CSS, JavaScript, Cloudflare Pages Functions, dan D1. Tidak memakai framework UI.

## 1. Product and visual direction

SLF is a Minecraft survival/RPG server website with four connected jobs:
- Help a new player understand the server and join it.
- Present rules, zones, gameplay, and announcements clearly.
- Provide a trustworthy Store and manual payment flow.
- Give the Owner/Admin a reliable operational workspace.

**Primary direction:** Dark Mode (OLED) + Accessible & Ethical.  
**Supporting character:** restrained Retro-Futurism, with subtle sci-fi/RPG atmosphere and controlled cyan/lavender accents.  
**Content pattern:** clear product showcase for the homepage, trust-focused conversion for Store, search-first documentation for Wiki, and a scannable operations dashboard for Admin.

This is a curated SLF adaptation of UI UX Pro Max's Gaming, E-commerce, Knowledge Base, Dark Mode, and Accessibility guidance. It is not permission to replace the existing SLF brand with a generic template.

### Keep the existing identity

- Deep navy space-like surfaces, cyan light accents, lavender secondary accents.
- Subtle radial gradients and layered panels; keep backgrounds quiet enough for text.
- A clean modern game-world feel, not medieval/faux parchment across the entire site.
- The Wiki reader may retain its existing book/paper reading surface as a deliberate, page-specific exception.
- Keep the current logo, wording, product names, rules, prices, and server details unless explicitly requested to change them.

### Avoid

- Heavy WebGL/Three.js, 3D backgrounds, parallax layers, or expensive animation for decorative effect.
- Full-screen neon, CRT scanlines, glitch text, or constant animated gradients.
- Random mixing of glass, clay, neumorphism, brutalism, and flat styles.
- Emoji characters as newly introduced functional icons. Prefer small inline SVG icons with consistent stroke. Existing decorative emoji in legacy content may remain until that component is revised.
- Auto-rotating carousels, hover-only actions, tiny controls, fake activity counters, fake urgency, or unverified status claims.

## 2. Color tokens

Use the existing CSS variables from `assets/css/frontier-theme.css` as the main implementation reference. The values below document the current SLF theme; don't silently redefine them.

| Token | Value | Use |
|---|---|---|
| Background | `#080F1D` | Main page background |
| Background 2 | `#0D1728` | Secondary page/surface |
| Panel | `#101C30` | Main cards and panels |
| Panel 2 | `#17253C` | Raised/interactive surfaces |
| Text | `#EDF4FF` | Main text |
| Muted | `#B4C2D8` | Supporting copy |
| Brand cyan | `#86E7EF` | Primary brand accent and focus |
| Cyan light | `#D7FBFF` | High-contrast accent text |
| Lavender | `#AC9DFF` | Secondary accent |
| Green | `#81E5BF` | Success/healthy state |
| Yellow | `#F0D998` | Warning/pending state |
| Red | `#FB90A6` | Error/destructive state |
| Blue | `#83D9FF` | Informational state |
| Border | `rgba(155,187,230,.16)` | Quiet dividers and outlines |

Rules:
- Keep cyan as the main action color; lavender is secondary, not a competing CTA.
- Status always needs a text label or icon as well as color.
- Check actual text/background contrast for each new component. Normal text target is at least 4.5:1; don't assume a token pair passes without checking.
- Avoid raw one-off hex values when an existing semantic token is suitable.
- The legacy variable names `--gold` and `--gold2` currently map to cyan shades in `frontier-theme.css`. Don't rename them without checking every selector that uses them.

## 3. Typography and content

- Main UI: system UI / system sans stack; no new font download by default.
- Heading hierarchy: compact, clear, strong weight; use existing responsive `clamp()` patterns.
- Body text on mobile: 16px minimum where practical; line height around 1.6–1.85.
- Keep reading measure around 60–72 characters; use `max-width: 72ch` or a narrower page-specific measure.
- Wiki reader may use Georgia/serif for long-form reading, while navigation, controls, and metadata remain sans-serif.
- Prices, order numbers, IDs, and timers should use tabular/monospaced figures when alignment matters.
- Use Indonesian labels that explain the action. Don't replace useful labels with unexplained symbols.

## 4. Layout and component language

- Main content max width: 1180px (existing `--max`).
- Base spacing rhythm: multiples of 4px; use 8px increments for most layout gaps.
- Card radius: generally 13–17px; buttons around 12px; inputs around 10–11px.
- Keep borders thin and subtle; use shadow for hierarchy, not decoration.
- Use CSS Grid/Flexbox with shrinkable children (`min-width: 0`) and wrapping long user content.
- Mobile-first layouts; preserve a single clear column when space is limited.
- Sticky navigation must not hide headings or keyboard focus; preserve scroll offset.

## 5. Interaction and motion

- Primary buttons have visible hover, pressed, focus, disabled, and loading states.
- Primary touch targets should be at least 44px high. Leave enough space between adjacent controls.
- Click/tap is the primary interaction; never make important actions hover-only.
- Provide immediate feedback on save, submit, load, and errors. Errors should explain recovery.
- Use opacity/transform for simple transitions; motion must explain a state change.
- Keep decorative motion to one or two focal elements per view.
- Respect `prefers-reduced-motion: reduce`; the content and actions must work without animation.
- No auto-playing video or automatically rotating content without user controls.

## 6. Accessibility requirements

- Semantic HTML, one clear page-level H1, ordered heading levels, landmarks, and a skip-to-content link on navigation-heavy pages.
- Every form field gets a visible label; placeholders are examples, not labels.
- Every icon-only control gets an accessible name. Decorative SVG uses `aria-hidden="true"`.
- All operable UI works with keyboard, with a visible focus indicator.
- Error messages appear near the affected field and are announced appropriately. Failed forms should identify what needs correction.
- Loading, empty, error, success, and disabled states must be designed, not left as blank space.
- Meaningful images have descriptive alt text; decorative images use empty alt text.
- No horizontal overflow at 320, 375, 414, 768, 1024, and 1440px viewport widths.

## 7. Performance and implementation

- Preserve the current no-framework HTML/CSS/JS architecture.
- Do not add a dependency, font package, animation library, or CSS framework for a small visual change.
- Use existing CSS files and variables before adding new ones.
- Images should have dimensions/aspect-ratio reserved; lazy-load below-the-fold media.
- Avoid large animated assets and expensive filters on mobile.
- Keep JavaScript interactions progressively usable and handle failed network/API responses visibly.
- UI changes must not bypass server-side validation, Owner/Admin authorization, D1 persistence, or existing checkout/payment behavior.
- Keep the static frontend and Cloudflare Pages Functions responsibilities separated.

## 8. Page composition patterns

- Beranda: Hero-Centric + Feature-Rich Showcase + concise storytelling. The first screen must explain what SLF is and show one primary join action.
- Store: trust-first Feature-Rich Showcase. Make product, price, benefit, checkout requirement, manual payment and delivery process explicit. No fake scarcity.
- Wiki: FAQ/Documentation pattern. Search and category navigation first, readable article structure, related articles and clear back path.
- Admin: Real-Time/Operations layout. Prioritize task state, search/filter, concise data tables, clear status, and safe destructive actions.

## 9. Pre-delivery checklist

- [ ] Read this MASTER and the relevant page override before editing.
- [ ] Preserve existing SLF theme, content, data, and functionality.
- [ ] One clear primary action per section/screen.
- [ ] Text and controls have sufficient contrast and visible focus.
- [ ] Forms have labels, validation, loading, success, and recovery states.
- [ ] Mobile layout checked at 320/375/414/768px; desktop checked at 1024/1440px.
- [ ] No horizontal overflow or clipped labels.
- [ ] Reduced-motion mode retains the final readable state.
- [ ] Existing tests pass; add a test when behavior changes.
- [ ] Do not claim production deployment or live verification without checking it.
