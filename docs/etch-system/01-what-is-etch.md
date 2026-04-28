# Chapter 1 — What is Etch?

## Summary

**Etch** (implemented as the **aura2** project) is an *Art Process Documentation Chain* and decentralised application (dApp) backend. It exists to **document, attribute, and preserve** the artistic and creative process: who did what, when, with what evidence, and with what relationship to other work. The system is **trust-based** and **non-financial**—it is not a marketplace, token economy, or credit-scoring product tied to money.

## The problem Etch is built for

1. **Invisible labour** — Much of creative work (research, iteration, craft, support roles) is never visible next to a “finished” piece. That erodes fair attribution and makes precarious labour even harder to see.
2. **Plagiarism vs inspiration** — Communities need a clear, timestamped way to **declare** influences, materials, and lineage—not only after a dispute.
3. **Algorithmic precarity** — When visibility is platform-controlled, process and craft lose value in public ranking systems. A dedicated **process log** and **provenance** layer can re-centre the record of *how* work was made.
4. **Equitable attribution** — Technicians, mentors, and collaborators are often under-credited. The design encodes **roles**, **splits**, and **references** in a shared record.

## The solution: a verifiable, ordered process record

Etch’s core idea is simple:

- Creative work is organised in **projects** inside **shared spaces** (classes, studios, collectives).
- Contributors record **traces**—timestamped steps of work (research, making, review, use of tools including AI, etc.).
- The system keeps an **append-only, hash-linked record** of important events (see [Chapter 2](02-blockchain-basics.md)), so the **order and authorship** of the trail are hard to rewrite quietly.
- When a project closes, the **CREDIT** path fixes **attribution** and can mint a **provenance certificate** (described in product copy as a non-financial “NFT on the Etch chain”) with linked **soulbound** contribution signals—see [Chapter 7](07-contracts.md).

## Why “non-financial” is a first-class design choice

- The purpose is **documentation and credit**, not investment, yield, or gaming for tokens.
- **No monetary token** and no payment protocol are part of the base layer; spaces must declare **no financial linking** to the chain (see [Chapter 5](05-spaces.md)).
- “NFTs” in this system mean **provenance and attribution**—not speculative assets. Transfer rules are described in the spec so that **credit and provenance survive** a transfer of a display/ownership object where applicable.

## Why a “chain” at all?

You do not need to care about blockchains to use Etch—but the system uses **chain-like properties** (immutability, hash linkage, public ordering of events) to support **integrity of the record**. That is explained in [Chapter 2](02-blockchain-basics.md). In the current implementation, the chain is **simulated in the database** (see [Chapter 13](13-implemented-vs-planned.md) for the split between “designed for decentralisation” and “what is deployed today”).

## Where to read next

- New vocabulary: [Chapter 3 — Glossary](03-glossary.md)
- Signing up and technical architecture: [Chapter 4](04-identity-auth-and-database.md)
- **Spaces and projects** (the main containers of work): [Chapters 5–6](05-spaces.md)
- **Contracts** (the named actions of the system): [Chapter 7](07-contracts.md)
