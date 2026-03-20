import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createTraceSchema, confirmProxySchema } from '../schemas/trace';
import { Trace } from '../models/Trace';
import { Project } from '../models/Project';
import { ChainNode } from '../models/Node';
import { addBlock } from '../services/chain';
import { chainDefaults } from '../config/defaults';
import { AuthRequest } from '../types';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors';

const router = Router();

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
    } = req.body;
    const alias = req.node!.alias;

    const project = await Project.findById(projectId);
    if (!project) throw new NotFoundError('Project');
    if (project.status !== 'active') throw new AppError('Project is not active');

    const isContributor = project.contributors.some((c) => c.alias === alias);
    if (!isContributor) {
      throw new ForbiddenError('You are not a contributor on this project');
    }

    const isProxy = mode === 'proxy';
    let proxyDeadline: Date | null = null;

    if (isProxy) {
      const target = await ChainNode.findOne({
        alias: proxyForAlias,
        status: 'active',
      });
      if (!target) throw new NotFoundError(`Proxy target "${proxyForAlias}"`);

      proxyDeadline = new Date();
      proxyDeadline.setDate(
        proxyDeadline.getDate() + chainDefaults.proxyLogConfirmDays,
      );
    }

    const traceTimestamp = timestamp ? new Date(timestamp) : new Date();

    const block = await addBlock('trace', alias, {
      projectId,
      nodeAlias: alias,
      activityType,
      timestamp: traceTimestamp.toISOString(),
      isProxy,
      proxyForAlias: proxyForAlias || null,
    });

    const trace = await Trace.create({
      projectId,
      nodeAlias: alias,
      activityType,
      otherDescription: otherDescription || '',
      timestamp: traceTimestamp,
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

    res.status(201).json(trace);
  },
);

/**
 * GET /traces/project/:projectId
 * List all traces for a project.
 */
router.get(
  '/project/:projectId',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const traces = await Trace.find({ projectId: req.params.projectId }).sort({
      timestamp: 1,
    });

    res.json(traces);
  },
);

/**
 * GET /traces/:id
 */
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const trace = await Trace.findById(req.params.id);
  if (!trace) throw new NotFoundError('Trace');

  res.json(trace);
});

/**
 * PATCH /traces/:id/proxy-confirm
 * The node being logged for confirms or disputes a proxy log.
 *
 * TODO: Proxy log auto-confirmation on deadline expiry is not yet enforced.
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
