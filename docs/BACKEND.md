# BACKEND.md — Art Process Documentation Chain & dApp

---

## What This Is

A custom blockchain and decentralised application (dApp) for documenting,
attributing, and preserving the artistic process. The system makes invisible
labour visible, addresses plagiarism vs inspiration, counters algorithmic
precarity, and builds equitable attribution across artists, designers,
craftspeople, and technicians. It is trust-based, non-financial, and
built from scratch.

---

## Tech Stack

### dApp Backend
- Runtime: Node.js
- Framework: Express.js
- Language: TypeScript
- Database: MongoDB
- ODM: Mongoose
- Validation: Zod
- Auth: JWT (JSON Web Tokens)
- File Upload: Multer
- Image Processing: Sharp
- Package Manager: npm / yarn / pnpm
- Environment Variables: dotenv
- Linting: ESLint
- Formatting: Prettier
- Testing: Jest / Vitest
- API Testing: Postman / Thunder Client

### Custom Chain
- Language: Node.js + TypeScript
- Consensus Mechanism: Proof of Authority (PoA) at launch, Proof of Reputation over time
- Frontend: TBD

---

## Block Structure

Each block on the chain contains:
- index (block number)
- timestamp
- alias (node identity)
- hashed password
- encrypted seed phrase
- previous block hash
- current block hash

---

## Consensus Mechanism & Validator Transition

The chain launches under Proof of Authority and transitions to Proof of
Reputation as the community grows. Designed as a complex adaptive system
where users gradually take over validation and the founders phase themselves out.

### Transition Phases

| Phase | Trigger | What Changes |
|---|---|---|
| Phase 1 — Founder | Launch, 0-50 active nodes | Founder + 1 validator run PoA |
| Phase 2 — Early Community | 50 active nodes OR community vote | Top 10 reputation nodes join as additional validators |
| Phase 3 — Distributed | 200 active nodes OR community vote | Full Proof of Reputation, founder validators step back |
| Phase 4 — Autonomous | Community vote only | Fully community run, no founder authority |

### Transition Rules
- Every phase transition requires supermajority vote (70%+) to execute
- A protocol-level vote can trigger transition earlier than the node threshold
- Losing minority can always fork the protocol — exit rights permanently preserved
- Validators are excluded from moderating any dispute they are party to
- Validator status is publicly visible on chain at all times

---

## Identity & Accounts

### Account Creation Flow
1. User chooses an alias
2. User sets a password
3. App generates a seed phrase (12 words)
4. User saves the seed phrase (written down or stored safely)
5. Account created — no email, no phone, no real name collected ever

### Login Flow
- Normal login: alias + password
- New device or lost password: seed phrase → reset password → back in

### Alias Rules
- Alias is unique across the entire chain
- Alias is permanent — cannot be changed after creation
- All credits, attributions, and attestations reference the original alias forever

### Account Recovery
- Primary: Social recovery — node pre-selects 3-5 trusted nodes on chain;
  majority confirm identity to approve a reset
- Backup: Recovery key file generated at signup and downloaded by the user
- Recovery request is time-locked for 72 hours — original node receives
  an on-chain notification and can block it if they are active
- Recovery only proceeds if the original node is genuinely unreachable
- If both seed phrase and recovery key file are lost and social recovery
  fails — account is permanently inaccessible, no exceptions
- No personal data used at any point in recovery

### Multiple Accounts
- One person = one node is the rule of the chain
- Rule violation if discovered even if technically difficult to enforce
- Low base reputation makes gaming less worthwhile
- Social recovery connections make duplicate accounts detectable
- Optional ID verification available for certain spaces

### Removed Nodes
- Node profile goes dark
- Alias stays on all credits, contributions, provenance, and NFTs exactly as is
- Work remains on chain — other people's NFTs and credits are unaffected

---

## Reputation System

### Scoring Parameters
| Parameter | Value | Reasoning |
|---|---|---|
| Base score (new node) | 100 points | Welcoming but not immediately influential |
| Cap | 1000 points | Prevents old nodes dominating forever |
| Decay rate | -5 points/month after 3 months grace | Slow enough not to punish breaks |
| Minimum floor | 50 points | No node ever fully excluded |

### Score Calculation Sources
- Trace logs (frequent, lower individual weight)
- Completed projects
- Cross-space collaborations
- Peer attestations (independent attestations from nodes you have not
  collaborated with directly carry more weight than attestations from
  direct collaborators)

### Reputation Categories
Categories exist for display and moderator selection only.
They do NOT affect overall voting weight.

| Category | Built From |
|---|---|
| Craft / Skill | Skillwork and fabrication traces |
| Research | Research and brainstorm traces |
| Collaboration | Multi-node projects and cross-space work |
| Pedagogy | Pedagogy traces and mentor contributions |
| Consistency | Regularity of logging over time |
| Community | Attestations given and received, cross-space activity |

### Voting Weight
- Uses overall reputation score only
- Category scores used only for moderator selection
  (e.g. a pedagogy dispute selects moderators with high pedagogy scores)

### Affirmative Badges
- Skillwork, fabrication, and tech traces earn a visible affirmative badge
  on the node's profile
- Does NOT inflate the numerical score
- Purpose: recognition of craft and technical labour without gamification

### Visual Representation
- Displayed as a radar/spider chart — one axis per category
- Shape grows and morphs based on contribution patterns
- New node starts at ~10% filled on all axes
- Specialist = lopsided shape; well-rounded contributor = balanced polygon
- No numbers shown publicly — only the shape
- Raw score visible only to the node themselves in their private dashboard
- Goal: show what kind of contributor you are, not rank you against others

---

## Base Contracts

### START
- Purpose: Initialises a new project
- Input: title, creator(s), space id
- Optional input: context, reference, pedagogical id
- Output: project id, contributor registry, contract state (ACTIVE)
- Rules:
  - At least 1 node must sign
  - If pedagogy tag is set, mentor node gets elevated role automatically

---

### TRACE
- Purpose: Logs a unit of work or activity on a project
- Input: project id, node id, activity type, timestamp
- Optional: media hash, description, duration, tool/software badge
- Activity Types (presets):
  - brainstorm
  - primary research
  - secondary research
  - iterate
  - skillwork
  - fabrication
  - pedagogy
  - admin
  - review
  - AI tool
  - other (free text description required)
- Tool/Software Badge:
  - Preset list + free text option
  - Attached to the specific trace entry AND to the node's profile
  - Declaring AI tool here satisfies AI declaration requirement
- Output: trace id, appended to project log
- Rules:
  - Any registered contributor can log
  - Media stored off-chain (database); hash stored on chain
  - Minimum log = activity type + timestamp
  - A space may define its own minimum log requirements beyond this

---

### VETO
- Purpose: Stops or limits something on a project
- Input: project id, node id, veto id, reason hash
- Veto Types:
  - hard stop
  - scope limit
  - content flag
  - NDA seal
- Output: veto id, flagged on project state
- Rules:
  - Hard stop requires majority sign-off OR preassigned veto authority (e.g. teacher)
  - NDA seal makes specific trace logs private
  - Hash remains on chain; content is encrypted
  - Space admins cannot access NDA sealed content

---

### PIVOT
- Purpose: Records a change in direction for a project
- Input: project id, node id, pivot reason
- Distinction from VETO: veto stops or limits something; pivot records
  a change in direction without stopping the project
- Output: pivot id, branch point logged in process token

---

### CREDIT (end project)
- Purpose: Closes the project, mints final NFT and contributor tokens
- Input: project id, final contributors, roles, contribution weight (optional),
  dispute flag (optional)
- Output:
  - Contribution tokens minted (soulbound, non-transferable)
  - Final NFT minted with provenance link
- Co-Ownership Logic:
  - If contributors do not specify weights, equal split automatically
  - If weights specified and all agree, custom split executed
  - If weights specified and any party disagrees, Mediate flow triggered
  - If mediation fails, equal split enforced, DISPUTED flag added to NFT
- Rules:
  - All primary contributors must sign
  - Dispute flag triggers Mediate flow
  - Off-chain contributors can be listed as unclaimed credit, claimable
    if they join the chain later
  - Off-chain creditor's company name, portfolio, or media can be listed
    with their explicit permission
  - Technicians, mentors, and guides also receive contributor tokens

---

### REFERENCE
- Purpose: Credits inspiration, sources, and pedagogical lineage;
  addresses plagiarism vs inspiration distinction
- Input: project id, source id / external url / citation, relationship type
- Relationship Types:
  - inspired by
  - built on
  - forked from
  - in response to
  - pedagogical source
  - AI generated
  - other (free text explanation required)
- Output: reference id (logged in process token)
- Rules:
  - Maker declares the relationship themselves
  - Timestamped and immutable once submitted
  - Cannot be edited or removed after deployment

---

### FORK
- Purpose: Creates a new project branched from an existing one
- Input: parent project id, new project id, fork reason, inherited contributors
- Output: lineage link between parent and child project (permanent)
- Rules:
  - Parent contributors notified automatically
  - Inherited credit preserved and visible
  - Forked projects do NOT inherit reputation score from the parent
  - Reputation in the fork is built only from new work done within it
  - Forks of dormant spaces carry a visible lineage marker

---

### ARCHIVE (visually distinct from active projects)
- Purpose: Documents a past or completed project retroactively
- Input: title, medium, approx date, creator node id, evidence type,
  evidence hash, reconstruction flag (true)
- Optional: collaborators, reference, context note
- Evidence Types (presets, must be visible):
  - photos of work
  - process photos
  - sketches
  - dated files
  - social post
  - videos
  - voice recordings
  - audio
  - exhibit record
  - institution record
  - url
  - portfolio link
  - other (free text explanation required)
- Output:
  - Archive project id
  - NFT minted with archive badge
  - Contributor tokens issued if collaborators mentioned
- Non-Negotiables (stored on chain):
  - Date documented on chain
  - Original work declaration
  - Approximate date of making
  - Evidence provided
  - Reconstruction flag (self-reported)
- Attestation:
  - Types: self / peer / institution
  - Includes: archive id, attesting node id, relationship type, statement hash
  - Relationship types for attestation: collaborator / witness / mentor /
    institutional contact
- Reputation Weight:
  - Archive projects carry lower base reputation weight than live documented projects
  - Archives with only self-attestation carry the lowest weight
  - Cross-attestation required for any meaningful reputation score impact

---

### CUSTOM CONTRACT
- Purpose: Allows nodes to define logic beyond the base contracts
- Available to: all nodes, unless a space has forbidden it
  (must be declared when creating a space)
- Constraints:
  - Cannot override or bypass any base contract logic
  - Cannot collect or store personal data
  - Cannot introduce any payment or token transfer mechanism
  - Cannot grant permissions above what meta governance allows
  - Must be reviewed and signed by all affected parties before deployment
  - If deployed at space level and affects all space members,
    supermajority of space members must sign (not just admins)
  - Must include a plain English description of what it does, stored on chain
  - Space admins can deploy for their space only, not chain-wide
  - Protocol panel can flag and freeze any violating contract

---

## Documentation Modes

Three modes to reduce documentation burden while preserving creative flow.
Minimum viable log is always: activity type + timestamp.

| Mode | Description | Chain Storage |
|---|---|---|
| Micro log | Single tap w/ presets. node id + activity type + timestamp. Maps to TRACE or any base contract | Full entry on chain |
| Memo log | Voice note / photo / video / url / few phrases | Media to database; hash to chain |
| Reflection log | Asynchronous. More context, evidence, notes, research links | Media to database; hash to chain |
| Proxy log | Witness logs on behalf of another contributor | Marked as PROXY on chain |

### Proxy Log Rules
- Proxy logs visibly marked as PROXY on chain
- Node being logged for must confirm or dispute within 7 days
- Silence = confirmation after 7 days
- Dispute triggers a standard attribution flag

---

## Final NFT Structure

Each completed project produces a Final NFT:
- Metadata: title, medium, date, creator(s)
- Thumbnail credit summary (all contributors visible)
- Process token (non-transferable, linked to all base contracts deployed)
- Contributor tokens (linked, includes roles, time logged, node identity)

### Rules
- NFT can be sold or transferred
- Provenance is permanently attached and immutable, cannot be removed
- Soulbound: contributor tokens and process tokens cannot be transferred
- Cannot be fully deleted, can be marked EXPIRED or encrypted but never
  fully removed from chain
- All provenance and credit records survive any transfer of the NFT

---

## Spaces

### What a Space Is
A context — university, studio, classroom, hobby group, or any community —
within which projects are organised and governed by locally defined rules.
Spaces are entirely disjointed from any financial or credit-scoring systems.

### Creating a Space
Any node can create a space. At creation the space must declare:
1. Who can start a project: open / invite only / application
2. Who has veto authority
3. Voting thresholds
4. Privacy defaults: public / space-specific / private
5. Whether custom contracts are allowed for members
6. Content restrictions beyond chain defaults (e.g. no nudity)
7. Minimum documentation requirements beyond chain minimum (if any)
8. Financial linking: always NO, cannot be changed

### Joining a Space
- Open spaces: any node can join freely
- Restricted spaces: invite code (single-use, expires after use) OR
  admin approval OR access request accepted by admin
- Invite codes can be distributed off-platform (e.g. physically in class)
- No email or phone required for any joining process

### Space Rules vs Chain Rules
- Spaces can restrict things further than chain defaults
- Spaces cannot permit anything that violates chain / meta governance rules
- Any node can flag a space for violating meta rules
- Flags from inside members treated as higher urgency
- Spaces cannot prevent members from raising flags to chain-level moderation

### Space Banning
- A space can ban a node from that space
- Banned node remains on the chain and in all other spaces
- Bans cannot be issued without going through the moderation process

### Dormant Spaces
- Spaces do not get deleted — they go DORMANT
- Dormant = no new activity, no new members, no edits
- All work inside stays on chain permanently
- Space visually marked as DORMANT
- Dormancy is permanent — a dormant space cannot be reactivated
- An admin may fork a new space from a dormant one
  - Forked spaces carry a visible lineage marker showing origin
- Triggered by: space creator + majority of admins OR meta governance vote

### Visibility Outside a Space
- Default: only the Final NFT is visible to people outside the space
- Node can change visibility per project in project settings:
  - Process visible
  - Fully public
  - Space-only (fully private within space)

### Space Misconduct
- Any node can raise a space misconduct flag
- Inside member flags treated as more urgent
- Moderation panel can issue warnings, force rule changes, or trigger
  dormancy via meta governance vote
- Spaces cannot discriminate on basis of identity characteristics

---

## Three-Tier Governance

### Tier 1 — Space Level (Local)
Each space governs itself via presets and editable parameters.
All parameters listed under Creating a Space apply here.
Cannot override meta governance rules.

### Tier 2 — Cross-Space (Network)
Where spaces interact (collaborations, shared projects, forks):
- Shared protocol governs attribution across space boundaries
- Each space signs a mutual recognition agreement honouring each
  other's contribution tokens
- Cross-space disputes handled by moderators from all involved spaces
  before escalating to Tier 3

### Tier 3 — Protocol Level (Meta / Chain)
- Purpose: flag, discuss (time-locked), vote, execute
- Any node can raise a flag or proposal
- Supermajority (70%+) required for base contract changes
- Simple majority for parameter changes
- Losing minority can always fork the protocol
- All Tier 3 proceedings are fully transparent and public

---

## Moderation System

### Flow
flag → review panel → ruling → optional appeal

### Dispute Complexity Levels
| Level | Criteria | Time Lock | Moderators |
|---|---|---|---|
| Level 1 — Minor | Single node, single trace, content flag | 48 hours | 3 |
| Level 2 — Moderate | Multiple nodes, attribution dispute, space conflict | 7 days | 5 |
| Level 3 — Major | Cross-space, NFT ownership, large contributor group | 14 days | 7 |
| Level 4 — Protocol | Base contract or meta governance challenges | 30 days | All active protocol panel nodes |

### Auto-Classification
System auto-classifies based on:
- Number of nodes involved
- Whether dispute crosses space boundaries
- Whether a Final NFT has already been minted
- Whether reputation impact exceeds a defined threshold

Any party can appeal the classification level (not the ruling itself)
if they believe it was misclassified.

### Moderator Selection
- Randomly selected from reputation-weighted nodes in relevant spaces
- Review call goes to multiple eligible nodes simultaneously
- First to accept becomes panel member, up to required number
- Category scores used for selection (e.g. pedagogy dispute selects
  moderators with high pedagogy scores)
- No permanent moderator class
- Cannot request a specific moderator
- Can request to exclude one moderator per party per case (with reason)
  - Other panel members vote on exclusion validity
  - Maximum 1 exclusion request per party
- Validators excluded from moderating any dispute they are party to

### Anonymity by Level
| Level | Anonymity |
|---|---|
| Level 1 | Moderators know parties; parties do not know moderators |
| Level 2 | Same as Level 1 |
| Level 3 | Fully anonymous both ways until ruling; moderators revealed after |
| Level 4 | Fully transparent — everything public |

- Can be changed only if all parties mutually agree on a different level

### Appeal Process
```
Original ruling
  → Appeal ticket (within 7 days of ruling)
  → New panel, one level higher, different moderators
  → Second ruling
  → Final appeal ticket (within 7 days, must present NEW evidence)
  → Protocol panel reviews
  → Final and binding
  → Case marked DISPUTED-CLOSED if unresolved
```
- Maximum 2 appeals
- Further attempts after 2 go to lowest priority queue indefinitely
- DISPUTED-CLOSED flag stays permanently visible on chain

### Slashing
- Provable moderator bad faith → reputation penalty
- Severe proven bad faith → removal from chain
- Slashing decisions made by a separate panel that excludes original moderators

---

## Mediate Flow (Step by Step)

Triggered by: dispute flag in CREDIT, credit disagreement, or any
contributor dispute within a project.

1. Any contributor (not only primary) can trigger
2. Parties first encouraged to resolve peer-to-peer
3. If unresolved, raise flag to subspace / space moderators
4. If still unresolved, raise flag to chain moderators
5. Full moderation flow begins (classification, panel, time lock)
6. Successful mediation = all parties sign revised agreement on chain
7. Failed mediation = equal split enforced + DISPUTED flag on NFT permanently

---

## Flag Types

### Emergency Flags (immediate automated action)
- CSAM
- Non-consensual intimate imagery

### Content Flags (standard moderation flow)
- Hate speech / slurs
- Harassment
- Impersonation
- Doxxing
- Illegal content
- Misinformation about another node or their work
- Spam

### Attribution Flags
- Plagiarism claim
- False credit
- Undeclared AI usage
- Missing lineage (fork or derivative with provenance removed)

### Governance Flags
- Space misconduct
- Moderator bad faith
- Contract violation
- False flagging

### Dispute Flags (triggers Mediate flow)
- Credit dispute
- Veto dispute
- Space ban dispute
- Classification appeal

---

## Content & Safety

### CSAM
- Emergency flag triggers immediate permanent deletion
- Node suspended immediately
- Node can appeal suspension — content is gone, no content appeal, no exceptions

### Non-Consensual Intimate Imagery
- Emergency flag triggers immediate user-facing removal
- Encrypted copy held privately by protocol panel only for appeal window
- 24-hour emergency panel
- If confirmed, permanent removal and node suspended
- Encrypted copy destroyed after case closes
- If false flagging confirmed, flagging node receives severe reputation penalty

### Nudity
- Permitted at chain level
- Spaces may restrict it within their own rules
- Flagged by space members or moderators within that space
- Removed within the space if against space rules, not chain-wide

### Illegal Content
- Standard flag, moderation flow, complexity classification
- Removed if confirmed by moderator panel

---

## Profiles & Social Layer

### Profile Contents
- Alias
- Interests
- Spaces (list of spaces the node belongs to)
- Reputation graph (radar chart shape, no numbers)
- Affirmative badges (skill/tech/craft recognition)
- Optional portfolio link (external URL)
- No personal information of any kind

### Profile Visibility
- All profiles publicly visible, cannot be set fully private
- A node can block another node from viewing their profile or sending requests

### Outreach & Collaboration Requests
- Any node can send a collaboration or question request to any other node
- Recipient can accept or deny
- 2-week cooldown after a denied request before sender can contact same node again
- After 3 denials from same node, sender permanently auto-blocked from
  sending that node requests
- Maximum 3 unanswered requests to same node at any time (no auto-block,
  just a send limit — must wait for response)
- Any request can be reported as harassment, immediate block + optional
  harassment flag raised

### Portfolio Sharing
- Any node can generate a public URL for their profile or any project
- Works for people completely outside the chain
- Visibility per project controlled in project settings

### No Social Feed
- No likes, comments, or shares
- No recommendation algorithm
- No engagement metrics
- No trending or ranked content

### Search & Discovery
- Manual search only: field (preset list, TBD) / skill / tool
- Optional free text keywords on profile: visible but NOT searchable
  algorithmically, only appears in direct text search
- No ranking, no weighting, no recommendations
- Purpose: prevent algorithmic precarity and popularity traps

---

## Meta Governance Rulebook

The foundational law of the chain. Spaces and subspaces cannot override
these rules. They may only restrict further, never loosen.

### Identity & Conduct
- No hate speech, slurs, or content targeting identity (race, gender,
  sexuality, disability, religion, nationality, caste, or any other
  identity characteristic)
- No harassment, threats, intimidation, or sustained hostile behaviour
  toward any node
- No impersonation of another node or real person
- No operating multiple accounts to manipulate reputation or voting
- No doxxing — publishing personal information about another node
  without explicit consent

### Content
- No CSAM — immediate permanent deletion, immediate suspension,
  no content appeal, no exceptions
- No non-consensual intimate imagery — immediate removal, suspension,
  appeal on suspension only
- No content depicting or facilitating real-world violence or illegal activity
- No content designed to defraud, deceive, or manipulate other nodes
- Nudity permitted at chain level — spaces may restrict within their rules
- AI-generated content permitted but must be declared via REFERENCE
  (AI generated) or TRACE (AI tool)
- AI usage cannot be forced to stop but is encouraged to be declared

### Attribution & Plagiarism
- Cannot claim authorship of work that is not yours
- Cannot mint a Final NFT using another node's work without their
  signed contribution
- Inspiration must be declared via REFERENCE — undeclared copying is a violation
- Forking permitted but lineage must be preserved and parent contributors notified
- Cannot remove or obscure provenance from any NFT or process token
- Plagiarism on this chain means: minting work without attribution,
  removing provenance, or claiming sole authorship of collaborative work

### Contracts & Code
- Custom contracts cannot override meta governance rules
- Custom contracts cannot introduce financial transactions of any kind
- Custom contracts cannot collect personal data
- Custom contracts cannot create permanent bans without a moderation process
- Once deployed, contracts are immutable — all signatories fully responsible
  for understanding what they sign
- Plain English description required for every custom contract, stored on chain
- Space-level custom contracts require supermajority of space members to sign

### Spaces
- Cannot charge membership fees of any kind
- Cannot discriminate on basis of identity characteristics
- Can restrict content types beyond chain defaults but cannot permit
  content that violates chain rules
- Cannot prevent members from raising flags to chain-level moderation
- Cannot ban a node without a moderation process

### Data & Privacy
- No personal data (email, phone, real name, location, or any identifying
  information) collected at any point
- All data collection must be declared and consensual
- NDA sealed content remains encrypted — no one including space admins
  can access it
- Off-chain media hashes are public and verifiable by anyone
- Off-chain media content cannot be edited after logging
- Node identity on chain is alias only — never linked to real-world identity
  by the platform

### Financial Rules
- This chain is entirely non-financial
- No token with monetary value exists or may be created
- No spaces may charge fees of any kind
- NFTs on this chain represent provenance and attribution only —
  they are not financial instruments
- No trading platforms or financial mechanisms may be built on this chain

### Smart Contracts: Code is Law
- Once a smart contract is deployed it is immutable
- All signing parties are responsible for understanding its terms
- The plain English description stored on chain is the human-readable reference
- Disputes about contract outcomes go through moderation, not code changes

### Decentralisation & Trust
- This chain operates on trust, not financial incentive
- No central authority controls the chain after Phase 4
- Founder authority phases out by design
- Protocol changes require community vote — no single node has override power
- All governance decisions are logged on chain and publicly verifiable

---

## Chain-Level Prohibitions (permanent ban)
- Uploading or distributing CSAM
- Repeated proven harassment after moderation rulings
- Proven identity fraud or multiple accounts used for manipulation
- Proven doxxing
- Proven bad faith moderation at maximum slashing level
- Deploying contracts that deliberately circumvent meta governance
- Removing or falsifying provenance on any NFT

## Space-Level Violations (local consequences only)
- Violating space-specific content rules
- Repeated disruption of space projects
- Breaching space NDA seals
- Abusing space admin permissions within local scope

---

## On-Chain vs Database

| On Chain (immutable, lightweight) | Database (rich, linked) |
|---|---|
| Trace id, timestamps, activity type | Photos / video / url / evidence / voice notes |
| Contributor node id, roles | Written reflections, research documents |
| Hash for all off-chain media | Wireframes, sketches |
| Veto / pivot / reference / any contract | Links / URLs |
| Final NFT metadata | Process narrative |
| Credit weights | NDA sealed content (encrypted) |
| Voting records | Space-specific templates |
| Archive reconstruction flag | Free text keywords |

All off-chain data is content. All on-chain data is proof.
Anyone can verify a hash. No one can edit off-chain content after logging.

---

## Loophole Mitigations

### Proxy Logging Abuse
- Proxy logs marked visibly as PROXY on chain
- Node being logged for must confirm or dispute within 7 days
- Silence = confirmation
- Dispute raises an attribution flag

### Social Recovery Collusion
- Recovery request time-locked for 72 hours
- Original node receives on-chain notification and can block if active
- Proceeds only if original node is genuinely unreachable

### Fork Exploitation
- Forked projects inherit lineage but not reputation score
- Reputation in the fork is built only from new work done within it

### Archive Inflation
- Archives carry lower base reputation weight than live documented projects
- Archives with only self-attestation carry the lowest weight
- Cross-attestation required for any meaningful reputation score impact

### Custom Contract Abuse
- Space-level contracts affecting all members require supermajority to sign
- Protocol panel can flag and freeze any violating contract
- Plain English description required — no hidden logic

### Space Dormancy Workaround
- Forks from dormant spaces carry a visible lineage marker
- Origin dormant space always traceable and public

### Validator Influence
- Validators excluded from moderating any dispute they are party to
- Validator status publicly visible at all times

---

## What Is NOT Decided Yet (TBD)

- Frontend framework (React / Next.js / other)
- Preset list of art/design fields for search
- Exact reputation score formula (weighting of each source)
- Exact threshold at which reputation impact triggers complexity level
- Undeclared off-chain collaborators in CREDIT — whether permission
  is needed just to list a name as unclaimed credit (deferred)
- Attestation farming mitigation strategy (deferred)
- Emergency flag abuse penalty specifics (deferred)
- Exact tool/software preset list
- Dashboard UI layout and contents
- Precise decay curve (flat -5/month confirmed, curve shape TBD)
