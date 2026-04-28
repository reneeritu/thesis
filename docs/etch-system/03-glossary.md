# Chapter 3 — Glossary (terms every new participant should know)

This chapter collects the vocabulary used across Etch / aura2. For behaviour rules, see the linked chapters.

## Identity and access

| Term | Meaning |
|------|--------|
| **Node** | Your identity on the network: an **alias** plus reputation, spaces, and history. It is **not** your legal name unless you chose an alias that matches it. |
| **Alias** | Your unique, **permanent** public handle. It cannot be changed after creation; credits, provenance, and history reference it **forever**. |
| **ChainNode** | The name of the user account model in code (`src/models/Node.ts`)—your stored identity record. |
| **Seed phrase** | A **12-word** secret generated at registration. The primary backup to regain access. **Never** store only in the cloud; keep offline. |
| **Password** | Used with your alias for day-to-day login. Can be changed if you have the **seed** or via **social recovery** (spec). |
| **JWT (JSON Web Token)** | A short-lived **session token** the API returns on login. The browser stores it (e.g. as `aura2_token`) and sends it on each request. |
| **BCrypt (hashed password)** | The server stores a **one-way hash** of your password, not the plain text. |
| **Trustees** | 3–5 **other nodes** you can list for **social recovery** (per spec; cap in code: see `chainDefaults` / `Node` model). They help prove you are the same person without collecting legal ID. |
| **Social recovery** | A recovery path where trustees confirm a reset, often with a **time lock** (e.g. 72h) so the real owner can block a fraudulent reset (spec: `docs/BACKEND.md`). |

## Chain, integrity, and media

| Term | Meaning |
|------|--------|
| **Block** | A single **append-only** record in the system’s event log, containing type, time, `alias`, payload `data`, and **hash** linkage to the previous block. |
| **Hash** | A fixed-length “fingerprint” of data. If a file or text changes, the hash should change, exposing tampering. |
| **Hash-linked chain** | Each block points to the previous block’s hash; altering old history should break the chain. |
| **Database (MongoDB)** | Stores **rich** content: media, long text, some encrypted payloads. Tied to the chain by **ids** and **hashes** (per design). |
| **Media** | An uploaded file (image, video, etc.) with metadata; often linked to a **trace** and stored with a **content hash** for proof. |
| **Off-chain** | Data not stored in the block payload—still bound by a **hash on the chain** for verification. |
| **On-chain** | Data or pointers recorded in a **Block** in the append-only log (implementation: Mongo `Block` collection). |

## Organising work

| Term | Meaning |
|------|--------|
| **Space** | A **shared context**: studio, class, research group. Has its own **members, admins, rules**, and list of **projects**. Cannot **weaken** chain-wide (meta) rules. |
| **Project** | A **single** artwork, build, or research thread in a **space**—the container for **traces** and eventually **CREDIT** / provenance. |
| **Trace** | One **timestamped** unit of work on a project: an activity type, optional description, optional **media** proof, optional **tools/AI** declaration. The main **documentation** act. |
| **Contributor** | A **node** listed on a project with a **role** and primary / invited state. **Only contributors** (per API rules) can create traces for that project. |
| **Activity type** | A preset category for a trace, e.g. `brainstorm`, `primary_research`, `fabrication`, `ai_tool`, `other`. See [Chapter 7](07-contracts.md). |
| **Log mode** | How detailed the trace is: e.g. `micro`, `memo`, `reflection`, `proxy` (see `src/models/Trace.ts`). |
| **Proxy log** | A trace submitted **on behalf of** another alias. The spec requires **PROXY** marking on chain, **7 days** to confirm or dispute, **silence = confirm** (see [Chapter 12](12-system-flows.md)). |
| **Reference** | A **lineage** declaration (inspiration, fork, response to, AI, …)—intended to be **immutable** after posting (see [Chapter 7](07-contracts.md)). |
| **Fork (project fork)** | A new project **branched** from a parent, keeping **permanent** lineage. Reputation in the new fork is **earned in the new project** (per spec). |
| **Archive (retro project)** | A project meant to **reconstruct the past** with evidence, dates, and attestation. Lower base reputation than live work (per spec). |

## Contracts and provenance (non-financial)

| Term | Meaning |
|------|--------|
| **Contract (Etch sense)** | A **named, typed action** the system records to the log (e.g. START, TRACE, CREDIT), **not** necessarily a self-executing Ethereum contract. It is a **word of law** in the *protocol*—behaviour in code and moderation enforces it. |
| **START** | Opens a project. |
| **TRACE** | Logs a unit of work. |
| **VETO** / **PIVOT** / **CREDIT** / **REFERENCE** / **FORK** / **ARCHIVE** / **CUSTOM** | Other base contract *types* in the spec; see [Chapter 7](07-contracts.md). |
| **Provenance certificate / Final NFT (product language)** | The **end artefact** when a project closes: proves **who made what, when, with what evidence**—treated in copy as a **non-financial** “NFT on the Etch chain.” **Transfer of the display NFT** and **soulbound** credit tokens are described separately in the spec. |
| **Soulbound** | A token (or link) that **stays** with a node and is **not** transfer-traded. Contributor / process items are not meant to be sold like speculating assets. |
| **Veto** | A formal **stop**, **scope limit**, **content flag**, or **NDA seal** (see [Chapter 7](07-contracts.md)). NDA: hash public, content encrypted, **not** readable by space admins. |

## Social proof and quality signals

| Term | Meaning |
|------|--------|
| **Endorsement** | A **peer** signs a **trace** with a kind, e.g. *verified presence, co-authored, mentored, reviewed*—see [Chapter 8](08-endorsements.md). |
| **Attestation (archive context)** | Self / peer / institution statement about a **past** or reconstruction project (separate from trace endorsements). |
| **Reputation** | A **100–1000** aggregate score in the data model, plus **category buckets**; **public display** is often a **radar** shape, not a number. |
| **Badge** | Optional **affirmative** mark (e.g. for craft) that **does not** inflate the numeric score (per spec). |

## Governance and safety

| Term | Meaning |
|------|--------|
| **Flag** | A **formal report** that starts review: emergency, content, attribution, governance, or dispute. See [Chapter 11](11-moderation-and-flags.md). |
| **Mediation** | Structured path for **credit** and other disputes, escalating peer → space → chain → full moderation. See [Chapter 12](12-system-flows.md). |
| **Governance proposal** | A **protocol-level** change (Tier 3) with discussion and voting (see [Chapter 10](10-governance.md) and `src/routes/governance.ts`). |
| **Panel / Moderators** | A drawn group that reviews a case, with rules for **independence**, **exclusion requests**, and **anonymity levels** (spec in `docs/BACKEND.md`). |
| **Slashing (reputation sense)** | Penalising a node’s **reputation** for provable **bad-faith** moderation, etc.—not a financial slash of tokens. |
| **Meta / protocol** | The **highest** rules the whole network follows; **spaces cannot override** them. |

## How to use this doc set

- **Practical “how to log in and what things mean”** → [Chapter 4](04-identity-auth-and-database.md)  
- **Where work lives (spaces, projects)** → [Chapters 5–6](05-spaces.md)  
- **What each *contract* does and how a user *uses* it** → [Chapter 7](07-contracts.md)
