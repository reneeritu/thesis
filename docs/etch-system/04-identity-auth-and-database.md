# Chapter 4 — Identity, authentication, and the database

This chapter explains **how a person becomes a node**, **how login works** in the shipped API, and **how MongoDB and the “chain”** relate.

## 1. Two storage layers (conceptual)

| Layer | Holds | Why |
|-------|--------|-----|
| **MongoDB (primary application DB)** | User accounts, spaces, projects, traces, media files metadata, many governance records | Query-friendly, full-text, rich documents, file refs |
| **Block collection (append-only log)** | One document per `Block` with `type`, `data`, `previousHash`, `hash`, `index` | Integrity-style ordering: **lightweight** records that are hard to “rewrite in place” without detection |

> **Tie them together:** a trace in `Trace` can store `blockIndex` and a **media hash**; a block can record an event like `trace` with ids and fields in `data`. If someone swaps a file in storage without updating the **hash** on the chain, verification fails.  
> (Exact field wiring is in server code—see [Chapter 13](13-implemented-vs-planned.md).)

## 2. Account creation (no email, no phone, no “real name” by default)

**Design intent** (`docs/BACKEND.md`):

1. Person chooses a unique **alias** (the public id).
2. Person sets a **password**.
3. The app generates a **12-word BIP-39–style** **seed phrase**.
4. The user **writes down** the seed and stores it safely **offline**.
5. The server stores a **bcrypt** hash of the password, a **hash of the seed** for checks, and an **encrypted copy** of the seed for **recovery** flows using `ENCRYPTION_KEY` from the environment.
6. An **`identity` block** is written on the append-only log when the account is created (see `src/routes/auth.ts` and `addBlock`).

**Alias rules (spec):** unique, **permanent**, chain-wide, referenced **forever** in credits. In code, aliases are **lower-cased** and length-limited via `src/config/defaults`.

## 3. How you log in (shipped flow)

1. **POST** `/auth/login` with body `{ "alias", "password" }` (Zod schema in `src/schemas/auth.ts`).
2. Server looks up the `ChainNode` by **alias**; **bcrypt**-compares the password.
3. On success, the API returns a **JWT** signed with `JWT_SECRET`, plus optional profile fields.
4. The client stores the token (e.g. `localStorage` key `aura2_token` in the React app) and sends:

   `Authorization: Bearer <token>`

5. The middleware `requireAuth` decodes the JWT and attaches the **node alias** to the request for downstream routes.

**Lost password / new device (seed path):** user proves knowledge of the **seed phrase** to set a new password; see `/auth/recover` in the API (and `register` flow that returns the seed at signup).

## 4. Social recovery and trustees (spec + model)

- You can set **trustees** (other aliases) in your profile. The **Mongoose** model caps the count (see `ChainNode` + `chainDefaults.socialRecoveryMaxTrustees`).
- The **72-hour time lock** and “original node can block a fraudulent reset” are specified in `docs/BACKEND.md`—treat the full procedure as part of the **governance and safety** story, with implementation details in `src/routes` and any recovery subsystems.

**If all paths fail** (no seed, no key file, social recovery impossible): the account is **irrecoverable** (spec)—no back-door reset.

## 5. The `ChainNode` document (key fields)

Defined in `src/models/Node.ts` (export name **`ChainNode`**):

| Field (concept) | Role |
|-----------------|------|
| `alias` | Primary key in human terms; public id |
| `hashedPassword` | Bcrypt of login password |
| `seedHash` / `encryptedSeedPhrase` | Seed handling / recovery |
| `tokenVersion` | Invalidate all JWTs on security reset (when bumped) |
| `trustees` | Social recovery list |
| `reputationScore` | Single headline number (recomputed on save from categories) |
| `reputationCategories` | `craft`, `research`, `collaboration`, `pedagogy`, `consistency`, `community` — six axes |
| `badges` | String tags for affirmative display |
| `spaces` | ObjectId refs to `Space` documents (may lag; membership on `Space` is canonical) |
| `status` | `active` / `removed` / `suspended` |
| `blockedNodes` | Aliases you do not want interaction with (spec + UI) |
| `identityBlockIndex` | Which `Block` index created this identity anchor |

> **Pre-save hook:** when `reputationCategories` update, a helper recomputes `reputationScore` (`reputationScoreFromCategories` in `src/utils/reputationAggregate.ts`).

## 6. Blocked, removed, and suspended (behavioural summary)

- **Removed node (spec):** public profile can go **dark**; the **alias** still appears on all historical credits, provenance, and NFTs—history is not rewritten.
- **Suspended (model):** server routes often require `status === 'active'` to act—see e.g. governance voting checks.

## 7. “How is the database connected?”

- The Node.js process reads **`MONGODB_URI`** from the environment and connects on startup (see server bootstrap, often `src/server` or `src/config`).
- The **client** (browser) **does not** connect to MongoDB. It only talks to the **HTTP API** on the same host or deployed URL.
- **CORS and cookies/tokens** are part of deploy configuration (`docs/DEPLOY_RENDER_ATLAS.md` for one hosting story).

## Further reading

- [Chapter 5 — Spaces](05-spaces.md) — who can form a space, rules  
- [Chapter 6 — Projects](06-projects.md) — who can create a project  
- [Chapter 13](13-implemented-vs-planned.md) — which auth and recovery sub-flows are fully implemented vs spec-only
