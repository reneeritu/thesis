# TODO_BACKEND.md — What’s still left

This file is a “shelf” checklist for backend work that is either:
- not implemented yet, or
- incomplete vs `docs/BACKEND.md`, or
- explicitly marked TODO in code.

## Tier / feature gaps (spec compliance)

1. **Phase 4 — Autonomous transition mechanics**
   - Implement the protocol-level mechanics described in `BACKEND.md` for Phase 4.
   - Ensure transition rules, execution, and validator/founder handoff semantics are fully covered end-to-end.

2. **Profiles & Social Layer (Phase 4 spec items not yet delivered)**
   - **Trustees-based social recovery flow** (seed phrase recovery exists, but trustees-based confirmation/reset needs implementation).
   - **Outreach / collaboration request system** (routes/services + cooldown/denial limits + harassment reporting).
   - Confirm the server-side enforcement matches `BACKEND.md` for:
     - cooldown after denied requests
     - auto-blocking after repeated denials
     - send limits for unanswered requests
     - harassment reporting behavior

## VETO / visibility enforcement

3. **Trace visibility enforcement audit**
   - Current implementation enforces VETO visibility side-effects at the `Trace` serving layer for:
     - `GET /traces/:id`
     - `GET /traces/project/:projectId`
   - Remaining work:
     - verify all other endpoints that indirectly expose trace content (if any) apply the same visibility rules.
     - (If endpoints exist) apply the same `ndaSealed` => `403` rule for non-owners and redaction rule for `scope_limit`/`content_flag`.

## Content & Safety (Phase 3C)

4. **Finish remaining Phase 3C spec behaviors**
   - Some Phase 3C work was temporarily shelved due to failures, later minimally unblocked to make tests runnable.
   - Remaining work to verify/finalize against `BACKEND.md`:
     - CSAM emergency deletion + suspension appeal window behavior
     - NCII emergency removal + encryption-at-rest + destruction-after-case-close
     - Illegal content removal paths
     - Space nudity restrictions vs chain-level permissibility

## Moderation / Mediation / Governance completeness

5. **Mediation dispute handling cross-space classification**
   - `src/routes/mediations.ts` has `TODO: detect cross-space disputes`.
   - Ensure complexity/time-lock/moderator selection classification matches the spec rules.

6. **Any remaining moderation/mediation “failure path” hardening**
   - Confirm each trigger type’s close/fail behavior matches spec.
   - Add any missing invariants and tests for:
     - `space_ban_dispute`
     - `classification_appeal`
     - `veto_dispute`

## Operational / API quality TODOs found in code

7. **Pagination for list endpoints**
   - `src/app.ts`: “Add cursor-based or offset pagination… once data volumes grow.”

8. **Proxy auto-confirmation deadline enforcement**
   - `src/routes/traces.ts`: `TODO: Proxy log auto-confirmation on deadline expiry is not yet enforced.`

9. **Fork parent contributor notification**
   - `src/routes/forks.ts`: notify parent contributors of the fork.

10. **Credits off-chain contributor cross-check**
   - `src/routes/credits.ts`: cross-check `offChainContributors` against off-chain mentions in traces (once traces expose the necessary field).

11. **Credit signing timeout escalation**
   - `src/routes/credits.ts`: implement configurable timeout so unsigned contributors can escalate into mediation.

12. **Space application requirement enforcement**
   - `src/routes/spaces.ts`: placeholder message “requires an application — not yet implemented”.

## Demo / developer ergonomics

13. **Add a small localhost “smoke demo” runner**
   - A CLI runner or lightweight demo page that:
     - registers 2-3 nodes
     - creates a space + project
     - logs a trace
     - applies a VETO (at least NDA seal)
     - shows `200/403` or redaction behavior in plain text.

