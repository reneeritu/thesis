import mongoose from 'mongoose';
import type { ArcHandler, ArcContext } from './types';
import type { TimelineBeat } from '../types';
import { Project } from '../../../models/Project';
import { Trace } from '../../../models/Trace';
import type { ActivityType, LogMode } from '../../../models/Trace';
import type { IContributor } from '../../../models/Project';
import { NFT } from '../../../models/NFT';
import { addBlock } from '../../chain';
import { recordProject, bumpCounter } from '../store';
import { heroAliasFor } from '../world';

const ARC_ID = 'healthy_with_fork' as const;

async function mintNftIfReady(
  ctx: ArcContext,
  parent: { _id: mongoose.Types.ObjectId; title: string; contributors: IContributor[] },
): Promise<void> {
  // Wave 5 may mint elsewhere; duplicate guard for unique projectId.
  const dup = await NFT.findOne({ projectId: parent._id });
  if (dup) return;

  const ped = heroAliasFor(ctx.state.simRunId, 'pedagogue_1');
  const credit = await addBlock('credit', ped, {
    projectId: String(parent._id),
    simRunId: ctx.state.simRunId,
    arc: ARC_ID,
    title: parent.title,
  });

  const n = Math.max(1, parent.contributors.length);
  const w = 1 / n;
  const contributorsWeighted = parent.contributors.map((c) => ({
    alias: c.alias,
    role: c.role || 'contributor',
    weight: w,
    timeLogged: 0,
  }));
  const creatorAliases = parent.contributors.map((c) => c.alias);

  await NFT.create({
    projectId: parent._id,
    title: parent.title,
    creators: creatorAliases,
    contributors: contributorsWeighted,
    processBlockIndices: [],
    disputed: false,
    status: 'active',
    creditBlockIndex: credit.index,
  });
  bumpCounter(ctx.state, 'nftsMinted', 1);
}

function wrap(
  ctx: ArcContext,
  beat: TimelineBeat,
  label: string,
  fn: () => Promise<void>,
): Promise<void> {
  return (async () => {
    try {
      await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.emit({
        tick: beat.tick,
        type: 'arc:error',
        human: `${label}: ${msg}`,
      });
    }
  })();
}

async function onProjectStart(ctx: ArcContext, beat: TimelineBeat): Promise<void> {
  const arc = ctx.scenario.arcs.find((a) => a.id === ARC_ID);
  if (!arc) {
    ctx.emit({
      tick: beat.tick,
      type: 'healthy:warning',
      human: 'healthy_with_fork arc spec missing from scenario',
    });
    return;
  }

  const pedagogue1 = heroAliasFor(ctx.state.simRunId, 'pedagogue_1');
  if (
    ctx.state.heroNodeAliases.length > 0 &&
    !ctx.state.heroNodeAliases.includes(pedagogue1)
  ) {
    ctx.emit({
      tick: beat.tick,
      type: 'healthy:warning',
      human: 'pedagogue_1 not present in hero nodes for this run — skipping project_start',
    });
    return;
  }

  const spaceIdStr = ctx.state.spaceIdByKey.get('pottery_class');
  if (!spaceIdStr) {
    ctx.emit({ tick: beat.tick, type: 'healthy:warning', human: 'pottery_class space not seeded' });
    return;
  }

  const title = 'Material Memory: Clay Field Studies';
  const start = await addBlock('start', pedagogue1, {
    projectId: 'tbd',
    simRunId: ctx.state.simRunId,
    arc: ARC_ID,
    title,
  });

  const mk = (suffix: string) => heroAliasFor(ctx.state.simRunId, suffix);
  const aliases = {
    pedagogue: mk('pedagogue_1'),
    m1: mk('maker_1'),
    m2: mk('maker_2'),
    m3: mk('maker_3'),
    designer: mk('designer_1'),
    gmaker: mk('gmaker_1'),
  };

  const now = new Date();
  const contributors: IContributor[] = [
    {
      alias: aliases.pedagogue,
      role: 'pedagogue',
      isPrimary: true,
      signedAt: now,
      accepted: true,
      invitedAt: now,
    },
    {
      alias: aliases.m1,
      role: 'maker',
      isPrimary: false,
      signedAt: null,
      accepted: null,
      invitedAt: now,
    },
    {
      alias: aliases.m2,
      role: 'maker',
      isPrimary: false,
      signedAt: null,
      accepted: null,
      invitedAt: now,
    },
    {
      alias: aliases.m3,
      role: 'maker',
      isPrimary: false,
      signedAt: null,
      accepted: null,
      invitedAt: now,
    },
    {
      alias: aliases.designer,
      role: 'designer',
      isPrimary: false,
      signedAt: null,
      accepted: null,
      invitedAt: now,
    },
    {
      alias: aliases.gmaker,
      role: 'contributor',
      isPrimary: false,
      signedAt: null,
      accepted: null,
      invitedAt: now,
    },
  ];

  const project = await Project.create({
    title,
    spaceId: new mongoose.Types.ObjectId(spaceIdStr),
    parentProjectId: null,
    creatorAlias: aliases.pedagogue,
    contributors,
    context: 'Healthy collaboration trace for simulation demo',
    status: 'active',
    visibility: 'process_visible',
    startBlockIndex: start.index,
  });

  recordProject(ctx.state, 'healthy_main', String(project._id));
  ctx.emit({
    tick: beat.tick,
    type: 'healthy:project_started',
    human: `Pedagogue ${aliases.pedagogue} kicks off "Material Memory" with 5 contributors`,
  });
}

async function onTracesLogged(ctx: ArcContext, beat: TimelineBeat): Promise<void> {
  const projectIdStr = ctx.state.projectIdByKey.get('healthy_main');
  if (!projectIdStr) {
    ctx.emit({
      tick: beat.tick,
      type: 'healthy:warning',
      human: 'healthy_main project not found — skipping traces',
    });
    return;
  }

  const projectOid = new mongoose.Types.ObjectId(projectIdStr);
  const mk = (s: string) => heroAliasFor(ctx.state.simRunId, s);

  const rows: Array<{
    suffix: string;
    activityType: ActivityType;
    mode: LogMode;
    description: string;
  }> = [
    { suffix: 'pedagogue_1', activityType: 'pedagogy', mode: 'micro', description: 'Session framing and learning goals' },
    { suffix: 'maker_1', activityType: 'fabrication', mode: 'micro', description: 'Wedging and first forms' },
    { suffix: 'maker_2', activityType: 'skillwork', mode: 'micro', description: 'Wheel practice — cylinders' },
    { suffix: 'maker_3', activityType: 'iterate', mode: 'micro', description: 'Iterating wall thickness' },
    { suffix: 'designer_1', activityType: 'primary_research', mode: 'memo', description: 'Field notes on surface texture' },
    { suffix: 'gmaker_1', activityType: 'review', mode: 'reflection', description: 'Reflecting on batch consistency' },
  ];

  for (const row of rows) {
    const nodeAlias = mk(row.suffix);
    const block = await addBlock('trace', nodeAlias, {
      projectId: projectIdStr,
      simRunId: ctx.state.simRunId,
      arc: ARC_ID,
      activityType: row.activityType,
    });
    await Trace.create({
      projectId: projectOid,
      nodeAlias,
      activityType: row.activityType,
      timestamp: new Date(),
      mode: row.mode,
      blockIndex: block.index,
      description: row.description,
      duration: 30,
    });
  }

  const ped = mk('pedagogue_1');
  const gmakerTarget = mk('gmaker_1');
  const proxyBlock = await addBlock('trace', ped, {
    projectId: projectIdStr,
    simRunId: ctx.state.simRunId,
    arc: ARC_ID,
    activityType: 'pedagogy',
    isProxy: true,
  });
  await Trace.create({
    projectId: projectOid,
    nodeAlias: ped,
    activityType: 'pedagogy',
    timestamp: new Date(),
    mode: 'proxy',
    blockIndex: proxyBlock.index,
    description: 'Studio hours logged on behalf of guest maker',
    duration: 30,
    isProxy: true,
    proxyForAlias: gmakerTarget,
    proxyConfirmDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  ctx.emit({
    tick: beat.tick,
    type: 'healthy:traces_summary',
    human: 'Logged 6 contributor traces plus one proxy pedagogy entry for the studio',
  });
}

async function onPivotRecorded(ctx: ArcContext, beat: TimelineBeat): Promise<void> {
  const projectIdStr = ctx.state.projectIdByKey.get('healthy_main');
  if (!projectIdStr) {
    ctx.emit({ tick: beat.tick, type: 'healthy:warning', human: 'healthy_main project not found' });
    return;
  }

  const ped = heroAliasFor(ctx.state.simRunId, 'pedagogue_1');
  await addBlock('pivot', ped, {
    projectId: projectIdStr,
    simRunId: ctx.state.simRunId,
    arc: ARC_ID,
    fromMaterial: 'plain clay',
    toMaterial: 'wax-resist with iron oxide',
  });

  ctx.emit({
    tick: beat.tick,
    type: 'healthy:pivot',
    human: 'Pivoted materials toward wax-resist with iron oxide',
  });
}

async function onForkCreated(ctx: ArcContext, beat: TimelineBeat): Promise<void> {
  const parentIdStr = ctx.state.projectIdByKey.get('healthy_main');
  if (!parentIdStr) {
    ctx.emit({ tick: beat.tick, type: 'healthy:warning', human: 'healthy_main parent project not found' });
    return;
  }

  const parent = await Project.findById(parentIdStr);
  if (!parent) {
    ctx.emit({ tick: beat.tick, type: 'healthy:warning', human: 'parent project document missing' });
    return;
  }

  const designer = heroAliasFor(ctx.state.simRunId, 'designer_1');
  const maker2 = heroAliasFor(ctx.state.simRunId, 'maker_2');

  const forkBlock = await addBlock('fork', designer, {
    projectId: String(parent._id),
    simRunId: ctx.state.simRunId,
    arc: ARC_ID,
    title: 'Material Memory · Cross-Media Fork',
  });

  const now = new Date();
  const fork = await Project.create({
    title: 'Material Memory · Cross-Media Fork',
    spaceId: parent.spaceId,
    parentProjectId: parent._id,
    creatorAlias: designer,
    contributors: [
      {
        alias: designer,
        role: 'designer',
        isPrimary: true,
        signedAt: now,
        accepted: true,
        invitedAt: now,
      },
      {
        alias: maker2,
        role: 'collaborator',
        isPrimary: false,
        signedAt: null,
        accepted: null,
        invitedAt: now,
      },
    ],
    context: 'Fork exploring cross-media reinterpretation',
    status: 'active',
    visibility: 'fully_public',
    startBlockIndex: forkBlock.index,
  });

  recordProject(ctx.state, 'healthy_fork', String(fork._id));

  // TODO(Wave 5): additional NFT beats if scenario extends — parent mint anchors demo completion here.
  await mintNftIfReady(ctx, parent);

  ctx.emit({
    tick: beat.tick,
    type: 'healthy:fork_created',
    human: `${designer} forked "${parent.title}" into a cross-media line; parent completion NFT minted when applicable`,
  });
}

export const healthyArc: ArcHandler = async (ctx, beat) => {
  switch (beat.action) {
    case 'project_start':
      await wrap(ctx, beat, 'healthy:project_start', () => onProjectStart(ctx, beat));
      break;
    case 'traces_logged':
      await wrap(ctx, beat, 'healthy:traces_logged', () => onTracesLogged(ctx, beat));
      break;
    case 'pivot_recorded':
      await wrap(ctx, beat, 'healthy:pivot_recorded', () => onPivotRecorded(ctx, beat));
      break;
    case 'fork_created':
      await wrap(ctx, beat, 'healthy:fork_created', () => onForkCreated(ctx, beat));
      break;
    default:
      ctx.emit({ tick: beat.tick, type: `healthy:${beat.action}`, human: beat.human ?? '' });
  }
};
