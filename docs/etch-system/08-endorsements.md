# Chapter 8 — Endorsements

**Endorsements** are a **lightweight, peer-given** signal on a **specific trace**—not a like-count and not a financial reward. They answer: *“Did someone else in the community actually witness, co-produce, teach, or formally review this step?”*

## Why endorsements exist

- **Traces** are mostly self-logged. Endorsements add **independent** credibility when a peer is willing to co-sign a **type** of relationship to that one log.
- They support **governance and attribution** (see **false credit** flags in [Chapter 11](11-moderation-and-flags.md)) and **reputation** inputs over time (see [Chapter 9](09-reputation.md)).

## Kinds of endorsement

Defined in `src/models/Endorsement.ts` as `ENDORSEMENT_KINDS`:

| Kind | When to use (plain language) |
|------|-----------------------------|
| `verified_presence` | “I was **there** for this work session / location / review moment.” |
| `co_authored` | “I **co-made** or materially co-wrote this step.” |
| `mentored` | “I was **mentoring** the author during this step.” |
| `reviewed` | “I **formally critiqued** or assessed this step (e.g. crit, code review, assessment).” |

## Uniqueness rules (model)

- **One endorsement per (trace, endorser, kind)**—compound index in the schema. You cannot stack duplicate “co-authored” from the same person to the same trace.  
- **Note** (optional) — up to **500** characters, per schema `maxlength`.

## Who can create an endorsement?

- The **endorser** must be a **valid node** (enforced in `src/routes/endorsements.ts` in practice) and the trace/project must be accessible under your auth rules.  
- You **do not** endorse your own work as “peer proof” in good faith; product norms should discourage self-endorsement even if the API must eventually guard it in code.

## How a user creates one (user journey)

1. Open a project’s **trace** you have permission to view.  
2. Choose “Endorse” and the **kind** (presence / co-authored / …).  
3. Add an optional one-line **note** (e.g. “in the studio, March 2”).  
4. Save — a row is created in the `Endorsement` collection and the UI may show your alias + kind on that trace.  

(Exact HTTP path: see `src/routes/endorsements.ts` and the React app calling it.)

## Relationship to other concepts

- **Not** a **CONTRIBUTOR** record on the whole project: it is **tied to one trace** only. A pattern of co-authored endorsements *could* be used in a dispute to show shared labour, but the **CREDIT** step still fixes the legal-grade split (see [Chapter 7](07-contracts.md)).  
- **Not** a **proxy log**: a proxy is *someone else logging in your name*; an endorsement is *someone vouching for* a log that already exists.

## Further reading

- [Chapter 7 — TRACE](07-contracts.md)  
- [Chapter 9 — Reputation](09-reputation.md)  
- [Chapter 11 — False credit flags](11-moderation-and-flags.md)  
