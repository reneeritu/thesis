import type { UpdateQuery } from 'mongoose';
import { ChainNode, IChainNode, IReputationCategories } from '../models/Node';
import { chainDefaults } from '../config/defaults';

type ReputationCategory = keyof IReputationCategories;

const EMPTY_CATEGORIES: IReputationCategories = {
  craft: 0,
  research: 0,
  collaboration: 0,
  pedagogy: 0,
  consistency: 0,
  community: 0,
};

/** Legacy / partial docs may omit subdocs; avoid silent no-ops or throws on increment. */
function ensureReputationFields(node: IChainNode): void {
  if (!Array.isArray(node.badges)) {
    node.badges = [];
  }
  if (!node.reputationCategories || typeof node.reputationCategories !== 'object') {
    node.reputationCategories = { ...EMPTY_CATEGORIES };
    return;
  }
  (Object.keys(EMPTY_CATEGORIES) as ReputationCategory[]).forEach((k) => {
    if (typeof node.reputationCategories[k] !== 'number' || Number.isNaN(node.reputationCategories[k])) {
      node.reputationCategories[k] = 0;
    }
  });
}

const ACTIVITY_CATEGORY_MAP: Partial<Record<string, ReputationCategory>> = {
  skillwork: 'craft',
  fabrication: 'craft',
  primary_research: 'research',
  secondary_research: 'research',
  brainstorm: 'research',
  iterate: 'research',
  pedagogy: 'pedagogy',
  admin: 'consistency',
  review: 'consistency',
  ai_tool: 'research',
  other: 'consistency',
};

const POINTS = {
  trace: 1,
  completed_project: 10,
  cross_space_project: 5,
  attestation_given: 2,
  attestation_received_independent: 5,
  attestation_received_collaborator: 2,
};

function clamp(value: number): number {
  return Math.min(
    chainDefaults.reputationCap,
    Math.max(chainDefaults.reputationFloor, value),
  );
}

export async function addReputationPoints(
  alias: string,
  points: number,
  category?: ReputationCategory,
): Promise<void> {
  const node = await ChainNode.findOne({ alias });
  if (!node || node.status !== 'active') return;

  ensureReputationFields(node);

  const baseScore =
    typeof node.reputationScore === 'number' && !Number.isNaN(node.reputationScore)
      ? node.reputationScore
      : chainDefaults.reputationBaseScore;
  node.reputationScore = clamp(baseScore + points);

  if (category) {
    const prev = node.reputationCategories[category] || 0;
    node.reputationCategories[category] = Math.min(
      chainDefaults.reputationCap,
      prev + points,
    );
  }

  node.lastActiveAt = new Date();
  await node.save();
}

/**
 * Apply trace reputation + craft badge in one atomic DB update ($inc / $addToSet).
 * Avoids find()+save() edge cases; falls back to { alias } if _id filter matches nothing.
 *
 * @param aliasForFallback — canonical alias for the reputation subject (proxy target alias when proxy).
 */
export async function onTraceCreated(
  nodeId: string,
  aliasForFallback: string,
  activityType: string,
): Promise<void> {
  const category = ACTIVITY_CATEGORY_MAP[activityType];
  const inc: Record<string, number> = {
    reputationScore: POINTS.trace,
  };
  if (category) {
    inc[`reputationCategories.${category}`] = POINTS.trace;
  }

  const update: UpdateQuery<IChainNode> = {
    $inc: inc,
    $set: { lastActiveAt: new Date() },
  };

  if (activityType === 'skillwork' || activityType === 'fabrication') {
    update.$addToSet = { badges: 'craft_affirmative' };
  }

  let doc = await ChainNode.findOneAndUpdate(
    { _id: nodeId, status: 'active' },
    update,
    { new: true },
  );
  if (!doc) {
    doc = await ChainNode.findOneAndUpdate(
      { alias: aliasForFallback, status: 'active' },
      update,
      { new: true },
    );
  }

  if (!doc && process.env.NODE_ENV === 'development') {
    console.warn('[reputation] onTraceCreated: no document updated', {
      nodeId,
      aliasForFallback,
    });
  }
}

export async function onProjectCompleted(
  contributors: { alias: string; role: string }[],
  isCrossSpace: boolean,
): Promise<void> {
  for (const contributor of contributors) {
    const points = isCrossSpace
      ? POINTS.completed_project + POINTS.cross_space_project
      : POINTS.completed_project;

    const category: ReputationCategory =
      contributors.length > 1 ? 'collaboration' : 'consistency';

    await addReputationPoints(contributor.alias, points, category);
  }
}

export async function onForkCreated(alias: string): Promise<void> {
  await addReputationPoints(alias, POINTS.trace, 'collaboration');
}

export async function onAttestationCreated(
  attesterAlias: string,
  attesteeAlias: string,
  isIndependent: boolean,
): Promise<void> {
  await addReputationPoints(attesterAlias, POINTS.attestation_given, 'community');

  const points = isIndependent
    ? POINTS.attestation_received_independent
    : POINTS.attestation_received_collaborator;

  await addReputationPoints(attesteeAlias, points, 'community');
}

export async function runReputationDecay(): Promise<void> {
  const graceMs =
    chainDefaults.reputationGraceMonths * 30 * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - graceMs);

  const inactiveNodes = await ChainNode.find({
    status: 'active',
    lastActiveAt: { $lte: cutoff },
  });

  for (const node of inactiveNodes) {
    node.reputationScore = clamp(
      node.reputationScore - chainDefaults.reputationDecayPerMonth,
    );
    await node.save();
  }

  console.log(`[reputationDecay] Decayed ${inactiveNodes.length} inactive nodes`);
}