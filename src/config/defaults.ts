/**
 * Configurable chain parameters.
 *
 * These cover every ambiguity flagged in BACKEND-REVIEW.md so the values
 * can be tuned without code changes.  Each field maps to a specific section
 * of the spec — see the inline comments.
 */
export const chainDefaults = {
  // --- Identity & Accounts ---

  /** Any chain action within this many days counts the node as "active". */
  activeNodeThresholdDays: 30,

  /** Minimum trustees a node must select for social recovery. */
  socialRecoveryMinTrustees: 3,

  /** Maximum trustees a node can select for social recovery. */
  socialRecoveryMaxTrustees: 5,

  /**
   * Fraction of selected trustees that must confirm a recovery request.
   * 0.5 = simple majority (e.g. 2 of 3), 0.6 = 3 of 5, etc.
   */
  socialRecoveryMajorityFraction: 0.6,

  /** Hours the recovery request is locked before it can proceed. */
  socialRecoveryTimeLockHours: 72,

  // --- Reputation ---

  /** Starting score for a newly created node. */
  reputationBaseScore: 100,

  /** Hard cap — no node can exceed this score. */
  reputationCap: 1000,

  /** Score never drops below this floor. */
  reputationFloor: 50,

  /** Points deducted per month once the grace period expires. */
  reputationDecayPerMonth: 5,

  /**
   * Months of inactivity before decay begins.
   * "Activity" = any chain action (trace, project, attestation, vote).
   */
  reputationGraceMonths: 3,

  // --- Proxy Logging ---

  /** Days a node has to confirm or dispute a proxy log before silence = confirm. */
  proxyLogConfirmDays: 7,

  // --- Governance ---

  /** Fraction required for a supermajority vote (phase transitions, contract changes). */
  supermajorityThreshold: 0.7,

  /** Fraction required for a simple majority vote (parameter changes). */
  simpleMajorityThreshold: 0.5,

  // --- Phase Transitions ---

  /** Active node count that triggers eligibility for Phase 2. */
  phase2NodeThreshold: 50,

  /** Active node count that triggers eligibility for Phase 3. */
  phase3NodeThreshold: 200,

  // --- Moderation ---

  /** Reputation penalty for confirmed false emergency flag. */
  falseEmergencyFlagPenalty: 200,

  /** Reputation penalty for confirmed moderator bad faith. */
  moderatorBadFaithPenalty: 300,

  /** Days within which an appeal ticket must be filed after a ruling. */
  appealWindowDays: 7,

  /** Maximum number of appeals per dispute. */
  maxAppeals: 2,

  /** Hours for NCII emergency panel time lock (spec: 24h). */
  emergencyPanelTimeLockHours: 24,

  // --- Collaboration Requests ---

  /** Cooldown in days after a denied collaboration request. */
  requestCooldownDays: 14,

  /** Permanent auto-block after this many denials from the same node. */
  requestAutoBlockAfterDenials: 3,

  /** Max unanswered requests to the same node at one time. */
  maxPendingRequestsPerNode: 3,

  /** Required moderator count per complexity level (0 = all active nodes). */
  moderatorCountByLevel: {
    1: 3,
    2: 5,
    3: 7,
    4: 0,
  } as Record<number, number>,

  /** Invite this many times the required moderator count. */
  moderatorInviteMultiplier: 2,

  /** Hours invited moderators have to accept before being replaced. */
  moderatorAcceptDeadlineHours: 48,

  // --- Mediation ---

  /**
   * Time locks per dispute complexity level (BACKEND.md § Dispute Complexity Levels).
   * Values are in hours to allow sub-day precision for Level 1.
   * Level 1 (Minor): 48 h, Level 2 (Moderate): 168 h (7 d),
   * Level 3 (Major): 336 h (14 d), Level 4 (Protocol): 720 h (30 d).
   */
  mediationTimeLockHours: {
    1: 48,
    2: 168,
    3: 336,
    4: 720,
  } as Record<number, number>,

  /** Maximum resolution proposals allowed per mediation case. */
  mediationMaxProposals: 10,

  // --- Alias ---

  /** Minimum alias length. */
  aliasMinLength: 3,

  /** Maximum alias length. */
  aliasMaxLength: 30,
} as const;

export type ChainDefaults = typeof chainDefaults;
