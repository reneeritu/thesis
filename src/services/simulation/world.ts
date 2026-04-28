import crypto from 'crypto';
import {
  ArcSpec,
  DocStyle,
  NodeSpec,
  SimRole,
  SimulationScenario,
  SpaceSpec,
  TimelineBeat,
  TraitVector,
} from './types';

function seedFromString(s: string): number {
  const hex = crypto.createHash('sha256').update(s).digest('hex').slice(0, 8);
  return parseInt(hex, 16);
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted<T>(rng: () => number, weighted: Array<{ value: T; weight: number }>): T {
  const total = weighted.reduce((sum, x) => sum + x.weight, 0);
  let r = rng() * total;
  for (const w of weighted) {
    r -= w.weight;
    if (r <= 0) return w.value;
  }
  return weighted[weighted.length - 1].value;
}

function shortRunId(simRunId: string): string {
  return simRunId.replace(/^simrun_/, '');
}

/** Deterministic hero / anchor alias; share with `seed.ts` via same inputs. */
export function heroAliasFor(simRunId: string, suffix: string): string {
  return `sim_${shortRunId(simRunId)}_${suffix}`;
}

function h(simRunId: string, suffix: string): string {
  return heroAliasFor(simRunId, suffix);
}

const SPACE_KEYS_ORDER = [
  'university',
  'painting_hobby',
  'electronics_hobby',
  'pottery_class',
  'uiux_class',
  'wood_workshop',
  'blender_hobby',
  'graphic_design_hobby',
  'invite_studio',
  'open_studio',
  'application_collective',
  'wood_studio_collab',
] as const;

const DOC_STYLE_WEIGHTS: Array<{ value: DocStyle; weight: number }> = [
  { value: 'micro', weight: 30 },
  { value: 'memo', weight: 25 },
  { value: 'mixed', weight: 20 },
  { value: 'media_heavy', weight: 15 },
  { value: 'reflection', weight: 10 },
];

type Mem = { spaceKey: string; isAdmin?: boolean; isVeto?: boolean };

function traitFor(
  rng: () => number,
  tier: 'hero' | 'active' | 'background',
  role: SimRole,
  opts: {
    badFaith?: boolean;
    proxy?: boolean;
  },
): TraitVector {
  const activityLevel =
    tier === 'hero'
      ? 0.7 + rng() * 0.25
      : tier === 'active'
        ? 0.3 + rng() * 0.4
        : 0.05 + rng() * 0.25;

  const craftBase =
    role === 'maker' || role === 'technician'
      ? 0.55 + rng() * 0.35
      : role === 'designer'
        ? 0.35 + rng() * 0.35
        : role === 'researcher'
          ? 0.25 + rng() * 0.3
          : 0.2 + rng() * 0.4;

  const pedagogyFocus =
    role === 'pedagogue' ? 0.7 + rng() * 0.3 : rng() * 0.35;

  const gov =
    tier === 'hero'
      ? 0.5 + rng() * 0.5
      : tier === 'active'
        ? 0.2 + rng() * 0.3
        : rng() * 0.2;

  return {
    activityLevel,
    archiveBias: rng(),
    documentationStyle: pickWeighted(rng, DOC_STYLE_WEIGHTS),
    endorsementGiveRate: rng(),
    badFaithProbability: opts.badFaith ? 0.04 : 0,
    proxyTargetEligible: !!opts.proxy,
    governanceParticipation: gov,
    craftFocus: craftBase,
    pedagogyFocus,
  };
}

function buildSpaceSpecs(simRunId: string): SpaceSpec[] {
  const pg1 = heroAliasFor(simRunId, 'pedagogue_1');
  const ad1 = heroAliasFor(simRunId, 'admin_1');

  return [
    {
      key: 'university',
      title: 'University Hub',
      type: 'pedagogical',
      settings: {
        projectAccess: 'invite_only',
        privacyDefault: 'space_specific',
      },
    },
    {
      key: 'painting_hobby',
      title: 'Painting Studio',
      type: 'studio',
      parentKey: 'university',
      settings: {
        projectAccess: 'open',
        privacyDefault: 'space_specific',
      },
    },
    {
      key: 'electronics_hobby',
      title: 'Electronics Lab',
      type: 'studio',
      parentKey: 'university',
      settings: {
        projectAccess: 'open',
        privacyDefault: 'space_specific',
      },
    },
    {
      key: 'pottery_class',
      title: 'Pottery — Material Memory',
      type: 'pedagogical',
      parentKey: 'university',
      settings: {
        projectAccess: 'invite_only',
        privacyDefault: 'space_specific',
        minDocRequirements: ['skillwork', 'fabrication', 'reflection'],
        enforceStrictMinDoc: true,
        vetoAuthority: [pg1],
      },
    },
    {
      key: 'uiux_class',
      title: 'UI/UX Studio Practicum',
      type: 'pedagogical',
      parentKey: 'university',
      settings: {
        projectAccess: 'invite_only',
        privacyDefault: 'space_specific',
      },
    },
    {
      key: 'wood_workshop',
      title: 'Wood Workshop',
      type: 'pedagogical',
      parentKey: 'university',
      settings: {
        projectAccess: 'invite_only',
        privacyDefault: 'space_specific',
        customContracts: [
          {
            title: 'Workshop Safety Rules',
            body: 'Eye protection; dust control; power tool checkout — sim seed.',
            authorAlias: pg1,
          },
          {
            title: 'Tool Sign-Out Protocol',
            body: 'Sign tools in/out; report damage within 24h — sim seed.',
            authorAlias: pg1,
          },
        ],
        vetoAuthority: [heroAliasFor(simRunId, 'tech_1')],
      },
    },
    {
      key: 'blender_hobby',
      title: 'Blender Collective',
      type: 'studio',
      settings: {
        projectAccess: 'open',
        privacyDefault: 'public',
      },
    },
    {
      key: 'graphic_design_hobby',
      title: 'Graphic Design Lounge',
      type: 'studio',
      settings: {
        projectAccess: 'open',
        privacyDefault: 'public',
      },
    },
    {
      key: 'invite_studio',
      title: 'Invite-Only Studio',
      type: 'studio',
      settings: {
        projectAccess: 'invite_only',
        privacyDefault: 'space_specific',
      },
    },
    {
      key: 'open_studio',
      title: 'Open Studio',
      type: 'studio',
      settings: {
        projectAccess: 'open',
        privacyDefault: 'public',
      },
    },
    {
      key: 'application_collective',
      title: 'Application Collective',
      type: 'collective',
      settings: {
        projectAccess: 'application',
        privacyDefault: 'space_specific',
      },
    },
    {
      key: 'wood_studio_collab',
      title: 'Wood Studio Collaboration',
      type: 'studio',
      parentKey: 'wood_workshop',
      settings: {
        projectAccess: 'invite_only',
        privacyDefault: 'space_specific',
        customContracts: [
          {
            title: 'Joint Studio Collaboration Charter',
            body: 'Shared credit; joint safety; dispute path — sim seed.',
            authorAlias: ad1,
          },
        ],
        vetoAuthority: [heroAliasFor(simRunId, 'tech_1')],
      },
    },
  ];
}

function sortSpacesForSeed(spaces: SpaceSpec[]): SpaceSpec[] {
  const idx = new Map<string, number>(SPACE_KEYS_ORDER.map((k, i) => [k as string, i]));
  return [...spaces].sort((a, b) => (idx.get(a.key) ?? 99) - (idx.get(b.key) ?? 99));
}

function buildHeroNodes(simRunId: string): NodeSpec[] {
  const uni = 'university';
  const rng = mulberry32(seedFromString(simRunId + ':heroes'));
  const r = (): number => rng();

  function heroTraits(role: SimRole, opts: { badFaith?: boolean; proxy?: boolean }): TraitVector {
    return traitFor(r, 'hero', role, opts);
  }

  const nodes: NodeSpec[] = [
    {
      alias: h(simRunId, 'validator_1'),
      role: 'validator',
      tier: 'hero',
      traitVector: heroTraits('validator', {}),
      spaceMemberships: [{ spaceKey: uni }, { spaceKey: 'open_studio' }],
    },
    ...[1, 2, 3, 4].map((n) => {
      let mem: Mem[];
      if (n <= 3) {
        mem = [{ spaceKey: uni }, { spaceKey: 'pottery_class' }, { spaceKey: 'painting_hobby' }];
      } else {
        mem = [{ spaceKey: uni }, { spaceKey: 'wood_studio_collab' }, { spaceKey: 'wood_workshop' }];
      }
      return {
        alias: h(simRunId, `maker_${n}`),
        role: 'maker' as const,
        tier: 'hero' as const,
        traitVector: heroTraits('maker', {}),
        spaceMemberships: mem,
      };
    }),
    ...[1, 2, 3].map((n) => {
      const bad = n === 3;
      let mem: Mem[];
      if (n === 1) mem = [{ spaceKey: uni }, { spaceKey: 'pottery_class' }];
      else if (n === 2) {
        mem = [{ spaceKey: uni }, { spaceKey: 'wood_studio_collab' }, { spaceKey: 'graphic_design_hobby' }];
      } else {
        mem = [{ spaceKey: uni }, { spaceKey: 'uiux_class' }];
      }
      return {
        alias: h(simRunId, `designer_${n}`),
        role: 'designer' as const,
        tier: 'hero' as const,
        traitVector: heroTraits('designer', { badFaith: bad }),
        spaceMemberships: mem,
      };
    }),
    ...[1, 2].map((n) => ({
      alias: h(simRunId, `pedagogue_${n}`),
      role: 'pedagogue' as const,
      tier: 'hero' as const,
      traitVector: heroTraits('pedagogue', {}),
      spaceMemberships: [
        { spaceKey: uni },
        n === 1
          ? { spaceKey: 'pottery_class', isAdmin: true }
          : { spaceKey: 'uiux_class', isAdmin: true },
        { spaceKey: 'electronics_hobby' },
      ],
    })),
    ...[1, 2].map((n) => ({
      alias: h(simRunId, `researcher_${n}`),
      role: 'researcher' as const,
      tier: 'hero' as const,
      traitVector: heroTraits('researcher', {}),
      spaceMemberships:
        n === 1
          ? [{ spaceKey: uni }, { spaceKey: 'uiux_class' }, { spaceKey: 'electronics_hobby' }]
          : [{ spaceKey: uni }, { spaceKey: 'application_collective' }],
    })),
    ...[1, 2].map((n) => ({
      alias: h(simRunId, `admin_${n}`),
      role: 'admin' as const,
      tier: 'hero' as const,
      traitVector: heroTraits('admin', {}),
      spaceMemberships:
        n === 1
          ? [{ spaceKey: uni }, { spaceKey: 'wood_studio_collab', isAdmin: true }]
          : [{ spaceKey: uni }, { spaceKey: 'open_studio' }],
    })),
    {
      alias: h(simRunId, 'badactor_1'),
      role: 'maker',
      tier: 'hero',
      traitVector: heroTraits('maker', { badFaith: true }),
      spaceMemberships: [{ spaceKey: uni }, { spaceKey: 'graphic_design_hobby' }],
    },
    {
      alias: h(simRunId, 'badactor_2'),
      role: 'designer',
      tier: 'hero',
      traitVector: heroTraits('designer', { badFaith: true }),
      spaceMemberships: [{ spaceKey: uni }, { spaceKey: 'uiux_class' }],
    },
    {
      alias: h(simRunId, 'gmaker_1'),
      role: 'maker',
      tier: 'hero',
      traitVector: { ...heroTraits('maker', { proxy: true }), proxyTargetEligible: true },
      spaceMemberships: [{ spaceKey: uni }, { spaceKey: 'pottery_class' }, { spaceKey: 'painting_hobby' }],
    },
    {
      alias: h(simRunId, 'tech_1'),
      role: 'technician',
      tier: 'hero',
      traitVector: heroTraits('technician', {}),
      spaceMemberships: [
        { spaceKey: uni },
        { spaceKey: 'uiux_class' },
        { spaceKey: 'wood_workshop', isVeto: true },
        { spaceKey: 'wood_studio_collab', isVeto: true },
      ],
    },
  ];

  return nodes;
}

/** All Space keys-for-seed lookups */
const ALL_SPACE_KEYS = [
  'university',
  'painting_hobby',
  'electronics_hobby',
  'pottery_class',
  'uiux_class',
  'wood_workshop',
  'blender_hobby',
  'graphic_design_hobby',
  'invite_studio',
  'open_studio',
  'application_collective',
  'wood_studio_collab',
];

function pickMemberSpaces(rng: () => number, count: number): string[] {
  const keys = [...ALL_SPACE_KEYS];
  const picks: string[] = [];
  for (let c = 0; c < count; c++) {
    const ix = Math.floor(rng() * keys.length);
    const k = keys.splice(ix, 1)[0]!;
    picks.push(k);
  }
  return picks;
}

function buildActiveNodes(simRunId: string): NodeSpec[] {
  const rng = mulberry32(seedFromString(simRunId + ':active'));
  const uni = 'university';

  const out: NodeSpec[] = [];

  for (let i = 5; i <= 19; i++) {
    const ms = pickMemberSpaces(rng, 1 + Math.floor(rng() * 3));
    const mem: Mem[] = [{ spaceKey: uni }, ...ms.map((spaceKey) => ({ spaceKey }))];
    out.push({
      alias: heroAliasFor(simRunId, `maker_${i}`),
      role: 'maker',
      tier: 'active',
      traitVector: traitFor(rng, 'active', 'maker', {}),
      spaceMemberships: mem,
    });
  }

  for (let i = 4; i <= 13; i++) {
    const ms = pickMemberSpaces(rng, 1 + Math.floor(rng() * 3));
    const mem: Mem[] = [{ spaceKey: uni }, ...ms.map((spaceKey) => ({ spaceKey }))];
    out.push({
      alias: heroAliasFor(simRunId, `designer_${i}`),
      role: 'designer',
      tier: 'active',
      traitVector: traitFor(rng, 'active', 'designer', {}),
      spaceMemberships: mem,
    });
  }

  for (let i = 3; i <= 7; i++) {
    const ms = pickMemberSpaces(rng, 1 + Math.floor(rng() * 3));
    const mem: Mem[] = [{ spaceKey: uni }, ...ms.map((spaceKey) => ({ spaceKey }))];
    out.push({
      alias: heroAliasFor(simRunId, `pedagogue_${i}`),
      role: 'pedagogue',
      tier: 'active',
      traitVector: traitFor(rng, 'active', 'pedagogue', {}),
      spaceMemberships: mem,
    });
  }

  for (let i = 3; i <= 12; i++) {
    const ms = pickMemberSpaces(rng, 1 + Math.floor(rng() * 3));
    const mem: Mem[] = [{ spaceKey: uni }, ...ms.map((spaceKey) => ({ spaceKey }))];
    out.push({
      alias: heroAliasFor(simRunId, `researcher_${i}`),
      role: 'researcher',
      tier: 'active',
      traitVector: traitFor(rng, 'active', 'researcher', {}),
      spaceMemberships: mem,
    });
  }

  for (let i = 2; i <= 9; i++) {
    const ms = pickMemberSpaces(rng, 1 + Math.floor(rng() * 3));
    const mem: Mem[] = [{ spaceKey: uni }, ...ms.map((spaceKey) => ({ spaceKey }))];
    out.push({
      alias: heroAliasFor(simRunId, `tech_${i}`),
      role: 'technician',
      tier: 'active',
      traitVector: traitFor(rng, 'active', 'technician', {}),
      spaceMemberships: mem,
    });
  }

  for (let i = 1; i <= 4; i++) {
    const ms = pickMemberSpaces(rng, 1 + Math.floor(rng() * 3));
    const mem: Mem[] = [{ spaceKey: uni }, ...ms.map((spaceKey) => ({ spaceKey }))];
    out.push({
      alias: heroAliasFor(simRunId, `student_${i}`),
      role: 'student',
      tier: 'active',
      traitVector: traitFor(rng, 'active', 'student', {}),
      spaceMemberships: mem,
    });
  }

  return out;
}

function buildBackgroundNodes(simRunId: string): NodeSpec[] {
  const rng = mulberry32(seedFromString(simRunId + ':background'));
  const out: NodeSpec[] = [];

  for (let i = 20; i <= 48; i++) {
    const sk = ALL_SPACE_KEYS[Math.floor(rng() * ALL_SPACE_KEYS.length)]!;
    out.push({
      alias: heroAliasFor(simRunId, `maker_${i}`),
      role: 'maker',
      tier: 'background',
      traitVector: traitFor(rng, 'background', 'maker', { proxy: rng() < 0.12 }),
      spaceMemberships: [{ spaceKey: sk }],
    });
  }

  for (let i = 5; i <= 25; i++) {
    const sk = ALL_SPACE_KEYS[Math.floor(rng() * ALL_SPACE_KEYS.length)]!;
    out.push({
      alias: heroAliasFor(simRunId, `student_${i}`),
      role: 'student',
      tier: 'background',
      traitVector: traitFor(rng, 'background', 'student', { proxy: rng() < 0.12 }),
      spaceMemberships: [{ spaceKey: sk }],
    });
  }

  return out;
}

function ensurePlagiarismVictim(active: NodeSpec[], simRunId: string): void {
  const victim = active.find((n) => n.alias === heroAliasFor(simRunId, 'designer_4'));
  if (!victim) return;
  const has = victim.spaceMemberships.some((m) => m.spaceKey === 'graphic_design_hobby');
  if (!has) {
    victim.spaceMemberships.push({ spaceKey: 'graphic_design_hobby' });
  }
}

const BEATS: TimelineBeat[] = [
  { tick: 1, arcId: 'world', action: 'genesis', human: 'World genesis. Validators online.' },
  { tick: 2, arcId: 'world', action: 'spaces_open', human: 'Spaces formed. Membership rolls finalized.' },
  { tick: 5, arcId: 'healthy_with_fork', action: 'project_start', human: 'Pottery class begins "Material Memory"' },
  { tick: 7, arcId: 'healthy_with_fork', action: 'traces_logged', human: 'Pedagogue and makers log first traces' },
  { tick: 9, arcId: 'healthy_with_fork', action: 'pivot_recorded', human: 'A pivot is documented as intellectual work' },
  { tick: 11, arcId: 'healthy_with_fork', action: 'fork_created', human: 'Cross-Media collective forks the project' },
  { tick: 12, arcId: 'credit_dispute_tier2', action: 'credit_proposed', human: 'Designer proposes credit weights' },
  { tick: 14, arcId: 'credit_dispute_tier2', action: 'mediation_escalated', human: 'Dispute escalates to space moderators (Tier 2)' },
  { tick: 16, arcId: 'plagiarism_tier2', action: 'flag_filed', human: 'Plagiarism flag filed in Graphic Design hobby' },
  { tick: 18, arcId: 'plagiarism_tier2', action: 'panel_ruling', human: 'Panel rules: uphold. Reputation penalty applied.' },
  { tick: 20, arcId: 'plagiarism_tier2', action: 'retaliation_dismissed', human: 'Retaliation flag dismissed as false flagging' },
  { tick: 22, arcId: 'undercredit_tier3_unsolved', action: 'credit_proposed', human: 'Designer underweights technicians' },
  { tick: 24, arcId: 'undercredit_tier3_unsolved', action: 'mediation_escalated_t3', human: 'Mediation escalates to chain (Tier 3)' },
  { tick: 26, arcId: 'undercredit_tier3_unsolved', action: 'mediation_failed', human: 'Tier 3 fails. Project marked DISPUTED.' },
  { tick: 28, arcId: 'governance', action: 'proposal_posted', human: 'Researcher posts AI declaration proposal' },
  { tick: 30, arcId: 'governance', action: 'voting_opens', human: 'Voting opens, reputation weighted' },
  { tick: 32, arcId: 'governance', action: 'proposal_passed', human: 'Proposal passes. Rule applied chain-wide.' },
  { tick: 34, arcId: 'world', action: 'final', human: 'World quiescent. Counters finalized.' },
];

/**
 * Builds the deterministic Etch simulation world (12 spaces, ~120 nodes, arcs, beats).
 */
export function buildScenario(simRunId: string): SimulationScenario {
  const seed = seedFromString(simRunId);
  let spaces = buildSpaceSpecs(simRunId);
  spaces = sortSpacesForSeed(spaces);

  const heroes = buildHeroNodes(simRunId);
  const active = buildActiveNodes(simRunId);
  ensurePlagiarismVictim(active, simRunId);
  const background = buildBackgroundNodes(simRunId);
  const nodes = [...heroes, ...active, ...background];

  const arcs: ArcSpec[] = [
    {
      id: 'healthy_with_fork',
      spaceKey: 'pottery_class',
      primaryAlias: h(simRunId, 'pedagogue_1'),
      involvedAliases: [
        h(simRunId, 'pedagogue_1'),
        h(simRunId, 'maker_1'),
        h(simRunId, 'maker_2'),
        h(simRunId, 'maker_3'),
        h(simRunId, 'designer_1'),
        h(simRunId, 'gmaker_1'),
      ],
      startTick: 5,
    },
    {
      id: 'credit_dispute_tier2',
      spaceKey: 'wood_studio_collab',
      primaryAlias: h(simRunId, 'designer_2'),
      involvedAliases: [
        h(simRunId, 'designer_2'),
        h(simRunId, 'tech_1'),
        h(simRunId, 'maker_4'),
        h(simRunId, 'admin_1'),
      ],
      startTick: 12,
    },
    {
      id: 'plagiarism_tier2',
      spaceKey: 'graphic_design_hobby',
      primaryAlias: h(simRunId, 'badactor_1'),
      involvedAliases: [h(simRunId, 'badactor_1'), h(simRunId, 'designer_4')],
      startTick: 16,
    },
    {
      id: 'undercredit_tier3_unsolved',
      spaceKey: 'uiux_class',
      primaryAlias: h(simRunId, 'badactor_2'),
      involvedAliases: [
        h(simRunId, 'badactor_2'),
        h(simRunId, 'tech_1'),
        h(simRunId, 'researcher_1'),
      ],
      startTick: 22,
    },
    {
      id: 'governance',
      spaceKey: 'university',
      primaryAlias: h(simRunId, 'researcher_2'),
      involvedAliases: [
        h(simRunId, 'researcher_2'),
        h(simRunId, 'admin_2'),
        h(simRunId, 'validator_1'),
      ],
      startTick: 28,
    },
  ];

  return {
    simRunId,
    seed,
    spaces,
    nodes,
    arcs,
    beats: BEATS,
  };
}
