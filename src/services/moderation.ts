import mongoose from 'mongoose';
import { ChainNode, type IReputationCategories } from '../models/Node';
import { Space } from '../models/Space';
import { ModerationPanel } from '../models/ModerationPanel';
import { Flag, IFlag } from '../models/Flag';
import { addBlock } from './chain';
import { chainDefaults } from '../config/defaults';
import { REPUTATION_CATEGORY_KEYS } from '../utils/reputationAggregate';

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Reputation-weighted random selection.
 * Picks `count` items from `pool`, each weighted by `reputationScore`.
 */
function weightedRandomSelect(
  pool: { alias: string; reputationScore: number }[],
  count: number,
): string[] {
  const selected: string[] = [];
  const remaining = [...pool];

  const pick = Math.min(count, remaining.length);
  for (let i = 0; i < pick; i++) {
    const totalWeight = remaining.reduce((s, n) => s + Math.max(n.reputationScore, 1), 0);
    let rand = Math.random() * totalWeight;

    let chosenIdx = 0;
    for (let j = 0; j < remaining.length; j++) {
      rand -= Math.max(remaining[j].reputationScore, 1);
      if (rand <= 0) {
        chosenIdx = j;
        break;
      }
    }

    selected.push(remaining[chosenIdx].alias);
    remaining.splice(chosenIdx, 1);
  }

  return selected;
}

/**
 * Select moderator candidates for a panel.
 *
 * 1. Finds eligible nodes (active, in relevant space or chain-wide for L4)
 * 2. Excludes parties, already-paneled nodes, blocked nodes
 * 3. Weights by reputationScore
 * 4. Returns `requiredCount * inviteMultiplier` aliases
 */
export async function selectModerators(
  spaceId: mongoose.Types.ObjectId | null,
  complexityLevel: 1 | 2 | 3 | 4,
  excludeAliases: string[],
): Promise<string[]> {
  const requiredCount = chainDefaults.moderatorCountByLevel[complexityLevel] || 0;
  const excludeSet = new Set(excludeAliases);

  let memberFilter: string[] | null = null;
  if (complexityLevel < 4 && spaceId) {
    const space = await Space.findById(spaceId).select('members').lean();
    if (space) {
      memberFilter = space.members;
    }
  }

  const query: Record<string, unknown> = {
    status: 'active',
    alias: { $nin: Array.from(excludeSet) },
  };
  if (memberFilter) {
    query.alias = { $nin: Array.from(excludeSet), $in: memberFilter };
  }

  const candidates = await ChainNode.find(query)
    .select('alias reputationScore')
    .lean();

  if (complexityLevel === 4 || requiredCount === 0) {
    return candidates.map((c) => c.alias);
  }

  const inviteCount = requiredCount * chainDefaults.moderatorInviteMultiplier;
  return weightedRandomSelect(candidates, inviteCount);
}

/**
 * Create a ModerationPanel for a flag and invite moderators.
 */
export async function assignPanel(
  flag: IFlag,
  panelLevel: number,
  overrideComplexity?: 1 | 2 | 3 | 4,
  extraExcludes?: string[],
): Promise<InstanceType<typeof ModerationPanel>> {
  const level = overrideComplexity ?? flag.complexityLevel;
  const requiredCount = chainDefaults.moderatorCountByLevel[level] || 0;

  const parties = [flag.raisedBy];
  const excludes = [...parties, ...(extraExcludes || [])];

  const existingPanels = await ModerationPanel.find({ flagId: flag._id });
  for (const p of existingPanels) {
    for (const m of p.acceptedModerators) {
      excludes.push(m.alias);
    }
  }

  const invited = await selectModerators(
    flag.spaceId,
    level,
    excludes,
  );

  const timeLockHours = chainDefaults.mediationTimeLockHours[level] ?? 168;

  const panel = await ModerationPanel.create({
    flagId: flag._id,
    panelLevel,
    complexityLevel: level,
    requiredModerators: requiredCount === 0 ? invited.length : requiredCount,
    invitedModerators: invited.map((alias) => ({ alias, invitedAt: new Date() })),
    acceptedModerators: [],
    exclusionRequests: [],
    ruling: null,
    timeLockExpiry: addHours(new Date(), timeLockHours),
    status: 'awaiting_moderators',
  });

  if (flag.status === 'open' || flag.status === 'appealed') {
    flag.status = 'panel_assigned';
    await flag.save();
  }

  return panel;
}

/**
 * Auto-classify flag complexity based on spec criteria.
 */
export function classifyFlagComplexity(
  flagCategory: string,
  flagType: string,
  targetType: string,
  nodesInvolved: number,
  crossSpace: boolean,
  hasNFT: boolean,
): 1 | 2 | 3 | 4 {
  if (flagType === 'classification_appeal' || flagCategory === 'governance') return 4;
  if (crossSpace || hasNFT || targetType === 'nft') return 3;
  if (nodesInvolved > 2 || flagCategory === 'attribution') return 2;
  return 1;
}

/**
 * Apply a reputation penalty to a node, respecting the floor.
 */
export async function applyReputationPenalty(alias: string, penalty: number): Promise<void> {
  const node = await ChainNode.findOne({ alias });
  if (!node) return;
  const cats = (node.reputationCategories || {}) as IReputationCategories;
  // Remove penalty from categories largest-first so the derived aggregate drops immediately.
  let remaining = Math.max(0, penalty);
  const entries = REPUTATION_CATEGORY_KEYS.map((k) => ({
    k,
    v: Math.max(0, Number(cats[k] ?? 0)),
  })).sort((a, b) => b.v - a.v);

  for (const e of entries) {
    if (remaining <= 0) break;
    const take = Math.min(e.v, remaining);
    cats[e.k] = e.v - take;
    remaining -= take;
  }

  node.reputationCategories = cats;
  await node.save();
}

/**
 * Suspend a node (set status to 'suspended').
 */
export async function suspendNode(alias: string): Promise<void> {
  await ChainNode.updateOne({ alias }, { $set: { status: 'suspended' } });
}

/**
 * Record a flag action on the chain.
 */
export async function recordFlagBlock(
  alias: string,
  data: Record<string, unknown>,
): Promise<number> {
  const block = await addBlock('flag', alias, data);
  return block.index;
}
