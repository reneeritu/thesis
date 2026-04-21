/** Very short strings for native `title` tooltips (hover). */

export const GLOSSARY: Record<string, string> = {
  // Flag categories (Governance)
  emergency: 'Urgent safety issues that need immediate triage.',
  content: 'Harmful or policy-breaking material in posts or media.',
  attribution: 'Who deserves credit and whether sources or AI use are declared.',
  governance: 'Moderation, space rules, or abuse of roles and flags.',
  dispute: 'Collaborator disagreements that may go to mediation or review.',

  // Emergency types
  csam: 'Child sexual abuse material — zero tolerance; urgent escalation.',
  non_consensual_imagery: 'Intimate imagery shared or threatened without consent.',

  // Content types
  hate_speech: 'Attacks on people based on identity or dehumanizing slurs.',
  harassment: 'Targeted abuse, stalking, pile-ons, or intimidation.',
  impersonation: 'Pretending to be another person, org, or official account.',
  doxxing: 'Publishing private info to harm, threaten, or harass.',
  illegal_content: 'Material that violates applicable law.',
  misinformation: 'False claims presented as fact where that causes harm.',
  spam: 'Unwanted repetition, scams, or deceptive promotion.',
  nudity: 'Sexual or graphic nudity outside allowed contexts.',

  // Attribution types
  plagiarism: 'plagiarism — someone copied your work or ideas and presented them as their own.',
  false_credit: 'false_credit — wrong names, shares, or roles were attached to attributed work.',
  undeclared_ai: 'undeclared_ai — AI assistance was used but not disclosed where it was required.',
  missing_lineage: 'missing_lineage — the citation / provenance trail is broken or missing.',

  // Governance types
  space_misconduct: 'space_misconduct — roles, invites, or internal rules were abused inside a space.',
  moderator_bad_faith: 'moderator_bad_faith — moderation was used to harass, silence unfairly, or self-deal.',
  contract_violation: 'contract_violation — an explicit agreement or contributor duty was broken.',
  false_flagging: 'false_flagging — flags were raised in bad faith to harm another user.',

  // Dispute types
  credit_dispute: 'credit_dispute — someone took sole credit when you contributed, or shares are wrong.',
  veto_dispute: 'veto_dispute — a co-founder veto or refusal decision is being contested.',
  space_ban_dispute: 'space_ban_dispute — appeal or challenge about removal from a space.',
  classification_appeal: 'classification_appeal — you disagree with how a flag was categorised.',

  // Target types
  node: 'Your identity on the network — alias plus reputation.',
  trace: 'One timestamped work log, optionally with media proof.',
  project: 'A single tracked artwork or research thread inside a space.',
  space: 'A shared studio or group with members, rules, and projects.',
  nft: 'Provenance certificate — the art piece minted at the end of a project as proof of the work.',
  provenance_certificate: 'The art piece minted at the end of a project. Proves who made what, when, with what evidence. Formally an NFT on the Etch chain.',
  contract: 'An on-chain agreement or obligation tied to a project.',
  media: 'An uploaded file whose fingerprint is stored for verification.',
  endorsement: 'A peer-signed mark on a trace: I was there, I co-authored, I reviewed, I mentored.',
  alias: 'Your handle on the chain — public, permanent, not your legal name unless you chose it.',
  seed_phrase: 'A list of words that is the only way to recover your account — keep it safe, keep it offline.',
  trustees: 'People you trust to help restore your account if you lose the seed phrase. Optional at signup.',

  // Form labels / dashboard
  flag_category: 'High-level bucket for your report.',
  flag_type: 'Specific reason inside the chosen category.',
  target_type: 'What you are flagging: person, log, project, file, etc.',
  target_id: 'MongoDB-style id of that object (copy from the URL or UI).',
  space_id_optional: 'Space context if the issue is tied to one space.',
  reason: 'Short factual summary reviewers can act on.',

  node_label: 'Participant identity — not your legal name unless you chose it.',
  reputation_score: 'Aggregate signal from verified activity and peer outcomes.',
  mediation: 'Timed phases where parties propose terms to settle a dispute.',
  flag: 'A report that opens review; may escalate to space or chain level.',

  // Project status
  active: 'Work in progress; normal operations.',
  halted: 'Paused by governance or dispute until resolved.',
  disputed: 'Under mediation or formal dispute — some actions blocked.',

  // Trace modes
  mode_micro: 'Quick check-in — minimal detail.',
  mode_memo: 'Standard log entry with description and optional proof.',
  mode_reflection: 'Longer written reflection on process or outcome.',

  // Trace activities
  brainstorm: 'Ideation and concept shaping.',
  primary_research: 'First-hand data, interviews, or experiments you ran.',
  secondary_research: 'Reading, archives, or synthesis of existing sources.',
  iterate: 'Revising drafts, prototypes, or versions.',
  skillwork: 'Deliberate practice or technique training.',
  fabrication: 'Physical or digital making — build, print, sculpt, code.',
  pedagogy: 'Teaching, mentoring, curriculum, or clear explanation of ideas.',
  admin: 'Scheduling, email, grants, or non-creative logistics.',
  review: 'Critique sessions, edits, or formal assessment.',
  ai_tool: 'Work done with AI tools (declare accurately).',
  other: 'Activity that does not fit the list — describe briefly.',

  // Reputation axes (radar)
  craft: 'Skill and execution in your documented making.',
  research: 'Depth and care in inquiry and sourcing.',
  collaboration: 'Reliability and quality of joint work.',
  consistency: 'Steady practice over time.',
  community: 'Constructive participation in shared spaces.',

  // Dashboard / onboarding
  chain: 'The append-only record of traces and governance actions.',
  archive_work: 'Start a new trace batch or export flow from Archive.',
  discover: 'Browse public spaces, projects, and nodes.',
  space_heading: 'Collaborative contexts you belong to.',
  active_projects: 'Projects that are not archived or closed.',
  media_proof: 'File attached to a trace; hash proves it has not been swapped.',
  activity_field: 'What kind of work this log entry represents.',
  tool_software_field: 'Tools or apps used for this session.',
  duration_field: 'Approximate minutes for this log entry.',
  proxy_log: 'Record work on behalf of another alias — only with their consent.',
  spaces_section: 'Collaborative contexts you belong to.',
}
