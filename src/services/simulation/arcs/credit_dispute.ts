import mongoose from 'mongoose';
import type { ArcHandler, ArcContext } from './types';
import { Project } from '../../../models/Project';
import type { IContributor } from '../../../models/Project';
import { Trace } from '../../../models/Trace';
import type { ActivityType } from '../../../models/Trace';
import type { LogMode } from '../../../models/Trace';
import { Mediation } from '../../../models/Mediation';
import { NFT } from '../../../models/NFT';
import { addBlock } from '../../chain';
import { recordProject, bumpCounter } from '../store';
import { heroAliasFor } from '../world';

const ARC_ID = 'credit_dispute_tier2' as const;

function makeWeightMap(weights: Array<[string, number]>) {
  return weights.map(([alias, weight]) => ({ alias, weight }));
}

async function onCreditProposed(ctx: ArcContext, beat: { tick: number }): Promise<void> {
  const spaceIdStr = ctx.state.spaceIdByKey.get('wood_studio_collab');
  if (!spaceIdStr) {
    ctx.emit({
      tick: beat.tick,
      type: `${ARC_ID}:warning`,
      human: 'wood_studio_collab space not seeded — skipping credit dispute arc',
    });
    return;
  }

  const designer2 = heroAliasFor(ctx.state.simRunId, 'designer_2');
  const tech1 = heroAliasFor(ctx.state.simRunId, 'tech_1');
  const maker4 = heroAliasFor(ctx.state.simRunId, 'maker_4');
  const admin1 = heroAliasFor(ctx.state.simRunId, 'admin_1');

  const title = 'Studio Collaboration: Bent Wood Series';
  const start = await addBlock('start', designer2, {
    simRunId: ctx.state.simRunId,
    arc: ARC_ID,
    title,
  });

  const now = new Date();
  const contributors: IContributor[] = [
    {
      alias: designer2,
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
      alias: maker4,
      role: 'maker',
      isPrimary: false,
      signedAt: now,
      accepted: true,
      invitedAt: now,
    },
    {
      alias: admin1,
      role: 'mentor',
      isPrimary: false,
      signedAt: null,
      accepted: true,
      invitedAt: now,
    },
  ];

  const project = await Project.create({
    title,
    spaceId: new mongoose.Types.ObjectId(spaceIdStr),
    parentProjectId: null,
    creatorAlias: designer2,
    contributors,
    context: 'Credit-weight negotiation demo — bent wood furniture series',
    status: 'active',
    visibility: 'process_visible',
    startBlockIndex: start.index,
  });

  recordProject(ctx.state, 'credit_dispute_main', String(project._id));
  const projectIdStr = String(project._id);
  const projectOid = project._id;

  const traceRows: Array<{
    alias: string;
    activityType: ActivityType;
    mode: LogMode;
    description: string;
  }> = [
    {
      alias: designer2,
      activityType: 'fabrication',
      mode: 'micro',
      description: 'Curvature studies and lamination glue-up patterns',
    },
    {
      alias: tech1,
      activityType: 'skillwork',
      mode: 'memo',
      description: 'Steam-bending kiln cycles and clamp sequences',
    },
    {
      alias: maker4,
      activityType: 'iterate',
      mode: 'micro',
      description: 'Prototype forms and jig adjustments',
    },
    {
      alias: admin1,
      activityType: 'fabrication',
      mode: 'reflection',
      description: 'Mentor critique on bend radius vs grain runout',
    },
  ];

  for (const row of traceRows) {
    const block = await addBlock('trace', row.alias, {
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
      blockIndex: block.index,
      description: row.description,
      duration: 40,
    });
  }

  const initialWeights = makeWeightMap([
    [designer2, 60],
    [maker4, 25],
    [admin1, 10],
    [tech1, 5],
  ]);

  const placeholderNftOid = new mongoose.Types.ObjectId();

  const mediationBlock = await addBlock('mediation', designer2, {
    simRunId: ctx.state.simRunId,
    arc: ARC_ID,
    action: 'credit_proposed',
    projectId: projectIdStr,
    weightMap: initialWeights,
  });

  const peerDeadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const respondedAt = now;

  const mediation = await Mediation.create({
    projectId: project._id,
    spaceId: new mongoose.Types.ObjectId(spaceIdStr),
    triggerType: 'credit_dispute',
    triggeredBy: tech1,
    parties: [designer2, tech1, maker4, admin1],
    status: 'peer_to_peer',
    complexityLevel: 2,
    relatedEntityId: placeholderNftOid,
    relatedEntityType: 'nft',
    reason: 'Technician disputes 5% weight; they handled all bending and treatment work',
    proposals: [
      {
        proposedBy: designer2,
        description: 'Initial weight proposal',
        weightMap: initialWeights,
        responses: [
          { alias: tech1, accepted: false, respondedAt },
          { alias: maker4, accepted: true, respondedAt },
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

  ctx.state.projectIdByKey.set('credit_dispute_mediation', String(mediation._id));

  ctx.emit({
    tick: beat.tick,
    type: `${ARC_ID}:credit_proposed`,
    human: 'Designer proposes 60/25/10/5 weights — technician objects.',
  });
}

async function onMediationEscalated(ctx: ArcContext, beat: { tick: number }): Promise<void> {
  const projectIdStr = ctx.state.projectIdByKey.get('credit_dispute_main');
  const mediationIdStr = ctx.state.projectIdByKey.get('credit_dispute_mediation');
  if (!projectIdStr || !mediationIdStr) {
    ctx.emit({
      tick: beat.tick,
      type: `${ARC_ID}:warning`,
      human: 'credit dispute project/mediation ids missing — run credit_proposed first',
    });
    return;
  }

  const project = await Project.findById(projectIdStr);
  const mediation = await Mediation.findById(mediationIdStr);
  if (!project || !mediation) {
    ctx.emit({
      tick: beat.tick,
      type: `${ARC_ID}:warning`,
      human: 'project or mediation document not found — skipping escalation',
    });
    return;
  }

  const designer2 = heroAliasFor(ctx.state.simRunId, 'designer_2');
  const tech1 = heroAliasFor(ctx.state.simRunId, 'tech_1');
  const maker4 = heroAliasFor(ctx.state.simRunId, 'maker_4');
  const admin1 = heroAliasFor(ctx.state.simRunId, 'admin_1');

  mediation.status = 'space_escalated';
  mediation.spaceDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

  mediation.proposals.push({
    proposedBy: tech1,
    description: 'Revised counter-proposal',
    weightMap: makeWeightMap([
      [designer2, 35],
      [maker4, 25],
      [admin1, 15],
      [tech1, 25],
    ]),
    responses: [],
    createdAt: new Date(),
  });

  await addBlock('mediation', tech1, {
    simRunId: ctx.state.simRunId,
    arc: ARC_ID,
    action: 'escalated_to_space',
    mediationId: String(mediation._id),
    projectId: String(project._id),
  });

  await mediation.save();

  ctx.emit({
    tick: beat.tick,
    type: `${ARC_ID}:space_escalation`,
    human: 'Mediation escalated to wood_workshop moderators',
  });

  /** Tier 2 space moderators: compromise after review */
  const compromise = makeWeightMap([
    [designer2, 45],
    [maker4, 25],
    [admin1, 5],
    [tech1, 25],
  ]);
  mediation.revisedAgreement = compromise;
  mediation.status = 'resolved';

  const resolvedBlock = await addBlock('mediation', admin1, {
    simRunId: ctx.state.simRunId,
    arc: ARC_ID,
    action: 'resolved',
    mediationId: String(mediation._id),
    projectId: String(project._id),
    finalWeights: compromise,
  });
  mediation.resolutionBlockIndex = resolvedBlock.index;
  await mediation.save();
  bumpCounter(ctx.state, 'mediationsResolved', 1);

  const dup = await NFT.findOne({ projectId: project._id });
  if (dup) {
    ctx.emit({
      tick: beat.tick,
      type: `${ARC_ID}:tier2_resolved`,
      human:
        'Tier 2 mediation resolved — compromise weights agreed. Mediators reviewed; Tier 2 reached compromise with revised percentages (45/25/5/25).',
    });
    ctx.emit({
      tick: beat.tick,
      type: `${ARC_ID}:nft_skipped`,
      human: 'NFT already exists',
    });
  } else {
    const creditBlock = await addBlock('credit', designer2, {
      simRunId: ctx.state.simRunId,
      arc: ARC_ID,
      projectId: String(project._id),
      action: 'nft_credit_finalized',
    });

    await NFT.create({
      projectId: project._id,
      title: project.title,
      medium: 'wood',
      creators: [designer2],
      contributors: compromise.map((c) => ({
        alias: c.alias,
        role: 'contributor',
        weight: c.weight,
        timeLogged: 0,
      })),
      creditBlockIndex: creditBlock.index,
      disputed: false,
      status: 'active',
      processBlockIndices: [],
    });
    bumpCounter(ctx.state, 'nftsMinted', 1);

    ctx.emit({
      tick: beat.tick,
      type: `${ARC_ID}:tier2_resolved`,
      human:
        'Tier 2 mediation resolved — compromise weights agreed. Mediators reviewed; Tier 2 reached compromise with revised percentages (45/25/5/25); NFT minted with revised weights.',
    });
    ctx.emit({
      tick: beat.tick,
      type: `${ARC_ID}:nft_minted`,
      human: 'NFT minted: Bent Wood Series',
    });
  }

  project.status = 'completed';
  await project.save();
}

export const creditDisputeTier2Arc: ArcHandler = async (ctx, beat) => {
  try {
    switch (beat.action) {
      case 'credit_proposed':
        await onCreditProposed(ctx, beat);
        break;
      case 'mediation_escalated':
        await onMediationEscalated(ctx, beat);
        break;
      default:
        ctx.emit({
          tick: beat.tick,
          type: `${ARC_ID}:${beat.action}`,
          human: beat.human ?? '',
        });
    }
  } catch (err) {
    ctx.emit({
      tick: beat.tick,
      type: 'arc:error',
      human: `credit_dispute_tier2:${beat.action} failed — ${err instanceof Error ? err.message : 'unknown'}`,
    });
  }
};
