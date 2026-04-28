# Chapter 2 — Blockchain basics (for a non-technical reader)

## What is a blockchain?

A **blockchain** is a **list of records (“blocks”)** that only grows in one direction: you **append** new blocks; you do not go back and “edit” old ones in normal operation.

Each block usually contains:

- **When** something happened (a timestamp)
- **What** happened (a payload or reference to it)
- A **fingerprint of the previous block**—often called **previous hash**
- A **fingerprint of this block**—its own **hash**

The fingerprint (hash) is a short string computed from the block’s contents. If you change **any** part of the past, the hash **no longer matches**, and the **chain of hashes breaks** after that point. That makes **silent tampering** with old history **detectable** in systems designed around this model.

> **Etch in one sentence:** it uses a **blockchain-style append-only, hash-linked log** to anchor **order and integrity** of important events, while heavy media and narrative text live in a database.

## What a block contains in Etch (implementation)

In the aura2 codebase, each on-chain event is modelled in something like a **`Block` document** with:

- `index` — position in the chain
- `timestamp` — when the event was written
- `alias` — which **node** (identity) created the block
- `type` — the kind of event (e.g. `identity`, `start`, `trace`, `governance`, …)
- `data` — structured payload (varies by type)
- `previousHash` and `hash` — link this block to the one before and seal this one

The exact enum of types is defined in the server model `src/models/Block.ts` (e.g. `genesis`, `identity`, `start`, `trace`, `veto`, `pivot`, `credit`, `reference`, `fork`, `archive`, `mediation`, `flag`, `governance`).

## Why use a “Web3 / chain” *idea* if this is not a trading app?

Most public talk about “web3” focuses on **tokens and finance**. Etch is different:

| Goal | How the chain *idea* helps |
|------|----------------------------|
| **Immutability** | Event records, once written in the append-only log, are not meant to be silently rewritten. |
| **Verifiability** | **Hashes** of files can be stored; if someone swaps a file, the hash no longer matches. |
| **Order and authorship** | The log records **which alias** did **which action** in **what sequence**. |
| **Future decentralisation** | The *design* aims for a community-run protocol with transparent votes and validator evolution (see [Chapter 10](10-governance.md)). |

**Provenance, not payment:** the chain is about **who did what, with what evidence**—not *who should profit* from a token price.

## Proof of Authority (PoA) → Proof of Reputation (PoR)

**Consensus** = “who is allowed to decide the next block / validate the network.”

The high-level *plan* in `docs/BACKEND.md` is:

- **At launch: Proof of Authority (PoA)** — a small set of trusted **validators** (e.g. founders) keeps the network consistent.
- **Over time: Proof of Reputation (PoR)** — the community of nodes with established reputation **takes on validation**; **founder authority is phased out** in stages.

**Phases (spec-level summary):**

| Phase | Trigger (spec) | What changes |
|-------|----------------|--------------|
| 1 — Founder | Launch, early growth | PoA: founders + limited validators |
| 2 — Early community | e.g. ~50 active nodes **or** community vote | Reputation nodes join as validators (e.g. top 10) |
| 3 — Distributed | e.g. ~200 active nodes **or** vote | Full PoR; founders step back as validators |
| 4 — Autonomous | Community vote | Fully community-run |

**Transition supermajority:** phase moves often require a **70%+** vote (per spec).

> **Reality check:** the **Node.js + MongoDB** deployment today is a **simulated chain** in the application database. True distributed consensus on a public network is a **separate engineering step**—see [Chapter 13](13-implemented-vs-planned.md).

## Etch’s chain vs a public blockchain (e.g. Ethereum)

| | Etch (current product direction) | Typical public L1 |
|---|----------------|---------------------|
| **Where data lives** | Your server / MongoDB in practice | Thousands of nodes worldwide |
| **Cost to write** | No “gas” in the dApp as shipped | User pays network fees |
| **Wallet** | App login (JWT) + seed recovery | Externally owned account / contract wallet |
| **Speculative trading** | Explicitly not the goal | Often present |
| **Immutability style** | Append-only *logical* log + hashes | Cryptographic chain on network |

The **concepts** (hash, append-only, provenance) align with what people call “on-chain” thinking. The **deployment model** in this repository is a **dApp + simulated chain** until a separate deployment hardens decentralisation.

## Further reading

- Glossary: [Chapter 3](03-glossary.md)
- How login and the DB connect: [Chapter 4](04-identity-auth-and-database.md)
- Governance and validators: [Chapter 10](10-governance.md)
- What is actually implemented: [Chapter 13](13-implemented-vs-planned.md)
