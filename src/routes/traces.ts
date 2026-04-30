import mongoose from 'mongoose';
import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { optionalAuth } from '../middleware/optionalAuth';
import { validate } from '../middleware/validate';
import { createTraceSchema, confirmProxySchema } from '../schemas/trace';
import { Trace } from '../models/Trace';
import { Project } from '../models/Project';
import { Space } from '../models/Space';
import { ChainNode } from '../models/Node';
import { Media } from '../models/Media';
import { addBlock } from '../services/chain';
import { onTraceCreated } from '../services/reputationEngine';
import { chainDefaults } from '../config/defaults';
import { AuthRequest } from '../types';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors';
import { assertFullProcessLogReadable } from '../utils/projectAccess';

const router = Router();

function redactTraceForCaller(
  trace: any,
  callerAlias: string,
): Record<string, unknown> {
  const out = trace?.toObject ? trace.toObject() : { ...trace };

  const isOwner = out.nodeAlias === callerAlias;
  const ndaLocked =
    !isOwner &&
    (out.ndaSealed === true || String(out.ndaSealed) === 'true');
  const shouldRedact =
    !isOwner && (out.scopeLimited || out.contentFlagged || ndaLocked);

  if (shouldRedact) {
    // Redact content-bearing fields only; keep timestamps/hash/proof fields intact.
    out.otherDescription = '';
    out.description = '';
    out.mediaHash = '';
    out.duration = 0;
    out.toolSoftware = '';
  }

  return out;
}

/**
 * POST /traces
 * TRACE contract — log a unit of work on a project.
 */
router.post(
  '/',
  requireAuth,
  validate(createTraceSchema),
  async (req: AuthRequest, res: Response) => {
    const {
      projectId,
      activityType,
      otherDescription,
      timestamp,
      description,
      duration,
      toolSoftware,
      mode,
      proxyForAlias,
      mediaId,
    } = req.body;
    const alias = req.node!.alias;

    const project = await Project.findById(projectId);
    if (!project) throw new NotFoundError('Project');
    if (project.status !== 'active') throw new AppError('Project is not active');

    const isContributor = project.contributors.some((c) => c.alias === alias);
    if (!isContributor) {
      throw new ForbiddenError('You are not a contributor on this project');
    }

    const warnings: string[] = [];
    const space = await Space.findById(project.spaceId);
    const minReq = space?.settings?.minDocRequirements;
    if (
      Array.isArray(minReq) &&
      minReq.length > 0 &&
      !minReq.includes(activityType)
    ) {
      if (space?.settings?.enforceStrictMinDoc === true) {
        throw new AppError(`This space requires one of: ${minReq.join(', ')}`);
      }
      warnings.push('activityType not in space minDocRequirements');
    }

    const isProxy = mode === 'proxy';
    let proxyDeadline: Date | null = null;
    let proxyTarget: InstanceType<typeof ChainNode> | null = null;

    if (isProxy) {
      proxyTarget = await ChainNode.findOne({
        alias: proxyForAlias,
        status: 'active',
      });
      if (!proxyTarget) throw new NotFoundError(`Proxy target "${proxyForAlias}"`);

      proxyDeadline = new Date();
      proxyDeadline.setDate(
        proxyDeadline.getDate() + chainDefaults.proxyLogConfirmDays,
      );
    }

    const traceTimestamp = timestamp ? new Date(timestamp) : new Date();

    // Resolve mediaId → hash for chain integrity
    let resolvedMediaId: mongoose.Types.ObjectId | null = null;
    let resolvedMediaHash = '';
    if (mediaId && mongoose.Types.ObjectId.isValid(mediaId)) {
      const media = await Media.findById(mediaId);
      if (!media) throw new NotFoundError('Media attachment');
      if (media.uploaderAlias !== alias) {
        throw new ForbiddenError('You can only attach your own uploads as proof');
      }
      resolvedMediaId = media._id as mongoose.Types.ObjectId;
      resolvedMediaHash = media.hash;
      // Bind the media to this project if not already
      if (!media.projectId) {
        await Media.findByIdAndUpdate(mediaId, { projectId });
      }
    }

    const block = await addBlock('trace', alias, {
      projectId,
      nodeAlias: alias,
      activityType,
      timestamp: traceTimestamp.toISOString(),
      isProxy,
      proxyForAlias: proxyForAlias || null,
      mediaHash: resolvedMediaHash || null,
    });

    const trace = await Trace.create({
      projectId,
      nodeAlias: alias,
      activityType,
      otherDescription: otherDescription || '',
      timestamp: traceTimestamp,
      mediaHash: resolvedMediaHash,
      mediaId: resolvedMediaId,
      description: description || '',
      duration: duration || 0,
      toolSoftware: toolSoftware || '',
      isProxy,
      proxyForAlias: proxyForAlias || '',
      proxyConfirmed: !isProxy,
      proxyConfirmDeadline: proxyDeadline,
      mode: mode || 'micro',
      blockIndex: block.index,
    });

    await ChainNode.findOneAndUpdate(
      { alias },
      { $set: { lastActiveAt: new Date() } },
    );

    const reputationAlias =
      isProxy && proxyForAlias ? proxyForAlias : alias;
    await onTraceCreated(reputationAlias, activityType);

    const payload =
      warnings.length > 0
        ? { ...trace.toObject(), warnings }
        : trace;
    res.status(201).json(payload);
  },
);

/**
 * GET /traces/project/:projectId
 * List all traces for a project.
 */
router.get(
  '/project/:projectId',
  optionalAuth,
  async (req: AuthRequest, res: Response) => {
    await assertFullProcessLogReadable(req.params.projectId, req);

    const callerAlias = req.node?.alias ?? '';

    const traces = await Trace.find({ projectId: req.params.projectId }).sort({
      timestamp: 1,
    });

    const redacted = traces.map((t) =>
      redactTraceForCaller(t, callerAlias),
    );
    res.json(redacted);
  },
);

/**
 * GET /traces/:id
 */
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const trace = await Trace.findById(req.params.id);
  if (!trace) throw new NotFoundError('Trace');

  const callerAlias = req.node!.alias;

  // NDA seal: owner can read; everyone else gets 403.
  const isOwner = trace.nodeAlias === callerAlias;
  if (trace.ndaSealed && !isOwner) {
    throw new ForbiddenError('NDA sealed trace is not accessible to you');
  }

  const redacted = redactTraceForCaller(trace, callerAlias);
  res.json(redacted);
});

/**
 * PATCH /traces/:id/proxy-confirm
 * The node being logged for confirms or disputes a proxy log.
 *
 
 * The spec says silence = confirmation after proxyLogConfirmDays. A scheduled
 * job or middleware check needs to auto-confirm expired proxy logs. Until then,
 * unconfirmed proxies with passed deadlines remain in their current state.
 */
router.patch(
  '/:id/proxy-confirm',
  requireAuth,
  validate(confirmProxySchema),
  async (req: AuthRequest, res: Response) => {
    const trace = await Trace.findById(req.params.id);
    if (!trace) throw new NotFoundError('Trace');

    if (!trace.isProxy) throw new AppError('This trace is not a proxy log');
    if (trace.proxyForAlias !== req.node!.alias) {
      throw new ForbiddenError('Only the proxy target can confirm');
    }
    if (trace.proxyConfirmed) {
      throw new AppError('Proxy log already confirmed');
    }

    const { confirmed } = req.body;

    if (confirmed) {
      trace.proxyConfirmed = true;
      await trace.save();
      res.json({ message: 'Proxy log confirmed', trace });
    } else {
      trace.proxyConfirmed = false;
      await trace.save();
      res.json({
        message: 'Proxy log disputed — attribution flag raised',
        trace,
      });
    }
  },
);

export default router;
