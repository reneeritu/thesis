# Chapter 6 — Projects

A **project** is a **single** tracked work thread: one artwork, one build, one research line. It always lives inside a **space** (the `spaceId` field) except where lineage (`parentProjectId`) explicitly ties it to a **fork** of another project.

## Who can create a project?

- The creator must be a **node** and must satisfy the **space’s** `projectAccess` rule:  
  - `open` — any member (or the space’s rules) can start.  
  - `invite_only` / `application` — gating and approvals apply (see [Chapter 5](05-spaces.md)).

In the API, creating a project records a **`start` block** (see `addBlock` usage in project creation routes) and sets contributors.

## Project lifecycle: `status`

`Project.status` in `src/models/Project.ts`:

| Value | Meaning (product) |
|-------|----------------------|
| `active` | Normal work. **Traces** can be added (if not blocked by veto, dispute, or API). |
| `halted` | **Paused** by governance or a dispute. |
| `disputed` | In **mediation** or a stuck disagreement—**some** actions are blocked. |
| `completed` | Closed; **CREDIT**-style end state (and provenance, per spec). |
| `archived` | Treated as **archived/retro** work or moved out of the active pool (match UI and routes). |

> Always check the current route logic: the trace route rejects new traces unless `status === 'active'`.

## Contributors

`contributors` is an **array of sub-documents** with:

| Field | Use |
|-------|-----|
| `alias` | Which node. |
| `role` | Free text, e.g. *lead*, *sound*, *mentor*—defaults to `contributor`. |
| `isPrimary` | **Primary** contributors are required to **sign** the **CREDIT** (end) step in the spec. |
| `signedAt` | If credit signing is used. |
| `accepted` | `true` / `false` / `null` — invitation accepted, declined, or **pending invite**. |
| `invitedAt` | When the invite was sent. |

**Only contributors** on the list can post **traces** to that project (enforced in `src/routes/traces.ts`).

## Pedagogy and mentors

- `context` — free-text project framing.  
- `pedagogicalId` and `mentorAlias` — in the spec, a **mentor** can get an elevated role if the project is **pedagogical**; see `docs/BACKEND.md` and your UI forms.

## Visibility: `visibility`

`Project.visibility`:

| Value | Who sees the **process** (traces) |
|-------|--------------------------------------|
| `space_only` | **Members of the space** (default in schema). |
| `process_visible` | Broader: process log visible to non-members, per discover rules. |
| `fully_public` | **Fully public** in discovery / feeds (subject to `discover` route filters). |

**Outside viewers (spec default):** people who are not in the space often see only the **Final** provenance / NFT-style summary unless you raise visibility.

## Lineage: forks

- `parentProjectId` — if set, this project is a **child** of another project.  
- **FORK** contract rules (per spec): parent contributors are **notified**; **reputation in the new project is earned in the new project** only; **dormant-space*** forks get a **visible** lineage marker.  

## Block anchor

- `startBlockIndex` — ties the start of the project to the **append-only** log index at creation time.

## User journey (simplified)

1. Join or create a **space**.  
2. **Start a project** (START contract) with title, contributors, and optional mentor/pedagogy.  
3. **TRACE** in a loop until the work is ready to **close**.  
4. **REFERENCE** and **VETO/PIVOT** as needs arise.  
5. **CREDIT** to fix attribution, mint the provenance / contributor tokens, and end the line.

Details for each step: [Chapter 7 — Contracts](07-contracts.md).

## Further reading

- [Chapter 5 — Spaces](05-spaces.md)  
- [Chapter 7 — Contracts](07-contracts.md)  
- [Chapter 9 — Reputation](09-reputation.md) (how traces and projects move category scores)  
- [Chapter 12 — Flows](12-system-flows.md)  
