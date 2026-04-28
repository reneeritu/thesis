# Chapter 5 — Spaces

A **space** is the **local studio context** for Etch: a university class, a design practice, a research lab, a hobby collective, etc. Every **project** (excepting special flows like lineage forks) **belongs to exactly one space**.

## What a space is (and is not)

- **Is:** a **governance and membership container** for projects—who may join, who can start a project, what the default privacy is, and who holds **veto** authority.
- **Is not:** a financial product. The design requires **“financial linking: always NO”** and **immutability** of that fact at creation (`docs/BACKEND.md` + `ISpaceSettings` in `src/models/Space.ts`).
- **Is not (by itself) “the whole blockchain”**—spaces are **Tier 1** in [three-tier governance](10-governance.md). They can **tighten** rules but **not** relax **meta (chain-wide) rules**: no discrimination by identity, no blocking members from **raising flags** to the protocol, no bans without a **moderation process**, no membership fees.

## Who can create a space?

**Any active node** can create a space in principle (per product spec). The `Space` model includes `creatorAlias` and a starting `admins` array.

> Implementation detail: the actual “create space” route and membership sync live under `src/routes/` (see [Chapter 13](13-implemented-vs-planned.md)).

## What must be declared at space creation

The `settings` sub-document (`ISpaceSettings` in `src/models/Space.ts`) mirrors the product requirements:

| Setting | Options / type | Role |
|---------|----------------|------|
| `projectAccess` | `open` / `invite_only` / `application` | **Who can start a project** in this space. |
| `vetoAuthority` | list of **aliases** (strings) | **Who** can exercise veto-style powers on projects (as accepted; see `pendingVeto`). |
| `votingThreshold` | 0.0 – 1.0 | For **in-space** votes. |
| `privacyDefault` | `public` / `space_specific` / `private` | Default for **new** work’s visibility. |
| `customContractsAllowed` | boolean | If **space-level** custom logic is even allowed. |
| `contentRestrictions` | list of string tags | e.g. “no nudity” in a school space. |
| `minDocRequirements` | list of string tags | **Extra** documentation minimums beyond the **chain** minimum. |

**Immutable at creation (spec, not all fields in code):** “financial linking: NO” and other one-way declarations. Treat `BACKEND.md` as the **contract**; compare to the schema in git when implementing.

## Joining a space (behaviour, spec-level)

- **`open`:** a node can join without an invite.  
- **`invite_only`:** need a valid **invite code** (see `InviteCode` in the model) and/or an **admin** approval, depending on product rules.  
- **`application`:** node **requests**; an admin approves.  

Invite codes can support **expiry** and **use limits** (fields: `maxUses`, `usedCount`, `expiresAt`, `mode` of `single_use` / `multi_use` in `IInviteCode`).

## Veto authority and `pendingVeto`

`settings.vetoAuthority` are aliases who have **accepted** the role. `pendingVeto` tracks invited veto authorities who have **not** yet responded, with a `notifiedAt` time—used to stage onboarding without silently granting power.

## Space roles

- **Creator** — in `creatorAlias`
- **Admins** — in `admins` array; can manage members, invites, and space config (per routes)
- **Members** — in `members` array; can participate according to `projectAccess`

**Banning (spec):** a space can **ban a node from that space only**; the node **remains** on the chain and in other spaces. Bans require **moderation**—not arbitrary instant removal by a single person.

## Dormant spaces (spec)

If a space is **dormant**:

- **No** new members, no new projects, no edits.  
- Data is **not** deleted.  
- **Cannot reactivate** the same space (per `BACKEND.md`).  
- Admins can **fork a new space** with a **`parentSpaceId` lineage** link so continuity is **visible** without faking the old space as active.

**Triggers (spec):** e.g. space creator + **majority of admins** agree, *or* a **meta (Tier 3) vote** forces dormancy.

`Space.status` in code: `'active' | 'dormant'`.

## Visibility: inside vs outside the space

- **Default (spec) for external viewers:** they see a project’s **Final NFT / end artefact** only, **not** the process unless the project is **process_visible** or **fully_public**.  
- **Per-project override:** see [Chapter 6](06-projects.md) (`space_only` / `process_visible` / `fully_public` on `Project`).

## `Space` model reference (as implemented)

Key paths in `src/models/Space.ts`:

- `name`, `description`  
- `creatorAlias`, `admins[]`, `members[]`  
- `settings` (embedded `ISpaceSettings`)  
- `pendingVeto[]`  
- `inviteCodes[]`  
- `status` — `active` or `dormant`  
- `parentSpaceId` — for fork lineage  

Indexes include `creatorAlias`, `members`, and `status` for list queries and discovery.

## Further reading

- [Chapter 6 — Projects](06-projects.md)  
- [Chapter 7 — Contracts](07-contracts.md) (START, VETO, CUSTOM)  
- [Chapter 10 — Governance](10-governance.md) (space vs cross-space vs protocol)  
- [Chapter 11](11-moderation-and-flags.md) (space misconduct, flags)  
