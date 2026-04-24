## Aura2 Frontend Migration Roadmap

React/Tailwind shell at `/` is now the primary entrypoint, with the legacy hash-router UI still available under `/legacy`. This roadmap tracks the migration of app surfaces from the legacy UI (`public/js/site.js` + `#/…` routes) onto the new React shell without changing backend contracts.

> **Palette note (April 2026):** the original spec called this a *monochrome* shell (black/grey/white + yellow accent). That constraint has since been lifted — the full Tailwind palette is available per component/page, and global defaults (`body`, `h1..h6`, `a`, `Button`) no longer force a specific text color. The shell chrome (grid, spacing rhythm, typography scale) is unchanged.

---

## M0 — Foundations (baseline)

**Status**: Done / evolving

- **Shell**: Max content width `max-w-shell` (see Tailwind config), 12‑column grid, horizontal padding via `shell-px`, 8px spacing rhythm. (Historically "monochrome" — now color-agnostic, see note above.)
- **Typography**: Fixed scale (H1 64px, H2 40px, H3 24px, body 16px, small 14px) implemented with fluid `clamp(...)` down to mobile minima, capped at design sizes.
- **Color + texture**: Black/white/greys/yellow, dotted/noise background.
- **Routing**:
  - React SPA mounted at `/`.
  - Legacy app available at `/legacy/index.html#/…`.
  - `/login`, `/register`, `/recover` implemented as React pages, wired to `/auth/*` backend routes.
  - `/dashboard` is a React page; legacy backup remains at `/legacy/index.html#/dashboard`.
- **Auth contract**:
  - Persists `aura2_token` and `aura2_alias` in `localStorage` (same keys as legacy).
  - Uses existing backend routes:
    - `POST /auth/register` `{ alias, password }`
    - `POST /auth/login` `{ alias, password }`
    - `POST /auth/recover` `{ alias, seedPhrase, newPassword }`

**Exit criteria** (met):

- Any new React page can call backend APIs via the shared `api` helper and use the existing token/alias session model.
- Landing + auth flows live in React and keep working end‑to‑end.

---

## M1 — Router + auth guard

Introduce a proper React routing surface for app pages while still delegating many views to the legacy app.

**Scope**

- Define canonical React routes that mirror hash routes:
  - `/dashboard`
  - `/me`
  - `/spaces`, `/spaces/new`, `/spaces/join`, `/spaces/:id`, `/spaces/:id/settings`
  - `/projects`, `/projects/new`, `/projects/:id`, `/projects/:id/:subview` (trace, reference, pivot, veto, fork, credit, nft)
  - `/discover`, `/archive/new`, `/nodes/:alias`, `/nfts/:id`
- Add a simple auth guard for protected routes:
  - If there is no `aura2_token` in `localStorage`, redirect to `/login`.
  - After login, send users to `/dashboard`.
- Ensure server SPA fallback treats these as client routes (already handled by Express + Vite build).

**Exit criteria**

- Visiting `/dashboard` while logged out redirects to `/login`.
- Visiting `/dashboard` while logged in hits a React route (even if it still redirects into legacy for actual content).
- Deep links like `/spaces/:id` resolve via React routing (initially may still redirect to `/legacy` view‑by‑view).

---

## M2 — React Dashboard

Move the main landing surface for logged‑in users from `#/dashboard` in the legacy app to a new React `DashboardPage`.

**Scope**

- Implement `DashboardPage` under `/dashboard` with the monochrome grid shell.
- Port the same data that legacy dashboard shows:
  - Reuse the same APIs that `site.js` calls for the current dashboard.
  - Start with read‑only lists and status chips; defer complex actions to later milestones if needed.
- Keep `/legacy/index.html#/dashboard` working:
  - Older bookmarks still open the legacy dashboard.
  - New flows in React (login / register / landing CTA) should go to React `/dashboard`.

**Exit criteria**

- New sessions land on React `/dashboard` after login/register/recover.
- Dashboard data matches what the legacy `#/dashboard` shows (modulo visual style).
- Legacy dashboard is no longer needed for day‑to‑day use, but remains as a manual fallback.

---

## M3 — Profile (`/me`)

Move account/profile management to React while preserving underlying backend behavior.

**Scope**

- Implement `/me` (or `/profile` with `/me` as an alias/redirect) in React:
  - Fetch profile details via the same endpoints used in `site.js` (e.g. GET/PUT/PATCH user profile).
  - Mirror validation and constraints from the legacy forms.
- Keep profile‑related actions compatible with existing backend events and notifications.

**Exit criteria**

- Users can view and update their profile in React.
- Visiting `#/me` either redirects to `/me` or is clearly documented as a legacy‑only path.
- No behavior regressions compared to the legacy profile page.

---

## M4 — Spaces

Port the spaces experience: list → creation/join → individual space view → settings.

**Scope**

1. **Spaces list**: `/spaces`
   - Show all spaces the current user can see, matching the legacy list.
2. **Create/join flows**: `/spaces/new`, `/spaces/join`
   - Rebuild wizards with the new grid system, preserving backend payloads and validation rules.
3. **Space view**: `/spaces/:id`
   - Show key metadata and activity for a single space.
4. **Space settings**: `/spaces/:id/settings`
   - Port the “Space settings” form:
     - `projectAccess`
     - `vetoAuthority`
     - `votingThreshold`

**Exit criteria**

- Space lifecycle (discover → join/create → view → adjust basic settings) is fully usable in React.
- Legacy `#/spaces…` views are no longer required for common flows.

---

## M5 — Projects

This is the largest surface and may be split further if needed.

**Scope**

1. **Projects board**: `/projects`
   - Port the board / table of projects visible to the user.
2. **New project**: `/projects/new`
   - Implement project creation workflows compatible with current backend fields.
3. **Project default view**: `/projects/:id`
   - Show key metadata and activity timeline.
4. **Project sub‑views**:
   - `/projects/:id/trace`
   - `/projects/:id/reference`
   - `/projects/:id/pivot`
   - `/projects/:id/veto`
   - `/projects/:id/fork`
   - `/projects/:id/credit`
   - `/projects/:id/nft`
   - Each subview should reuse the same backend endpoints that `site.js` currently calls for that route.

**Exit criteria**

- For a typical user, all project creation and review work can happen in React.
- Legacy project routes remain as a fallback, but no longer needed for normal workflows.

---

## M6 — Public / secondary surfaces

**Status**: Done (core set)

**Implemented**

- `/discover` — alias lookup → `/nodes/:alias` (auth required; matches legacy discover flow).
- `/archive/new` — archive wizard: file upload via `POST /upload/archive-evidence` (Media row in MongoDB + bytes on disk), or URL hashed client-side; `POST /archives` with evidence hashes + optional `mediaId`; media rows get `projectId` after archive project is created.
- `/nodes/:alias` — public node profile (`GET /nodes/:alias` with optional auth).
- `/nfts/:id` — provenance bundle (`GET /nfts/:id`, auth required by API).

**Still legacy-only (optional later)**

- Notifications panel, appeals, project subviews (`/projects/:id/trace`, etc.).

**Exit criteria** (met for listed routes)

- Public URLs and secondary flows above have React equivalents wired to the same APIs.

---

## M7 — Cutover and cleanup

**Status**: Done (app shell + landing)

**Implemented**

- Logged-in **AppShell** nav uses React routes only (`/dashboard`, `/me`, `/spaces`, `/projects`, `/discover`, `/archive/new`) plus an explicit **Legacy** link to `/legacy/index.html#/dashboard` and **Sign out** (clears `localStorage`).
- Landing footer links to **open legacy app** for backup.
- Unauthenticated shell still shows Login / Register / Recover.

**Optional follow-ups**

- Trim unused branches in `public/js/site.js` once no longer needed.
- Add project subroutes in React when ready.

**Exit criteria** (met for primary navigation)

- React is the default UI; legacy is reachable on purpose, not required for core flows.

---

## Later — Combined dashboard + profile (tabbed)

**Status**: Planned (not started)

- Merge **Overview** (current `/dashboard`: reputation, crystal radar, chain, quick links) and **Edit profile** (current `/me`: form + metadata) into **one route** with tabs, e.g. `/me` or `/dashboard`.
- Tab **Overview** ≈ today’s dashboard content; tab **Profile** ≈ today’s profile form.
- Support deep links, e.g. `?tab=profile` or `/me/profile`, and update **AppShell** nav so “Dashboard” / “Profile” point into the same page.
- **Dedupe** the crystal / reputation header so it isn’t mounted twice; keep a single source of truth for node data.

