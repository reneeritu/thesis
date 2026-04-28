import mongoose from 'mongoose';
import type { ArcHandler, ArcContext } from './types';
import type { TimelineBeat } from '../types';
import { Project } from '../../../models/Project';
import type { IContributor } from '../../../models/Project';
import { Flag } from '../../../models/Flag';
import { ChainNode } from '../../../models/Node';
import { addBlock } from '../../chain';
import { recordProject } from '../store';
import { advanceFlagPanelDeadline } from '../timeAdvance';
import { heroAliasFor } from '../world';

const ARC_ID = 'plagiarism_tier2' as const;

function wrap(
  ctx: ArcContext,
  beat: TimelineBeat,
  fn: () => Promise<void>,
): Promise<void> {
  return (async () => {
    try {
      await fn();
    } catch (err) {
      ctx.emit({
        tick: beat.tick,
        type: 'arc:error',
        human: `${ARC_ID}:${beat.action} failed — ${err instanceof Error ? err.message : 'unknown'}`,
      });
    }
  })();
}

async function safeChainNodeId(alias: string): Promise<mongoose.Types.ObjectId> {
  const n = await ChainNode.findOne({ alias }).select('_id').lean();
  return n?._id ?? new mongoose.Types.ObjectId();
}

async function onFlagFiled(ctx: ArcContext, beat: TimelineBeat): Promise<void> {
  const spaceIdStr = ctx.state.spaceIdByKey.get('graphic_design_hobby');
  if (!spaceIdStr) {
    console.warn('[plagiarism_tier2] graphic_design_hobby space not seeded');
    return;
  }

  const arc = ctx.scenario.arcs.find((a) => a.id === ARC_ID);
  const badactor1 = heroAliasFor(ctx.state.simRunId, 'badactor_1');
  let victim =
    arc?.involvedAliases.find((a) => a !== badactor1) ??
    heroAliasFor(ctx.state.simRunId, 'designer_4');

  const spaceOid = new mongoose.Types.ObjectId(spaceIdStr);
  const now = new Date();

  const startOff = await addBlock('start', badactor1, {
    simRunId: ctx.state.simRunId,
    arc: ARC_ID,
    action: 'project_start_offending',
    title: 'Lost Cosmonaut Poster (rip)',
  });

  const contributorsOff: IContributor[] = [
    {
      alias: badactor1,
      role: 'designer',
      isPrimary: true,
      signedAt: now,
      accepted: true,
      invitedAt: now,
    },
  ];

  const offending = await Project.create({
    title: 'Lost Cosmonaut Poster (rip)',
    spaceId: spaceOid,
    parentProjectId: null,
    creatorAlias: badactor1,
    contributors: contributorsOff,
    context: 'Simulation: copied poster (plagiarism arc)',
    status: 'active',
    visibility: 'fully_public',
    startBlockIndex: startOff.index,
  });

  recordProject(ctx.state, 'plagiarism_offending', String(offending._id));

  const startOrig = await addBlock('start', victim, {
    simRunId: ctx.state.simRunId,
    arc: ARC_ID,
    action: 'project_start_original',
    title: 'Lost Cosmonaut · Original Series',
  });

  const contributorsVict: IContributor[] = [
    {
      alias: victim,
      role: 'designer',
      isPrimary: true,
      signedAt: now,
      accepted: true,
      invitedAt: now,
    },
  ];

  const original = await Project.create({
    title: 'Lost Cosmonaut · Original Series',
    spaceId: spaceOid,
    parentProjectId: null,
    creatorAlias: victim,
    contributors: contributorsVict,
    context: 'Simulation: prior original series (plagiarism arc)',
    status: 'active',
    visibility: 'fully_public',
    startBlockIndex: startOrig.index,
  });

  recordProject(ctx.state, 'plagiarism_original', String(original._id));

  const flagBlock = await addBlock('flag', victim, {
    simRunId: ctx.state.simRunId,
    arc: ARC_ID,
    flagType: 'plagiarism',
    targetProjectId: String(offending._id),
  });

  const flag = await Flag.create({
    flagCategory: 'attribution',
    flagType: 'plagiarism',
    targetType: 'project',
    targetId: offending._id,
    raisedBy: victim,
    spaceId: spaceOid,
    isInsideMember: true,
    complexityLevel: 2,
    status: 'open',
    reason:
      'This poster copies my Lost Cosmonaut series almost verbatim. See blocks X..Y for original lineage.',
    blockIndex: flagBlock.index,
  });

  ctx.state.projectIdByKey.set('plagiarism_flag', String(flag._id));

  ctx.emit({
    tick: beat.tick,
    type: `${ARC_ID}:flag_filed`,
    human: `Plagiarism flag filed by ${victim} against ${badactor1}'s poster project`,
  });
}

async function onPanelRuling(ctx: ArcContext, beat: TimelineBeat): Promise<void> {
  const flagIdStr = ctx.state.projectIdByKey.get('plagiarism_flag');
  if (!flagIdStr) {
    console.warn('[plagiarism_tier2] plagiarism_flag not in state');
    return;
  }

  const flagDoc = await Flag.findById(flagIdStr);
  if (!flagDoc) {
    console.warn('[plagiarism_tier2] flag document missing');
    return;
  }

  await addBlock('flag', 'system', {
    simRunId: ctx.state.simRunId,
    arc: ARC_ID,
    action: 'panel_assigned',
    flagId: flagIdStr,
  });

  flagDoc.status = 'panel_assigned';
  await flagDoc.save();

  await advanceFlagPanelDeadline(flagIdStr, -24, ctx.state.simRunId);

  flagDoc.status = 'ruled';
  await flagDoc.save();

  await addBlock('flag', 'system', {
    simRunId: ctx.state.simRunId,
    arc: ARC_ID,
    action: 'rule_uphold',
    flagId: flagIdStr,
    ruling: 'plagiarism_confirmed',
  });

  const badactor1 = heroAliasFor(ctx.state.simRunId, 'badactor_1');
  try {
    await ChainNode.findOneAndUpdate(
      { alias: badactor1 },
      { $inc: { 'reputationCategories.craft': -40, reputationScore: -40 } },
    );
  } catch {
    /* best-effort */
  }

  const offendingId = ctx.state.projectIdByKey.get('plagiarism_offending');
  if (offendingId) {
    await Project.findByIdAndUpdate(offendingId, { $set: { status: 'disputed' } });
  }

  ctx.emit({
    tick: beat.tick,
    type: `${ARC_ID}:panel_ruling`,
    human: 'Panel rules: plagiarism upheld',
  });

  ctx.emit({
    tick: beat.tick,
    type: `${ARC_ID}:reputation_penalty`,
    human: 'Reputation penalty applied: -40 craft to badactor_1',
  });
}

async function onRetaliationDismissed(ctx: ArcContext, beat: TimelineBeat): Promise<void> {
  const spaceIdStr = ctx.state.spaceIdByKey.get('graphic_design_hobby');
  if (!spaceIdStr) {
    console.warn('[plagiarism_tier2] graphic_design_hobby space not seeded');
    return;
  }

  const badactor1 = heroAliasFor(ctx.state.simRunId, 'badactor_1');
  const arc = ctx.scenario.arcs.find((a) => a.id === ARC_ID);
  let victim =
    arc?.involvedAliases.find((a) => a !== badactor1) ??
    heroAliasFor(ctx.state.simRunId, 'designer_4');

  const retalBlock = await addBlock('flag', badactor1, {
    simRunId: ctx.state.simRunId,
    arc: ARC_ID,
    action: 'retaliation_filed',
  });

  const victimNodeId = await safeChainNodeId(victim);
  const spaceOid = new mongoose.Types.ObjectId(spaceIdStr);

  const retalFlag = await Flag.create({
    flagCategory: 'governance',
    flagType: 'false_flagging',
    targetType: 'node',
    targetId: victimNodeId,
    raisedBy: badactor1,
    spaceId: spaceOid,
    isInsideMember: true,
    complexityLevel: 2,
    status: 'open',
    reason: 'Original flag was retaliation, the work is mine.',
    blockIndex: retalBlock.index,
  });

  retalFlag.status = 'closed';
  await retalFlag.save();

  await addBlock('flag', 'system', {
    simRunId: ctx.state.simRunId,
    arc: ARC_ID,
    action: 'rule_dismiss_false_flag',
    flagId: String(retalFlag._id),
    ruling: 'retaliation_dismissed',
    note: 'Bad-faith false flag; dismissed with falseEmergencyFlagPenalty pathway',
  });

  try {
    await ChainNode.findOneAndUpdate(
      { alias: badactor1 },
      { $inc: { 'reputationCategories.community': -25, reputationScore: -25 } },
    );
  } catch {
    /* best-effort */
  }

  ctx.emit({
    tick: beat.tick,
    type: `${ARC_ID}:retaliation_dismissed`,
    human: 'Retaliation flag dismissed; reputation slashed for false flagging.',
  });
}

export const plagiarismTier2Arc: ArcHandler = async (ctx, beat) => {
  switch (beat.action) {
    case 'flag_filed':
      await wrap(ctx, beat, () => onFlagFiled(ctx, beat));
      break;
    case 'panel_ruling':
      await wrap(ctx, beat, () => onPanelRuling(ctx, beat));
      break;
    case 'retaliation_dismissed':
      await wrap(ctx, beat, () => onRetaliationDismissed(ctx, beat));
      break;
    default:
      ctx.emit({ tick: beat.tick, type: `${ARC_ID}:${beat.action}`, human: beat.human ?? '' });
  }
};
