# Chapter 13 — Implemented in this repository vs. planned in the spec

This chapter ties **stories in `docs/BACKEND.md`** to **concrete** **files in aura2** so a reader (or a DocBook build) can tell **“shipped in `npm`”** from **“designed, still evolving.”**

## 1. Runtime architecture (what is real today)

- **Node.js** **Express** server, TypeScript, **MongoDB** + **Mongoose** (`MONGODB_URI` in the environment; **required** in production paths — see `src/server.ts` which calls `connectDatabase()` from `src/config/database.ts` before any routes that need the DB).  
- **On boot:** `ensureGenesis()` in `src/services/chain.ts` **creates a genesis** `Block` if the chain is empty; the **block log** is **append-only** in normal operation via **`addBlock`**.  
- **Secrets (production check in `src/server.ts`):** `MONGODB_URI`, **strong** `JWT_SECRET`, 64-hex `ENCRYPTION_KEY` for **seed** encryption.  
- **Client:** React **`frontend/`** (primary per `ROADMAP.md`); **legacy** hash-router still at **`/legacy`**.  

## 2. “Chain” — what is *actually* implemented

| Piece | File(s) / behaviour |
|-------|---------------------|
| **Block** documents | `src/models/Block.ts` — `index` **unique**, `type` in enum list, `previousHash` + `hash` **unique** |
| **Appending** events | `addBlock` in `src/services/chain.ts` — new block gets **incrementing** `index`, `sha256` over payload + `previousHash` (read file for the exact string format) |
| **Genesis** | `ensureGenesis()` on boot |
| **Event types in code** | The `Block` enum is wider than a single dApp: includes `governance`, `mediation`, `flag`, `archive`, `fork`, `credit`, etc. **Whether every type has a first-class button in the React UI** varies — the **API routes** (below) are the ground truth for **MVP** coverage. |
| **PoA / PoR, external validators, multi-writer** **consensus** | **Design** in `docs/BACKEND.md` — **not** a separate p2p network in this **repo** as of a typical `npm` deploy. The **app** is the **sole writer** to the **Block** **collection** in a single-tenant deployment.  

## 3. **HTTP** API surface (backend routes, `src/routes/`)

These files exist and map closely to the **“contracts”** **story**:

| File | Relates to |
|------|------------|
| `auth.ts` | `identity` **block**, **register** / **login** / **recover** |
| `spaces.ts` | **Space** CRUD, **join**, **invites** |
| `projects.ts` | **START** **(project)**, `startBlockIndex` |
| `traces.ts` | **TRACE** + **proxy** (with `redactTraceForCaller`) |
| `references.ts` | **REFERENCE** **contract** + `reference` **blocks** |
| `pivots.ts` | **PIVOT** |
| `vetos.ts` | **VETO** |
| `credits.ts` | **CREDIT** and related **on-chain** **events** |
| `forks.ts` | **FORK** |
| `archives.ts` | **ARCHIVE** |
| `endorsements.ts` | [Chapter 8](08-endorsements.md) |
| `flags.ts` | **Flags** and moderation hooks |
| `mediations.ts` | **Mediation** records |
| `governance.ts` + `src/services/governance.ts` | **Tier 3** **proposals** and **voting** + **`governance` blocks` |
| `upload.ts` | **Media** to **S3/ disk** and **hashes** |
| `discover.ts` | **GET** `/discover/*` for **searchable** public-ish feeds |
| `nfts.ts` | **Provenance** / **NFT** **records** in the app DB |
| `nodes.ts` | **public** / **self** **profile** API (mounted at `/nodes`) |
| `notifications.ts` | in-app / email hooks (as implemented), `/notifications` |
| `src/services/moderation.ts` | cross-cutting **mod** support |
| `src/services/proxyConfirm.ts` | **7-day** **proxy** state machine |
| *Mount table* | `src/app.ts` mounts each router (e.g. `/auth`, `/spaces`, `/projects`, `/traces`, `/upload` at root `/` for `POST /upload`, `/vetos`, `/pivots`, `/references`, `/credits`, `/nfts`, `/forks`, `/archives`, `/mediations`, `/flags`, `/governance`, `/discover`, `/endorsements`, `/notifications`, `/nodes`) |

**Governance HTTP paths (prefix `/governance`):** `POST /governance/proposals`, `POST /governance/proposals/:id/vote`, `POST /governance/proposals/:id/close`, `GET /governance/proposals/:id` — see `src/routes/governance.ts`.  

> **Grep** `addBlock` in `src` for the **current** list of call sites. Typical checkouts call it from: `auth`, `traces`, `projects`, `references`, `vetos`, `credits`, `archives`, `forks`, `pivots`, `mediations`, and `governance` (and possibly others as features grow).

## 4. **Data models** (`src/models/`)

**Implemented (Mongoose schemas in `src/models/`):**  
`Node.ts` (**ChainNode**), `Space.ts`, `Project.ts`, `Trace.ts`, `Block.ts`, `Media.ts`, `Veto.ts`, `Pivot.ts`, `Reference.ts`, `Flag.ts`, `Mediation.ts`, `ModerationPanel.ts`, `Endorsement.ts`, `Archive.ts`, `GovernanceProposal.ts`, `NFT.ts`, `Notification.ts`, `RecoveryRequest.ts`.

**Notable** **schema** **/ spec** **gaps (called out in `BACKEND-REVIEW.md` and the audit):**  
- **`Trace.ts`:** the `activityType` sub-schema in source had **nesting** that **diverged** from `ITrace` for `scopeLimited` / `contentFlagged` / `ndaSealed` — these fields are in the **TS interface** at **root**; **treat the interface + trace routes** as the **intended** shape until a migration fixes the schema.  
- **Immutability** of **REFERENCE** in spec vs **editing** in admin tools — a **governance** question.  
- **NDA** **decrypt** for **mediation** — **TBD** who in software may read the ciphertext.  
- **Exact** rep **decay** **schedule** in a **scheduler** job — `src/services/scheduler.ts` exists; confirm what **it** does today.  

## 5. **Frontend** — **M0** done, **M1+** in motion

- **`ROADMAP.md`** in the **repo root** is the **source of truth** for **which** **React** page exists vs **hash** `site.js` **legacy** (`public/js/site.js`).  
- **Auth** in React reuses the **same** **JWT** **keys** as legacy.  

## 6. **Planned** / **incomplete** relative to the long **spec**

| Topic | In spec (`BACKEND.md`)? | In code today? | Notes |
|-------|-------------------------|---------------|-------|
| **Non-financial** | Yes | **Policy** in docs + UI; **not** a token contract | Ongoing: **no** on-chain “coin” in **Express** **deploys** |
| **PoA → PoR** + **4**** **phases** | Yes (high level) | **No p2p** **network** | **Future** if you add a public **L2** or **Tendermint**-style service |
| **70%** governance votes for base contracts (spec) | Yes | `src/services/governance.ts` implements tally / quorum; compare constants to the spec | Re-read the file after governance changes |
| **Flag** L1–4 **automation** | Yes | `computeComplexityLevel` exists for **governance**; **flags** have `complexityLevel` **field** but **the** full **classifier** may be **partial** | Check `flags.ts` + `moderation.ts` |
| **Emergency** **CSAM** **workflows** | Yes (strict) | **Model** + **API**; **content** **removal** **paths** are **sensitive** — verify **S3/ disk** **delete** and **legal** runbooks in **code** and **ops** |  
| **Public** mainnet **Final NFT** | **Talked** in **product** copy | **`nfts.ts`** and **DB**; **on-chain** **mint** is **TBD** | Provenance can still be **app**-**level** for **MVP** |  

## 7. **How to** **keep** **this** **document** **fresh**

1. `rg "addBlock" src` after each **sprint** — new **block** **writers** = new **on-chain** **story**.  
2. `ls src/routes` — new **routers** = new **chapters** for **the** **docbook** **skeleton**.  
3. Compare **`BACKEND-REVIEW.md` → “Resolved”** table if you add one.  

## 8. **One-page** “**where** is **X**?”

| I want the code for… | Start here… |
|----------------------|-------------|
| **Chain** / **genesis** | `src/services/chain.ts` |
| **Traces** | `src/routes/traces.ts` + `src/models/Trace.ts` |
| **Spaces** | `src/routes/spaces.ts` + `src/models/Space.ts` |
| **Governance** | `src/routes/governance.ts` + `src/services/governance.ts` |
| **Flags** | `src/routes/flags.ts` + `src/models/Flag.ts` |
| **Mediation** | `src/routes/mediations.ts` + `src/models/Mediation.ts` |
| **Static** spec | [../BACKEND.md](../BACKEND.md) |
| **Gaps** | [../../BACKEND-REVIEW.md](../../BACKEND-REVIEW.md) |
| **UI** plan | [../../ROADMAP.md](../../ROADMAP.md) |

## Further reading

- [Full doc index](README.md)  
