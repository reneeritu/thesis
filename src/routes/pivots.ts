import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { optionalAuth } from '../middleware/optionalAuth';
import { validate } from '../middleware/validate';
import { createPivotSchema } from '../schemas/pivot';
import { Pivot } from '../models/Pivot';
import { Project } from '../models/Project';
import { addBlock } from '../services/chain';
import { AuthRequest } from '../types';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors';
import { assertFullProcessLogReadable } from '../utils/projectAccess';

const router = Router();

/**
 * POST /pivots
 * PIVOT contract — records a change in direction without stopping the project.
 * Any contributor can log a pivot.
 */
router.post(
  '/',
  requireAuth,
  validate(createPivotSchema),
  async (req: AuthRequest, res: Response) => {
    const { projectId, reason } = req.body;
    const alias = req.node!.alias;

    const project = await Project.findById(projectId);
    if (!project) throw new NotFoundError('Project');
    if (project.status !== 'active') throw new AppError('Project is not active');

    const isContributor = project.contributors.some((c) => c.alias === alias);
    if (!isContributor) {
      throw new ForbiddenError('You are not a contributor on this project');
    }

    const block = await addBlock('pivot', alias, {
      projectId,
      reason,
    });

    const pivot = await Pivot.create({
      projectId,
      nodeAlias: alias,
      reason,
      blockIndex: block.index,
    });

    res.status(201).json(pivot);
  },
);

/**
 * GET /pivots/project/:projectId
 */
router.get(
  '/project/:projectId',
  optionalAuth,
  async (req: AuthRequest, res: Response) => {
    await assertFullProcessLogReadable(req.params.projectId, req);
    const pivots = await Pivot.find({ projectId: req.params.projectId }).sort({
      createdAt: 1,
    });
    res.json(pivots);
  },
);

export default router;
