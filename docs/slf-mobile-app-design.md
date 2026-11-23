# SLF Mobile App — Technical Design

## Intent
Build an installable, standalone-like mobile PWA for Survival Legacy Frontier inside `/app/` in the existing `slf-website` repository. The app consolidates Admin Tools, Owner controls, and SLF Studio without replacing or changing the existing public website.

## Goals
- Mobile-first App Hub with direct navigation to Studio, Wiki, Tickets, Transactions, and Owner settings.
- Offline app shell and IndexedDB storage for locally saved drafts and previously synchronized read-only data.
- SLF Studio with a fixed upper preview region and an independently scrollable lower tools/layers region.
- Layer-based project model that can later support text, image, video, table, button, animation, triggers, and data bindings.
- D1 remains the single system of record for server-side data. Existing Pages Functions and API contracts are reused where possible.
- Owner-only transaction voiding is enforced on the server and excluded from revenue aggregates.

## Non-goals
- No Supabase project/database provisioning.
- No changes to public website behavior, current admin login, ticket checkout, wiki editor, or existing transaction flows in the first foundation phase.
- No promise that server actions, payments, or backend writes work offline.
- No automatic execution of arbitrary user-provided JavaScript in the Studio.

## Architecture
- Static PWA shell at `/app/`, with a service worker scoped strictly to `/app/`.
- Cache Storage stores versioned app-shell assets; IndexedDB stores local drafts and synchronized snapshots. API writes are never queued as if they succeeded.
- Cloudflare Pages Functions continue to serve authenticated server operations and use the existing `DB` D1 binding to `slf-store-db`.
- Existing D1 currently contains orders, reentry_tickets, finance_entries, wiki_books/wiki_chapters and legacy wiki_categories/wiki_articles, site_design, and site_content. Reuse and map these schemas before introducing any migration.
- App-specific project/layer/route/backend metadata will be added through additive, versioned D1 migrations only after the API and permission model are audited.
- Role checks must be performed in Pages Functions using the existing Owner/Admin credential model; client-side role hiding is UX only.

## Approaches
1. **Separate PWA under `/app/` in the same repository (selected):** isolated UI and service-worker scope; shares the existing domain, deployment, auth/API, and D1. Lowest risk to the current site.
2. Separate repository and deployment: stronger separation but duplicates deployment/configuration and complicates same-origin authentication and API use.
3. Replace the current admin site with a mobile app: rejected because it increases regression risk and violates the isolation requirement.

## Phase boundaries
1. PWA foundation and mobile Studio shell: manifest, app shell, offline cache, IndexedDB drafts, App Hub, fixed split-screen editor scaffold.
2. Read integration: connect existing Wiki books/chapters, ticket data, and transaction views using current APIs; cache only data that is safe for the signed-in Owner/Admin.
3. Studio project/layer persistence in D1, media management, page/route builder, responsive preview, undo/redo.
4. Safe backend/table builder using allow-listed schema operations, migration review, and D1-backed endpoint/function templates.
5. Action/Command registry, data binding, interaction/infinite animations, and secure execution.
6. Owner-only transaction soft-delete/void API, audit log, and revenue aggregation changes.
7. Security, accessibility, offline, migration, and regression tests; staged deployment and production verification.

## Constraints and safety
- Keep all first-phase code additions under `/app/` and this design document under `docs/`.
- Do not modify existing site or admin files unless a later task explicitly requires a narrow integration.
- Never expose Cloudflare secrets, admin credentials, or D1 service bindings in client code.
- Offline mode is read-only for server-backed records. Local drafts are marked unsynced until a successful server acknowledgment.
- Transaction deletion is logical voiding, never physical deletion; only Owner can perform it.
- Backend builder accepts structured, validated definitions; it must not expose unrestricted SQL or arbitrary code execution.

## First-phase acceptance criteria
- `/app/` loads independently and can be installed as a PWA on supported browsers.
- After one successful online visit, the app shell opens offline.
- App navigation remains usable offline; saved local drafts survive reloads.
- Studio preview stays pinned while the lower panel scrolls independently.
- Creating/selecting/editing a local layer and saving a draft works without a network.
- Service worker does not intercept or cache requests outside `/app/`.
- No existing website, admin, ticket, or wiki file is changed in this phase.
