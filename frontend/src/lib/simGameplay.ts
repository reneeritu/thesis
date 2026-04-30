/**
 * Simulation gameplay layer.
 *
 * One sim run, two visual readings:
 *   Act 1 (ghost)  — labor invisible, traces redacted, disputes unresolved.
 *   Act 2 (etch)   — same data, full Etch mode, provenance complete.
 *
 * The transition fires automatically at TRANSITION_TICK.
 * No player choices. No characters. The difference IS the argument.
 */

export type GamePhase =
  | 'entry'       // thesis statement screen, sim not started
  | 'act1'        // ghost mode — sim running live
  | 'transition'  // Interstitial between acts (duration TRANSITION_DURATION_MS)
  | 'act2'        // etch mode — replaying events from snapshot
  | 'end'         // comparison end card

/** Tick at which Act 1 ends and transition fires (undercredit mediation fails). */
export const TRANSITION_TICK = 26

/** How long the transition animation lasts (ms). */
export const TRANSITION_DURATION_MS = 5200

/** Delay between replayed events in Act 2 (ms). */
export const ACT2_REPLAY_DELAY_MS = 420

/** Narrator card stays readable before fading; next line waits until this completes. */
export const NARRATOR_CARD_DWELL_MS = 11000

/** Fade-out duration after dwell (must match CSS transition on the card). */
export const NARRATOR_FADE_OUT_MS = 600

/**
 * Minimum wall-clock time in Act I after the scene is ready before we allow the
 * mid-story transition — avoids jumping ahead while the canvas/API are still catching up.
 */
export const MIN_ACT1_WALL_MS_BEFORE_TRANSITION = 18000

/** Debounce after first “healthy” snapshot before we hide the loading overlay. */
export const STORY_HYDRATION_DEBOUNCE_MS = 750

/** Pause after the run completes before showing the end card. */
export const POST_COMPLETE_TO_END_MS = 4500

/**
 * Ghost-mode narrator text per event type.
 * Shown during Act 1 — flat, factual, slightly bleak.
 */
export const NARRATOR_ACT1: Record<string, string> = {
  'world:genesis': 'A network forms. Validators come online.',
  'world:spaces_open': 'Spaces open. Membership rolls finalise.',
  'healthy:project_started':
    'A collaborative project begins. Six people are involved.',
  'healthy:traces_summary':
    'Fourteen hours of work happen here. Nothing is recorded.',
  'healthy:pivot':
    "A technical breakthrough changes the project's direction. There is no record of who made it.",
  'healthy:fork_created':
    "The project forks. The original maker's contribution to the new branch: unknown.",
  'credit_dispute_tier2:credit_proposed':
    'Credit is proposed: 60% to the designer. 5% to the technician who did the integration work.',
  'credit_dispute_tier2:space_escalation':
    'A dispute opens. Evidence is requested. The system finds: a partial record.',
  'credit_dispute_tier2:tier2_resolved':
    'A compromise is forced. The technician receives 25%. The reason: contested.',
  'plagiarism_tier2:flag_filed':
    'One person copies another\'s work. A flag is filed.',
  'plagiarism_tier2:panel_ruling':
    'The panel rules. Plagiarism upheld. But the original maker\'s provenance: fragile.',
  'plagiarism_tier2:retaliation_dismissed':
    'A counter-flag is dismissed. The bad actor loses reputation. The damage is already done.',
  'undercredit_tier3_unsolved:credit_proposed':
    'Another project. Another designer. Technicians credited at 5% again.',
  'undercredit_tier3_unsolved:mediation_escalated_t3':
    'The dispute escalates to the highest tier. Mediators ask for proof of contribution.',
  'undercredit_tier3_unsolved:mediation_failed':
    'No documentation exists. Mediation fails. The project is marked DISPUTED. The work: erased.',
}

/**
 * Etch-mode narrator text per event type.
 * Shown during Act 2 — still factual, but precise and evidential.
 */
export const NARRATOR_ACT2: Record<string, string> = {
  'world:genesis': 'A network forms. Every action will be written.',
  'world:spaces_open': 'Spaces open. Every membership, on chain.',
  'healthy:project_started':
    'Material Memory begins. Six contributors. All named. All traceable.',
  'healthy:traces_summary':
    'Six traces logged. Fabrication, pedagogy, iteration — each one a block on chain.',
  'healthy:pivot':
    'The pivot is documented as a research finding. Not a failure. A discovery. On chain.',
  'healthy:fork_created':
    "The fork is created with provenance. The original maker's contribution persists into the new branch.",
  'credit_dispute_tier2:credit_proposed':
    'A credit dispute opens. The technician has evidence: every steam-bending session, every clamp sequence — logged.',
  'credit_dispute_tier2:space_escalation':
    'Space moderators review the on-chain record. The evidence is there.',
  'credit_dispute_tier2:tier2_resolved':
    'Mediation resolves to 45/25/5/25. The technician\'s work is on record. The compromise holds.',
  'plagiarism_tier2:flag_filed':
    "The original work has a provenance trail. The copy does not. The flag is filed with evidence.",
  'plagiarism_tier2:panel_ruling':
    'The panel rules: plagiarism upheld. The original maker\'s chain history is the proof.',
  'plagiarism_tier2:retaliation_dismissed':
    'The counter-flag is dismissed. The bad actor\'s reputation takes a second hit. The system is self-correcting.',
  'undercredit_tier3_unsolved:credit_proposed':
    'A designer proposes 5% for the technicians. The technicians have a trace: 40% of the integration work, documented.',
  'undercredit_tier3_unsolved:mediation_escalated_t3':
    'Chain mediators review the on-chain record. The evidence is there.',
  'undercredit_tier3_unsolved:mediation_failed':
    'Even with documentation, bad actors can exhaust the system. But the record exists. It cannot be erased.',
  'governance:proposal_posted':
    'The community notices a pattern. A governance proposal: mandatory AI declaration. Posted publicly.',
  'governance:voting_opens':
    'Voting opens. Reputation-weighted. The makers, the pedagogues, the researchers — all have a voice.',
  'governance:proposal_resolved':
    'Passed. The rule applies chain-wide. The system is self-correcting because the community can see what is happening.',
  'world:final': 'World quiescent. Every trace, permanent.',
}

/** Get narrator text for a given event type and phase. Returns null if no text defined. */
export function getNarratorText(
  eventType: string,
  phase: 'act1' | 'act2',
): string | null {
  const map = phase === 'act1' ? NARRATOR_ACT1 : NARRATOR_ACT2
  return map[eventType] ?? null
}

/**
 * Event types that trigger a narrator card.
 * Only a subset of all events get a card — the narratively significant ones.
 */
export const NARRATOR_TRIGGER_TYPES = new Set([
  'world:genesis',
  'world:spaces_open',
  'healthy:project_started',
  'healthy:traces_summary',
  'healthy:pivot',
  'healthy:fork_created',
  'credit_dispute_tier2:credit_proposed',
  'credit_dispute_tier2:space_escalation',
  'credit_dispute_tier2:tier2_resolved',
  'plagiarism_tier2:flag_filed',
  'plagiarism_tier2:panel_ruling',
  'plagiarism_tier2:retaliation_dismissed',
  'undercredit_tier3_unsolved:credit_proposed',
  'undercredit_tier3_unsolved:mediation_escalated_t3',
  'undercredit_tier3_unsolved:mediation_failed',
  'governance:proposal_posted',
  'governance:voting_opens',
  'governance:proposal_resolved',
  'world:final',
])

/**
 * Ghost-mode display text for event feed entries.
 * Replaces the actual human text so traces remain hidden in Act 1.
 */
export function ghostEventText(eventType: string): string {
  if (eventType.startsWith('healthy:')) return 'work happened here'
  if (eventType.startsWith('credit_dispute')) return 'a dispute was opened'
  if (eventType.startsWith('plagiarism')) return 'a flag was filed'
  if (eventType.startsWith('undercredit')) return 'credit was contested'
  if (eventType.startsWith('governance')) return 'a vote occurred'
  if (eventType.startsWith('world:')) return '—'
  return 'an event occurred'
}

/**
 * End card stats for the ghost world (Act 1 outcome if documentation hadn't existed).
 * These are intentionally bleak / zeroed.
 */
export const GHOST_WORLD_STATS = {
  tracesDocumented: 0,
  pivotsOnRecord: 0,
  disputesResolved: 0,
  makersWithProvenance: 0,
  nftsWithFairCredit: 1,
} as const

/**
 * End card stats for the Etch world (Act 2 outcome from actual sim counters).
 * Populated from the real SimCounters after sim completes.
 */
export type EtchWorldStats = {
  tracesDocumented: number
  pivotsOnRecord: number
  disputesResolved: number
  makersWithProvenance: number
  nftsWithFairCredit: number
}

export function buildEtchStats(counters: {
  tracesLogged: number
  mediationsResolved: number
  nftsMinted: number
}): EtchWorldStats {
  return {
    tracesDocumented: counters.tracesLogged,
    pivotsOnRecord: 1,
    disputesResolved: counters.mediationsResolved,
    makersWithProvenance: counters.tracesLogged > 0 ? 18 : 0,
    nftsWithFairCredit: counters.nftsMinted,
  }
}
