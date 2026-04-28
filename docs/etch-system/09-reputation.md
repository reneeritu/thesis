# Chapter 9 — Reputation

Reputation is a **soft power** and **governance** signal: who has **verifiably** contributed over time, in **which** kinds of work, and with what **independence** of attestations. It is **not** a “credit score for loans” and **not** a financial asset.

> **Code anchor:** `ChainNode` in `src/models/Node.ts` stores `reputationScore` and six **category** numbers; a **pre-save** hook re-aggregates the headline from categories via `reputationScoreFromCategories` in `src/utils/reputationAggregate.ts`.  

## Headline number (100–1000) — *spec* vs *code*

`docs/BACKEND.md` defines a **tunable** public policy:

- **Base** (new node): **100**  
- **Cap:** **1000**  
- **Floor:** **50** (you never go to zero in spec)  
- **Decay:** **−5** per month after **3 months** grace (exact clock and resets are **TBD**—see `BACKEND-REVIEW.md`).

The application **enforces** caps/floors that exist in `src/config/defaults` (`reputationCap`, `reputationFloor`, `reputationBaseScore`).

> **What moves the number** (spec, high level): **traces** (frequent, lower per-event weight), **completed** projects, **cross-space** collaboration, and **independent** peer **attestations** (higher when *not* from the same clique of collaborators).  

**Public display (spec):** a **radar** over six categories—**no public raw number**; only the **node** can see a precise value in a **private dashboard** (if/when the UI implements it that way).

## The six **category** axes (radar)

From `IReputationCategories` in `Node.ts`:

| Axis | Stands for (spec) |
|------|-------------------|
| `craft` | **Skill and execution** in documented making. |
| `research` | **Inquiry, reading, and sourcing** and brainstorm-style ideation. |
| `collaboration` | **Joint** projects, cross-space work, reliability. |
| `pedagogy` | **Teaching, mentoring, curriculum**, explanation. |
| `consistency` | **Regularity** and sustained logging over time. |
| `community` | **Attestations** given/received, **cross-space** health. |

**Category scores (spec) also matter for:** selecting **domain moderators** (e.g. a pedagogy dispute can prefer high-pedagogy moderators) *without* changing **voting** weight. **Voting** weight in governance uses the **headline** score only.

## **Affirmative badges** (not score inflation)

The spec: traces of `skillwork`, `fabrication`, and **tech** work earn a **visible** badge on the profile, **not** a numeric **boost**—so craft recognition does not become a grind game.

> Implementation: the `ChainNode` model has a `badges: string[]` field; the exact badge strings and triggers live in the server logic and should be read from code when you document **exact** conditions.

## **Archive** weight (reconstruction / past work)

**ARCHIVE** projects (see [Chapter 7](07-contracts.md)) carry **less** default reputation than a live, well-traced project. **Self-only** attestation is the **lowest** trust case; you need **cross**-attestation to move the needle in a **meaningful** way.

## Fairness and gaming (design intent + known gaps)

- **One person, one node** (rule) — hard to *technically* enforce, but rep **abuse** is a **chain-level** ban class in the spec.  
- **Proxy logs** and **false endorsements** are flagged in `BACKEND-REVIEW.md` as things that need clear enforcement math.  
- **Decay** is meant to let long-absent old accounts slowly lose influence without a sudden cliff.

## Further reading

- [Chapter 3 — Glossary: reputation](03-glossary.md)  
- [Chapter 7 — REFERENCE, TRACE, ARCHIVE](07-contracts.md)  
- [Chapter 10 — Governance: voting](10-governance.md) and validator independence  
- [Chapter 11 — Slashing and bad-faith](11-moderation-and-flags.md)  
