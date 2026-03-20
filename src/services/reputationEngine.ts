import { ChainNode } from '../models/Node';
import { chainDefaults } from '../config/defaults';
import { IReputationCategories } from '../models/Node';

type ReputationCategory = keyof IReputationCategories;

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

  node.reputationScore = clamp(node.reputationScore + points);

  if (category) {
    node.reputationCategories[category] = Math.min(
      chainDefaults.reputationCap,
      node.reputationCategories[category] + points,
    );
  }

  node.lastActiveAt = new Date();
  await node.save();
}

export async function onTraceCreated(
  alias: string,
  activityType: string,
): Promise<void> {
  const category = ACTIVITY_CATEGORY_MAP[activityType];
  await addReputationPoints(alias, POINTS.trace, category);

  if (activityType === 'skillwork' || activityType === 'fabrication') {
    const node = await ChainNode.findOne({ alias });
    if (node && !node.badges.includes('craft_affirmative')) {
      node.badges.push('craft_affirmative');
      await node.save();
    }
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