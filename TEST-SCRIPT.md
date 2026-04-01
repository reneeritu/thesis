# Aura2 End-to-End Test Script

This script verifies auth, contracts, contributions/radar, governance, and search.

## 1) Start app

In one terminal:

```bash
npm install
npm run dev
```

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the frontend URL printed by Vite (usually `http://localhost:5173`).

## 2) Auth guard + login behaviour

1. Open `/login`, `/register`, `/recover`.
2. If you already have a token/session, you should be redirected to `/dashboard`.
3. Click **Sign out**.
4. Try `/dashboard` directly while signed out; you should be redirected to `/login`.

## 3) Space + project creation

1. Register a fresh user.
2. Open **Spaces** → **+ Create**.
3. Complete the 5-step wizard and create a space.
4. Open **Projects** → **+ New project** and create a project in that space.

## 4) Contracts on project detail

Open the project detail page and exercise:

1. **LOG WORK** (TRACE): submit at least 2 traces with different activity types and tools.
2. **ADD REFERENCE** (REFERENCE): submit URL or citation.
3. **RECORD PIVOT** (PIVOT): submit reason.
4. **RAISE VETO** (VETO): submit a veto.
5. **FORK**: create a fork.
6. **END PROJECT** (CREDIT): create credit split.

Expected:
- Timeline updates with TRACE/REFERENCE/PIVOT/VETO entries.
- Project state/actions update after credit.

## 5) Contributions radar + score

1. Open **Dashboard** and **Profile**.
2. Confirm radar chart is rendered in contributions panel.
3. Log additional traces (e.g. `skillwork`, `research`, `pedagogy`) and refresh dashboard/profile.
4. Confirm both:
   - `CURRENT SCORE` changes.
   - Radar shape changes according to category activity.

## 6) Governance: raise flag/dispute

1. Open **Governance**.
2. Raise a normal flag:
   - Category: `content`
   - Type: `harassment`
   - Target type: `project`
   - Target id: existing project id
3. Raise a dispute flag:
   - Category: `dispute`
   - Type: `credit_dispute` or `veto_dispute`
4. From project forms:
   - Use dispute links shown in CREDIT/VETO panels.

Expected:
- New entries appear under **My open flags**.
- Related mediations appear under **My mediations**.

## 7) Search (spaces/projects by context/software)

1. Open **Spaces** → **Search** and query by:
   - space name
   - words from description
   - content restriction keyword
2. Open **Projects** → **Search** and query by:
   - title
   - context text
   - tool/software used in traces

Expected:
- Matching spaces/projects appear.
- Project results show tool list and space name.

## 8) Archive flow sanity

1. Open **Archive**.
2. Submit archive evidence via file and URL path.
3. Confirm archive project and NFT are created and reachable.

## 9) API smoke checks (optional)

If you want direct API checks while logged in, use your bearer token:

```bash
curl -H "Authorization: Bearer <TOKEN>" http://localhost:3000/flags/mine
curl -H "Authorization: Bearer <TOKEN>" http://localhost:3000/mediations/mine
curl -H "Authorization: Bearer <TOKEN>" "http://localhost:3000/spaces/search?q=studio"
curl -H "Authorization: Bearer <TOKEN>" "http://localhost:3000/projects/search?q=figma"
```

