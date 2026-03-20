# BACKEND Review — Art Process Documentation Chain & dApp

This document is a full review of the backend and chain specification.  
**Spec reference:** [docs/BACKEND.md](docs/BACKEND.md)

---

## 1. Summary

The system is a custom blockchain and decentralised application (dApp) for documenting, attributing, and preserving the artistic process. It is trust-based and explicitly non-financial. Key goals are making invisible labour visible, distinguishing plagiarism from inspiration, reducing algorithmic precarity, and building equitable attribution across artists, designers, craftspeople, and technicians. The chain launches under Proof of Authority and is designed to transition to Proof of Reputation as the community grows, with governance at space, cross-space, and protocol levels.

---

## 2. Loopholes and Risks

Each item states where it comes from in the spec and the main risk.

- **Proxy log: silence = confirmation after 7 days**  
  **Where:** Documentation Modes → Proxy Log Rules.  
  **Risk:** A node that is inactive (e.g. vacation, illness) may miss the 7-day window; the proxy log auto-confirms and cannot be undone. No extension or “unavailable” appeal is specified.

- **Social recovery: “majority confirm” undefined**  
  **Where:** Account Recovery — “node pre-selects 3-5 trusted nodes … majority confirm identity to approve a reset”.  
  **Risk:** Unclear whether “majority” means 2 of 3, 3 of 5, or something else. With 3 of 5, two trustees could collude with the requester. The 72-hour time lock and original-node block help but do not define the threshold.

- **REFERENCE immutable: no correction or dispute path**  
  **Where:** Base Contracts → REFERENCE — “Cannot be edited or removed after deployment”.  
  **Risk:** Typos, wrong URL, or wrong relationship type cannot be fixed. Bad-faith or mistaken references are permanent; no formal correction or dispute flow is specified.

- **Custom contract: “all affected parties” vague**  
  **Where:** Base Contracts → CUSTOM CONTRACT — “Must be reviewed and signed by all affected parties”; space-level “supermajority of space members must sign”.  
  **Risk:** Who counts as “affected” is undefined. For space-wide contracts, inactive members may block deployment or supermajority may be undefined (e.g. of whom — all ever joined, or currently active?).

- **One person = one node not technically enforced**  
  **Where:** Identity & Accounts → Multiple Accounts.  
  **Risk:** Spec states the rule is “violation if discovered” and relies on low base reputation and social graph. Determined actors can still run multiple accounts; detection is social/heuristic, not hard constraint.

- **CREDIT mediation: strategic non-response**  
  **Where:** Mediate Flow; CREDIT co-ownership — “If mediation fails, equal split enforced + DISPUTED flag”.  
  **Risk:** A party who prefers equal split can avoid engaging so that mediation “fails” and equal split is applied by default. No explicit treatment of non-response (e.g. time-bound default).

- **VETO: single preassigned authority can hard stop**  
  **Where:** Base Contracts → VETO — “Hard stop requires majority sign-off OR preassigned veto authority (e.g. teacher)”.  
  **Risk:** One preassigned authority can unilaterally hard stop. Abuse is only addressable after the fact via moderation, not constrained by design.

- **Moderator selection: first to accept**  
  **Where:** Moderation System → Moderator Selection — “First to accept becomes panel member, up to required number”.  
  **Risk:** Coordinated or motivated parties could rush to accept and skew panel composition, despite random selection and reputation weighting.

- **Request volume: no global cap per sender**  
  **Where:** Profiles & Social Layer → Outreach & Collaboration Requests — “Maximum 3 unanswered requests to same node at any time”.  
  **Risk:** Limit is per recipient only. A harasser can send up to 3 unanswered requests to many nodes. Harassment reporting exists but volume loophole remains.

- **Archive: reconstruction and date self-reported**  
  **Where:** Base Contracts → ARCHIVE — “Approximate date of making”, “Reconstruction flag (self-reported)”.  
  **Risk:** No verification that work existed at the claimed time. Lower reputation weight and cross-attestation mitigate but do not remove incentive to inflate with weak or fake archives.

- **Undeclared off-chain collaborators: permission TBD**  
  **Where:** TBD list — “whether permission is needed just to list a name as unclaimed credit (deferred)”.  
  **Risk:** Until decided, listing someone as unclaimed credit without permission is not clearly permitted or forbidden; could enable misattribution or surprise listing.

- **Protocol fork: mechanics undefined**  
  **Where:** Transition Rules / Tier 3 — “Losing minority can always fork the protocol”.  
  **Risk:** How the fork is executed (who runs nodes, how chain splits, how data is copied) is unspecified; could lead to confusion or deadlock when invoked.

- **NDA-sealed content: who can decrypt for disputes**  
  **Where:** VETO (NDA seal); Data & Privacy — “NDA sealed content remains encrypted — no one including space admins can access it”.  
  **Risk:** Unclear whether protocol panel or moderators can ever access decrypted content for attribution or dispute resolution. If never, some disputes may be unresolvable; if sometimes, the rule needs to say when and how.

- **False emergency flag: “severe” penalty undefined**  
  **Where:** Content & Safety → Non-Consensual Intimate Imagery — “flagging node receives severe reputation penalty”.  
  **Risk:** “Severe” is not defined (points, floor, or removal). Inconsistent or weak enforcement could encourage false flags or discourage legitimate ones.

- **Validator influence beyond direct moderation**  
  **Where:** Moderation — “Validators excluded from moderating any dispute they are party to”.  
  **Risk:** Validators could still try to influence outcomes via non-validator panel members (e.g. off-chain contact). No explicit rule against validator contact with panel in their cases.

- **Free-text keywords: search gaming**  
  **Where:** Search & Discovery — “Optional free text keywords on profile: visible but NOT searchable algorithmically, only appears in direct text search”.  
  **Risk:** Long or manipulative keyword lists could game direct text search; only algorithmic search is restricted.

- **Dormant space fork: same members, new space**  
  **Where:** Dormant Spaces — “An admin may fork a new space from a dormant one”.  
  **Risk:** After dormancy (e.g. for repeated disruption), an admin could fork, invite the same members back, and effectively continue; lineage is visible but the “fresh start” may soften consequences.

---

## 3. Ambiguities

Terms or rules that are underspecified and could be interpreted in more than one way:

- **“Active” node**  
  Used for phase triggers (e.g. “0–50 active nodes”, “50 active nodes”) and recovery (“if they are active”). Not defined: does one trace per month count? Does logging in count? Affects transition timing and recovery blocking.

- **“Majority” in social recovery**  
  Whether it is simple majority of trustees (e.g. 2 of 3) or a higher bar (e.g. 3 of 5) is not stated. Affects collusion resistance.

- **“Affected parties” for custom contracts**  
  No definition. For space-level contracts, “all space members” vs “members affected by the contract” vs “active members” is unclear; affects who must sign and whether inactive members block.

- **“Supermajority of space members”**  
  Whether this is of all-ever members, current members, or “active” members, and how inactivity is treated, is not defined.

- **Decay “after 3 months grace”**  
  What counts as activity that resets or pauses the grace period (e.g. any trace, any login, project completion) is not specified. Affects fairness for occasional contributors.

- **“Severe” reputation penalty**  
  Used for false NCII flagging and for “severe proven bad faith” in slashing. No numeric or procedural definition.

- **“Reputation impact exceeds a defined threshold”**  
  Used in auto-classification of dispute level. The threshold is not defined; classification could be inconsistent or gameable once the formula exists.

- **Who can decrypt NDA-sealed content**  
  Spec says space admins cannot access it and data remains encrypted. Whether protocol panel or moderators can access it for specific dispute types is not stated.

- **“Genuinely unreachable” (recovery)**  
  Criteria for unreachability (e.g. no login for X days, no response to notification) are not specified. Affects when recovery can proceed.

---

## 4. TBD Items (from the spec)

The spec explicitly lists these as not yet decided. This list is for tracking only; no resolution is assumed.

- [ ] Frontend framework (React / Next.js / other)
- [ ] Preset list of art/design fields for search
- [ ] Exact reputation score formula (weighting of each source)
- [ ] Exact threshold at which reputation impact triggers complexity level
- [ ] Undeclared off-chain collaborators in CREDIT — whether permission is needed just to list a name as unclaimed credit (deferred)
- [ ] Attestation farming mitigation strategy (deferred)
- [ ] Emergency flag abuse penalty specifics (deferred)
- [ ] Exact tool/software preset list
- [ ] Dashboard UI layout and contents
- [ ] Precise decay curve (flat -5/month confirmed, curve shape TBD)
- [ ] Project abandonment / deletion flow — spec does not define how a creator can abandon or delete an active project. Currently the only exits from "active" are halted (VETO), completed (CREDIT), or disputed (CREDIT). Needs design decision before implementation.

---

## 5. Recommendations

Short, actionable clarifications or changes that would address the main loopholes and ambiguities above. No implementation detail is assumed.

- **Define “active” node**  
  Specify what action(s) count as activity for phase triggers and for recovery (e.g. any chain interaction in last N days, or any trace in last M days). State whether grace period for decay resets on activity or is fixed from account creation.

- **Specify social recovery threshold**  
  Define “majority” for 3–5 trustees (e.g. “at least 3 of 5” or “strict majority of selected trustees”). Consider requiring more than simple majority for recovery (e.g. supermajority) to reduce collusion risk.

- **REFERENCE: add correction or dispute path**  
  Allow a defined way to correct obvious errors (e.g. wrong URL) or to dispute a reference (e.g. “not inspired by X”), with outcome logged on chain and without allowing removal of accurate references. Keep immutability for the original record plus amendment trail.

- **Clarify “affected parties” and supermajority for custom contracts**  
  Define who “affected parties” are (e.g. all space members, or members whose permissions the contract changes). For space-wide contracts, define the denominator for supermajority (e.g. “members who have logged in or voted in the last 90 days”) and how inactive members are treated (count as no, or exclude from denominator).

- **CREDIT/Mediate: define non-response**  
  Specify a time limit after which non-response is treated as “mediation failed” (or as “accept equal split”), and make it explicit in the Mediate flow so strategic non-response is a known outcome, not an ambiguity.

- **NDA-sealed content and disputes**  
  State whether protocol panel or moderators can ever access decrypted NDA content (e.g. only for specific dispute types, with strict access log). If never, state that some disputes involving NDA content may be unresolved by design.

- **Define “severe” penalty**  
  For false emergency flags and for severe moderator bad faith, specify either a reputation point range, a minimum floor, or “removal from chain” where applicable, so enforcement is consistent.

- **Recovery “unreachable”**  
  Define criteria (e.g. no login for 90 days, or no response to on-chain recovery notification within 72 hours) so implementers and users know when recovery can proceed.

- **Validator contact with panel**  
  Consider adding an explicit rule that validators who are party to a dispute must not contact or attempt to influence panel members for that case; violation could be treated as governance/misconduct.

- **Keep TBD list updated**  
  As decisions are made, move items out of the TBD section and into the main spec so the review and implementation stay aligned.

---

*Review generated from [docs/BACKEND.md](docs/BACKEND.md). No design choices beyond the spec are assumed.*
