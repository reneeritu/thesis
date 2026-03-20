import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createReferenceSchema } from '../schemas/reference';
import { Reference } from '../models/Reference';
import { Project } from '../models/Project';
import { addBlock } from '../services/chain';
import { AuthRequest } from '../types';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors';

const router = Router();

/**
 * POST /references
 * REFERENCE contract — credits inspiration, sources, and pedagogical lineage.
 *
 * Immutable once submitted: cannot be edited or removed.
 * Maker declares the relationship themselves.
 */
router.post(
  '/',
  requireAuth,
  validate(createReferenceSchema),
  async (req: AuthRequest, res: Response) => {
    const {
      projectId,
      sourceProjectId,
      externalUrl,
      citation,
      relationshipType,
      otherExplanation,
    } = req.body;
    const alias = req.node!.alias;

    const project = await Project.findById(projectId);
    if (!project) throw new NotFoundError('Project');
    if (!['active', 'completed', 'halted'].includes(project.status)) {
      throw new AppError('Project must be active, completed, or halted to add references');
    }

    const isContributor = project.contributors.some((c) => c.alias === alias);
    if (!isContributor) {
      throw new ForbiddenError('You are not a contributor on this project');
    }

    const block = await addBlock('reference', alias, {
      projectId,
      sourceProjectId: sourceProjectId || null,
      externalUrl: externalUrl || null,
      citation: citation || null,
      relationshipType,
    });

    const reference = await Reference.create({
      projectId,
      nodeAlias: alias,
      sourceProjectId: sourceProjectId || '',
      externalUrl: externalUrl || '',
      citation: citation || '',
      relationshipType,
      otherExplanation: otherExplanation || '',
      blockIndex: block.index,
    });

    res.status(201).json(reference);
  },
);

/**
 * GET /references/project/:projectId
 */
router.get(
  '/project/:projectId',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const refs = await Reference.find({ projectId: req.params.projectId }).sort({
      createdAt: 1,
    });
    res.json(refs);
  },
);

/**
 * GET /references/:id
 * No update or delete endpoints — references are immutable per spec.
 */
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const ref = await Reference.findById(req.params.id);
  if (!ref) throw new NotFoundError('Reference');
  res.json(ref);
});

export default router;
