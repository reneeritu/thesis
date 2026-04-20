import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { Endorsement, ENDORSEMENT_KINDS } from '../models/Endorsement';
import { Trace } from '../models/Trace';
import { Project } from '../models/Project';
import { AuthRequest } from '../types';
import { AppError, NotFoundError } from '../utils/errors';

const router = Router();

const createSchema = z.object({
  traceId: z.string().min(1),
  kind: z.enum(ENDORSEMENT_KINDS),
  note: z.string().max(500).optional(),
});

/**
 * POST /endorsements
 * Endorse a trace — one endorsement per (trace, alias, kind).
 * The endorser must not be the trace author (no self-endorsement).
 */
router.post(
  '/',
  requireAuth,
  validate(createSchema),
  async (req: AuthRequest, res: Response) => {
    const { traceId, kind, note } = req.body as { traceId: string; kind: string; note?: string };
    const alias = req.node!.alias;

    const trace = await Trace.findById(traceId);
    if (!trace) throw new NotFoundError('Trace');
    if (trace.nodeAlias === alias) throw new AppError('Cannot endorse your own trace');

    try {
      const endorsement = await Endorsement.create({
        traceId: trace._id,
        projectId: trace.projectId,
        endorserAlias: alias,
        kind,
        note: note ?? '',
      });
      res.status(201).json(endorsement);
    } catch (err) {
      const e = err as { code?: number };
      if (e.code === 11000) {
        throw new AppError('You have already endorsed this trace with that kind');
      }
      throw err;
    }
  },
);

/**
 * DELETE /endorsements/:id
 * Remove your own endorsement.
 */
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const e = await Endorsement.findById(req.params.id);
  if (!e) throw new NotFoundError('Endorsement');
  if (e.endorserAlias !== req.node!.alias) throw new AppError('Not your endorsement');
  await e.deleteOne();
  res.json({ ok: true });
});

/**
 * GET /endorsements/trace/:traceId
 * List endorsements on a trace.
 */
router.get('/trace/:traceId', requireAuth, async (req: AuthRequest, res: Response) => {
  const list = await Endorsement.find({ traceId: req.params.traceId }).sort({ createdAt: -1 });
  res.json(list);
});

/**
 * GET /endorsements/project/:projectId
 * List endorsements for every trace in a project (for timeline summary).
 */
router.get('/project/:projectId', requireAuth, async (req: AuthRequest, res: Response) => {
  const p = await Project.findById(req.params.projectId).select('_id').lean();
  if (!p) throw new NotFoundError('Project');
  const list = await Endorsement.find({ projectId: req.params.projectId }).sort({ createdAt: -1 });
  res.json(list);
});

export default router;
