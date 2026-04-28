import mongoose from 'mongoose';
import type { ArcHandler, ArcContext } from './types';
import type { TimelineBeat } from '../types';
import { Project } from '../../../models/Project';
import type { IContributor } from '../../../models/Project';
import { Trace } from '../../../models/Trace';
import type { ActivityType, LogMode } from '../../../models/Trace';
import { Mediation } from '../../../models/Mediation';
import { addBlock } from '../../chain';
import { recordProject } from '../store';
import { advanceMediationDeadline } from '../timeAdvance';
import { heroAliasFor } from '../world';

const ARC_ID = 'undercredit_tier3_unsolved' as const;

function weightMap(entries: Array<[string, number]>) {
  return entries.map(([alias, w]) => ({ alias, weight: w }));
}

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

async function onCreditProposed(ctx: ArcContext, beat: TimelineBeat): Promise<void> {
  const spaceIdStr = ctx.state.spaceIdByKey.get('uiux_class');
  if (!spaceIdStr) {
    console.warn('[undercredit_tier3_unsolved] uiux_class space not seeded');
    return;
  }

  const arc = ctx.scenario.arcs.find((a) => a.id === ARC_ID);
  const badactor2 = heroAliasFor(ctx.state.simRunId, 'badactor_2');
  const tech1 = heroAliasFor(ctx.state.simRunId, 'tech_1');
  const researcher1 = heroAliasFor(ctx.state.simRunId, 'researcher_1');

  const extraAliases =
    arc?.involvedAliases.filter(
      (a) => a !== badactor2 && a !== tech1 && a !== researcher1,
    ) ?? [];

  const start = await addBlock('start', badactor2, {
    simRunId: ctx.state.simRunId,
    arc: ARC_ID,
    action: 'project_start',
    title: 'Inclusive Healthcare UI Toolkit',
  });

  const now = new Date();
  const contributors: IContributor[] = [
    {
      alias: badactor2,
      role: 'designer',
      isPrimary: true,
      signedAt: now,
      accepted: true,
      invitedAt: now,
    },
    {
      alias: tech1,
      role: 'technician',
      isPrimary: false,
      signedAt: null,
      accepted: null,
      invitedAt: now,
    },
    {
      alias: researcher1,
      role: 'researcher',
      isPrimary: false,
      signedAt: null,
      accepted: null,
      invitedAt: now,
    },
  ];

  for (let i = 0; i < Math.min(extraAliases.length, 3); i += 1) {
    contributors.push({
      alias: extraAliases[i],
      role: 'contributor',
      isPrimary: false,
      signedAt: null,
      accepted: null,
      invitedAt: now,
    });
  }

  const project = await Project.create({
    title: 'Inclusive Healthcare UI Toolkit',
    spaceId: new mongoose.Types.ObjectId(spaceIdStr),
    parentProjectId: null,
    creatorAlias: badactor2,
    contributors,
    context: 'Simulation: under-credited technicians (Tier 3 unsolved)',
    status: 'active',
    visibility: 'process_visible',
    startBlockIndex: start.index,
  });

  recordProject(ctx.state, 'undercredit_main', String(project._id));

  const projectOid = project._id;
  const projectIdStr = String(project._id);

  const traceRows: Array<{
    alias: string;
    activityType: ActivityType;
    mode: LogMode;
    description: string;
  }> = [
    {
      alias: badactor2,
      activityType: 'primary_research',
      mode: 'memo',
      description: 'IA maps and clinician interview synthesis',
    },
    {
      alias: tech1,
      activityType: 'fabrication',
      mode: 'micro',
      description: 'Frontend integration builds and accessibility pass',
    },
    {
      alias: researcher1,
      activityType: 'secondary_research',
      mode: 'reflection',
      description: 'Literature sweep on equitable care UI precedents',
    },
  ];

  for (const row of traceRows) {
    const tblock = await addBlock('trace', row.alias, {
      projectId: projectIdStr,
      simRunId: ctx.state.simRunId,
      arc: ARC_ID,
      activityType: row.activityType,
    });
    await Trace.create({
      projectId: projectOid,
      nodeAlias: row.alias,
      activityType: row.activityType,
      timestamp: new Date(),
      mode: row.mode,
      blockIndex: tblock.index,
      description: row.description,
      duration: 35,
    });
  }

  const mediationBlock = await addBlock('mediation', tech1, {
    simRunId: ctx.state.simRunId,
    arc: ARC_ID,
    action: 'credit_disputed_initial',
    projectId: projectIdStr,
  });

  const peerDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const placeholderNft = new mongoose.Types.ObjectId();

  const initialWeights = weightMap([
    [badactor2, 90],
    [tech1, 5],
    [researcher1, 5],
  ]);

  const m = await Mediation.create({
    projectId: project._id,
    spaceId: new mongoose.Types.ObjectId(spaceIdStr),
    triggerType: 'credit_dispute',
    triggeredBy: tech1,
    parties: [badactor2, tech1, researcher1],
    status: 'peer_to_peer',
    complexityLevel: 3,
    relatedEntityId: placeholderNft,
    relatedEntityType: 'nft',
    reason: 'Technicians did the bulk of the integration work and were credited only 5% each.',
    proposals: [
      {
        proposedBy: badactor2,
        description: 'Initial weights',
        weightMap: initialWeights,
        responses: [
          { alias: tech1, accepted: false, respondedAt: now },
          { alias: researcher1, accepted: false, respondedAt: now },
        ],
        createdAt: now,
      },
    ],
    revisedAgreement: null,
    peerDeadline,
    spaceDeadline: null,
    blockIndex: mediationBlock.index,
    resolutionBlockIndex: null,
  });

  recordProject(ctx.state, 'undercredit_mediation', String(m._id));

  ctx.emit({
    tick: beat.tick,
    type: `${ARC_ID}:credit_proposed`,
    human: 'Credit mediation opened: designer skews weights; technicians dissent',
  });
}

async function onMediationEscalatedT3(ctx: ArcContext, beat: TimelineBeat): Promise<void> {
  const mediationIdStr = ctx.state.projectIdByKey.get('undercredit_mediation');
  if (!mediationIdStr) {
    console.warn('[undercredit_tier3_unsolved] undercredit_mediation not in state');
    return;
  }

  const badactor2 = heroAliasFor(ctx.state.simRunId, 'badactor_2');
  const tech1 = heroAliasFor(ctx.state.simRunId, 'tech_1');
  const researcher1 = heroAliasFor(ctx.state.simRunId, 'researcher_1');

  const mediation = await Mediation.findById(mediationIdStr);
  if (!mediation) {
    console.warn('[undercredit_tier3_unsolved] mediation document missing');
    return;
  }

  mediation.status = 'space_escalated';
  mediation.spaceDeadline = new Date(Date.now() + 12 * 60 * 60 * 1000);

  const t2 = new Date();
  mediation.proposals.push({
    proposedBy: tech1,
    description: 'Fair share reflecting integration labor (space tier)',
    weightMap: weightMap([
      [badactor2, 40],
      [tech1, 40],
      [researcher1, 20],
    ]),
    responses: [{ alias: badactor2, accepted: false, respondedAt: t2 }],
    createdAt: t2,
  });

  await mediation.save();

  await advanceMediationDeadline(mediationIdStr, -24, ctx.state.simRunId);

  const afterAdvance = await Mediation.findById(mediationIdStr);
  if (!afterAdvance) {
    return;
  }
  afterAdvance.status = 'chain_escalated';
  await afterAdvance.save();

  await addBlock('mediation', tech1, {
    simRunId: ctx.state.simRunId,
    arc: ARC_ID,
    action: 'escalated_chain',
  });

  const t3 = new Date();
  afterAdvance.proposals.push({
    proposedBy: researcher1,
    description: 'Chain mediators propose revised integration credit split',
    weightMap: weightMap([
      [badactor2, 50],
      [tech1, 30],
      [researcher1, 20],
    ]),
    responses: [{ alias: badactor2, accepted: false, respondedAt: t3 }],
    createdAt: t3,
  });

  await afterAdvance.save();

  ctx.emit({
    tick: beat.tick,
    type: `${ARC_ID}:mediation_escalated_t3`,
    human: 'Tier 3: chain mediators take over.',
  });
}

async function onMediationFailed(ctx: ArcContext, beat: TimelineBeat): Promise<void> {
  const mediationIdStr = ctx.state.projectIdByKey.get('undercredit_mediation');
  const projectIdStr = ctx.state.projectIdByKey.get('undercredit_main');
  if (!mediationIdStr || !projectIdStr) {
    console.warn('[undercredit_tier3_unsolved] mediation or project missing from state');
    return;
  }

  const mediation = await Mediation.findById(mediationIdStr);
  if (!mediation) {
    console.warn('[undercredit_tier3_unsolved] mediation document missing');
    return;
  }

  const failBlock = await addBlock('mediation', 'system', {
    simRunId: ctx.state.simRunId,
    arc: ARC_ID,
    action: 'mediation_failed',
  });

  mediation.status = 'failed';
  mediation.resolutionBlockIndex = failBlock.index;
  await mediation.save();

  await Project.findByIdAndUpdate(projectIdStr, { $set: { status: 'disputed' } });

  ctx.emit({
    tick: beat.tick,
    type: `${ARC_ID}:mediation_failed`,
    human:
      'Tier 3 mediation failed. Project marked DISPUTED. No NFT minted; weights unresolved on chain.',
  });
}

export const undercreditTier3UnsolvedArc: ArcHandler = async (ctx, beat) => {
  switch (beat.action) {
    case 'credit_proposed':
      await wrap(ctx, beat, () => onCreditProposed(ctx, beat));
      break;
    case 'mediation_escalated_t3':
      await wrap(ctx, beat, () => onMediationEscalatedT3(ctx, beat));
      break;
    case 'mediation_failed':
      await wrap(ctx, beat, () => onMediationFailed(ctx, beat));
      break;
    default:
      ctx.emit({ tick: beat.tick, type: `${ARC_ID}:${beat.action}`, human: beat.human ?? '' });
  }
};
