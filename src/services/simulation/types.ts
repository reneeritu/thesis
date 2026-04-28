export type SimRole =
  | 'maker' | 'designer' | 'pedagogue' | 'researcher'
  | 'admin' | 'technician' | 'student' | 'validator';

export type DocStyle = 'micro' | 'memo' | 'reflection' | 'media_heavy' | 'mixed';

export type TraitVector = {
  activityLevel: number;        // 0..1
  archiveBias: number;          // 0..1
  documentationStyle: DocStyle;
  endorsementGiveRate: number;  // 0..1
  badFaithProbability: number;  // 0..0.05
  proxyTargetEligible: boolean;
  governanceParticipation: number;
  craftFocus: number;
  pedagogyFocus: number;
};

export type NodeSpec = {
  alias: string;
  role: SimRole;
  traitVector: TraitVector;
  spaceMemberships: Array<{ spaceKey: string; isAdmin?: boolean; isVeto?: boolean }>;
  tier: 'hero' | 'active' | 'background';
};

export type SpaceSpec = {
  key: string;
  title: string;
  type: 'studio' | 'pedagogical' | 'archive' | 'protocol' | 'collective';
  parentKey?: string;
  settings: {
    projectAccess: 'open' | 'invite_only' | 'application';
    privacyDefault: 'public' | 'space_specific' | 'private';
    customContracts?: Array<{ title: string; body: string; authorAlias: string }>;
    minDocRequirements?: string[];
    enforceStrictMinDoc?: boolean;
    vetoAuthority?: string[];
  };
};

export type ArcId =
  | 'healthy_with_fork'
  | 'credit_dispute_tier2'
  | 'plagiarism_tier2'
  | 'undercredit_tier3_unsolved'
  | 'governance';

export type ArcSpec = {
  id: ArcId;
  spaceKey: string;
  primaryAlias?: string;
  involvedAliases: string[];
  startTick: number;
};

export type TimelineBeat = {
  tick: number;
  arcId: ArcId | 'world';
  action: string;
  payload?: Record<string, unknown>;
  human?: string;
};

export type SimulationScenario = {
  simRunId: string;
  seed: number;
  spaces: SpaceSpec[];
  nodes: NodeSpec[];
  arcs: ArcSpec[];
  beats: TimelineBeat[];
};

export type SimulationEvent = {
  tick: number;
  type: string;
  human: string;
  refs?: { kind: string; id: string }[];
};

export type SimulationCounters = {
  blocksWritten: number;
  tracesLogged: number;
  flagsFiled: number;
  mediationsResolved: number;
  nftsMinted: number;
  governancePassed: number;
};

export type SimulationStatus = 'idle' | 'seeding' | 'running' | 'paused' | 'complete' | 'failed';

export type SimulationSnapshot = {
  simRunId: string;
  currentTick: number;
  status: SimulationStatus;
  events: SimulationEvent[];
  counters: SimulationCounters;
  spaceIds: string[];
  projectIds: string[];
  heroNodeAliases: string[];
  startedAt?: string;
  updatedAt: string;
};
