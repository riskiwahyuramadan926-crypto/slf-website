# SLF Mobile PWA — Phase 1 Implementation Plan

> **For agentic workers:** Implement only the isolated files listed below. Keep all existing website and admin behavior untouched.

**Goal:** Deliver an installable offline-capable mobile app shell and the first local-draft Studio editor.

**Architecture:** Static PWA under `/app/`; scoped service worker for app-shell resources; IndexedDB for local project drafts; no new server endpoint or D1 migration in this phase.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Web App Manifest, Service Worker, Cache Storage, IndexedDB, Cloudflare Pages static deployment.

**Spec:** `docs/slf-mobile-app-design.md`

## Global Constraints
- Only add files under `/app/` and design/plan documents under `/docs/`.
- Service worker scope must remain `/app/`.
- Never cache POST requests or claim a server write succeeded while offline.
- D1 remains the only system of record; this phase performs no D1 writes.
- Existing public pages, Admin Tools, Wiki, Tickets, and transactions are not modified.

## Review Focus
- First visit before service-worker activation: app must still function online.
- Offline launch after successful online visit: app shell and local drafts remain usable.
- IndexedDB unavailable or blocked: app must show a clear failure without crashing navigation.
- Image/video URL input: only preview as user-provided content; do not run arbitrary scripts.
- API and pages outside `/app/`: service worker must not intercept them.

---

### Task 1: PWA app shell
**Files:** `app/index.html`, `app/manifest.webmanifest`, `app/icon.svg`, `app/app.css`, `app/sw.js`.
**Checks:** Validate manifest JSON; verify all app-shell asset paths; verify service-worker path and scope; verify fetch handler only handles same-origin GET requests under `/app/`.

### Task 2: Local-first Studio draft
**Files:** `app/app.js`.
**Checks:** Validate JavaScript syntax; create/select/edit/remove a layer; save and reload a draft through IndexedDB; test offline navigation and ensure no server write is reported as successful.

### Task 3: Phase 1 verification
**Files:** no existing files modified.
**Checks:** Review branch diff; confirm every changed path is new and inside `/app/` or `/docs/`; run PWA smoke checks and report deployment state separately from local code verification.

## Deferred phases
- Connect existing Wiki book/chapter, ticket, transaction, and Admin APIs.
- Add versioned D1 schema for Studio projects, layers, routes, and backend definitions after inspecting existing auth and API patterns.
- Add server-enforced Owner-only transaction voiding and update revenue aggregates.
- Add command/action registry and constrained backend builder; do not expose arbitrary SQL or code execution.
