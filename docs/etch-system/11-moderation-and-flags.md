# Chapter 11 — Moderation, flags, and appeals

**Moderation** in Etch is a **formal, logged** system—not ad-hoc chat moderation only. A **flag** is the **on-ramp** to review; **escalation** and **independence of moderators** are first-class. **No financial** penalties are implied: **reputation** may be **reduced (slashed)**; **bans** are for **abuse** classes and must follow the **stated** **chain / space** **rulebook** (`docs/BACKEND.md`).

> **Data model:** `src/models/Flag.ts`, `MEDIATION_*` in `src/models/Mediation.ts`, and routes: `src/routes/flags.ts`, `src/routes/mediations.ts`, and `src/services/moderation.ts`.

## Flag high-level **flow (spec)**

`flag → **panel** assigned → **ruling** under time lock → optional **appeal** → (maybe) **higher** panel → `DISPUTED-CLOSED` on chain in worst cases.  

**Slashing (spec):** a **separate** **panel** that **excludes** the **original** moderators can cut **reputation** of provably **bad-faith** moderators or repeat **false** emergency flags.

## Flag **categories** and **types**

`FLAG_CATEGORIES` in `src/models/Flag.ts`:

| Category | Types (`FLAG_TYPES`) | Meaning |
|----------|----------------------|---------|
| `emergency` | `csam`, `non_consensual_imagery` | **Auto-triage, immediate safety**; special handling, often **no** content appeal. |
| `content` | `hate_speech`, `harassment`, `impersonation`, `doxxing`, `illegal_content`, `misinformation`, `spam`, `nudity` | Standard process; **nudity** can be **space**-scoped. |
| `attribution` | `plagiarism`, `false_credit`, `undeclared_ai`, `missing_lineage` | **Provenance and credit** integrity. |
| `governance` | `space_misconduct`, `moderator_bad_faith`, `contract_violation`, `false_flagging` | **Abuse of roles and rules** (including frivolous flags). |
| `dispute` | `credit_dispute`, `veto_dispute`, `space_ban_dispute`, `classification_appeal` | Tied to **mediation** / governance when appropriate. |

**What can you flag?** `FLAG_TARGET_TYPES`: `node`, `trace`, `project`, `space`, `nft`, `contract`, `media`.

`CATEGORY_TO_TYPES` in the model enforces that each **category** only uses **valid** `flagType` values in application logic.

**Other fields of each flag:** `raisedBy` alias, `spaceId` (optional), `isInsideMember` (member flags = **higher** urgency, per `BACKEND.md`), `complexityLevel` 1–4, `status` (`open` → … → `ruled` / `appealed` / `disputed_closed`), optional `mediationId`, `reason` (≤2000 chars), `blockIndex` on the chain, `emergencyActionTaken`, and `appealCount`.

**Emergency handling (summary from spec):**  
- **CSAM:** user-facing **permanent** removal, **suspension**; appeal only on **suspension**, *not* on keeping the file.  
- **NCII:** user-facing **removal**; **encrypted** copy for a **24h** emergency **panel**; on confirm → remove + **suspend**; on false flag, **strong** rep penalty to flagger (penalty TBD in spec).

## Complexity **levels** and **time locks (spec table)**

| Level | Situation (spec) | Time lock to discuss + decide | # Moderators (spec) |
|-------|------------------|-----------------------------|--------------------|
| **1** | Single person / one trace, simple content | **48 h** | **3** |
| **2** | Multi-party, **attribution**, **space** conflict | **7 d** | **5** |
| **3** | **Cross-space**, or **Final NFT** involved, large group | **14 d** | **7** |
| **4** | **Base contract** / **meta** challenge | **30 d** | **All** active **protocol** panel (spec) |

**Auto-classify (spec) from:** number of implicated **nodes**, **cross-space?**, is a **Final NFT** minted?, **reputation** impact over a **threshold** (the threshold value is TBD in `BACKEND.md` and `BACKEND-REVIEW.md`).

A party may **appeal the classification** (not the ruling) if the auto-class is wrong (spec).

## **Moderator** selection and **independence (spec sketch)**

- **Weight** randomness by **reputation** but with **diversity** from **relevant** spaces.  
- **First** to **accept** an invite fills the panel up to the **count** (watch for gaming—`BACKEND-REVIEW` comments).  
- **Category** scores pick **domain** expertise (e.g. pedagogy moderators in pedagogy issues).  
- **No self-selection** of your friend as moderator.  
- **Exclusion request:** one per **party** with a **stated** reason, voted by the **panel** for validity.  
- **Conflict:** **cannot** be a **validator** in a case you are in (spec) — see audit for “off-panel influence.”

**Anonymity (spec) by level (summary):**  
- **L1–2:** moderators know the parties, parties not moderators.  
- **L3:** **both** anonymous to each other **until the ruling**; then moderators may be **revealed** (or per rules).  
- **L4:** **fully** **public** process—unless **all** parties **opt in** to a stricter private mode.  

## **Appeals (spec, sequence)**

1. **First** ruling.  
2. **7** days to **appeal** → **higher** level, **new** **moderators** (not the old ones).  
3. **Second** ruling.  
4. **Final** appeal within **7** days, only with **new** **evidence** → **Protocol** **panel** → **binding**.  
5. **Max** **two** **appeal** **rounds**; if still not resolved, some cases are marked **`DISPUTED-CLOSED`** **permanently** on the chain, or the queue priority drops (as per the long text in `BACKEND.md`).

> **Code:** `src/models/Flag.ts` has `status` and `appealCount`; the **full** multi-step process may still be a **combination of spec** + **partial** service code—check [Chapter 13](13-implemented-vs-planned.md).  

## **Mediation** and flags that become **MEDIATE** flows

`MEDIATION_TRIGGER_TYPES` in `src/models/Mediation.ts`: `credit_dispute`, `veto_dispute`, `space_ban_dispute`, `classification_appeal` — a **mediation** record links a **project**, `spaceId`, `triggerType`, `parties[]`, and **proposals** with optional **weight** maps for credit splits, plus deadlines (`peerDeadline`, `spaceDeadline`), `blockIndex`, and a possible `revisedAgreement`.

See the **7-step** credit mediation narrative in [Chapter 12](12-system-flows.md).

## Further reading

- `docs/BACKEND.md` — the **source of truth** for edge cases, CSAM, NDA **decrypt** questions (TBD)  
- `BACKEND-REVIEW.md` — all **gaps** and **recommendations** (NDA, “majority,” **REFERENCE** **immutability**, etc.)  
- [Chapter 10 — Governance](10-governance.md)  
- [Chapter 12 — Flow charts](12-system-flows.md)  
