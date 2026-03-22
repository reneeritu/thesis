import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { startProjectSchema, addContributorSchema } from '../schemas/project';
import { Project } from '../models/Project';
import { Space } from '../models/Space';
import { ChainNode } from '../models/Node';
import { addBlock } from '../services/chain';
import { AuthRequest } from '../types';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors';

const router = Router();

/**
 * POST /projects
 * START contract — initialise a new project within a space.
 */
router.post(
  '/',
  requireAuth,
  validate(startProjectSchema),
  async (req: AuthRequest, res: Response) => {
    const { title, spaceId, contributors, context, pedagogicalId, mentorAlias, visibility } =
      req.body;
    const alias = req.node!.alias;

    const space = await Space.findById(spaceId);
    if (!space) throw new NotFoundError('Space');
    if (space.status === 'dormant') throw new AppError('Space is dormant');
    if (!space.members.includes(alias)) {
      throw new ForbiddenError('You are not a member of this space');
    }

    const contributorList = [
      { alias, role: 'creator', isPrimary: true, signedAt: new Date() },
    ];

    if (contributors) {
      for (const c of contributors) {
        if (c.alias === alias) continue;
        const exists = await ChainNode.findOne({ alias: c.alias, status: 'active' });
        if (!exists) throw new NotFoundError(`Contributor "${c.alias}"`);
        contributorList.push({
          alias: c.alias,
          role: c.role || 'contributor',
          isPrimary: c.isPrimary ?? false,
          signedAt: null as unknown as Date,
        });
      }
    }

    const block = await addBlock('start', alias, {
      title,
      spaceId,
      creatorAlias: alias,
      contributors: contributorList.map((c) => c.alias),
    });

    const project = await Project.create({
      title,
      spaceId,
      creatorAlias: alias,
      contributors: contributorList,
      context: context || '',
      pedagogicalId: pedagogicalId || '',
      mentorAlias: mentorAlias || '',
      visibility: visibility || 'space_only',
      startBlockIndex: block.index,
    });

    res.status(201).json(project);
  },
);

/**
 * GET /projects/space/:spaceId
 * List projects in a space. (Must be registered before GET /:id so "space" is not captured as id.)
 */
router.get(
  '/space/:spaceId',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const space = await Space.findById(req.params.spaceId);
    if (!space) throw new NotFoundError('Space');

    const projects = await Project.find({ spaceId: req.params.spaceId }).sort({
      createdAt: -1,
    });

    res.json(projects);
  },
);

/**
 * GET /projects/:id
 */
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw new NotFoundError('Project');

  res.json(project);
});

/**
 * POST /projects/:id/contributors
 * Add a contributor to an active project.
 */
router.post(
  '/:id/contributors',
  requireAuth,
  validate(addContributorSchema),
  async (req: AuthRequest, res: Response) => {
    const project = await Project.findById(req.params.id);
    if (!project) throw new NotFoundError('Project');

    if (project.status !== 'active') {
      throw new AppError('Project is not active');
    }

    const isPrimaryContributor = project.contributors.some(
      (c) => c.alias === req.node!.alias && c.isPrimary,
    );
    if (!isPrimaryContributor) {
      throw new ForbiddenError('Only primary contributors can add others');
    }

    const { alias, role, isPrimary } = req.body;

    if (project.contributors.some((c) => c.alias === alias)) {
      throw new AppError('Node is already a contributor');
    }

    const exists = await ChainNode.findOne({ alias, status: 'active' });
    if (!exists) throw new NotFoundError(`Node "${alias}"`);

    project.contributors.push({
      alias,
      role: role || 'contributor',
      isPrimary: isPrimary ?? false,
      signedAt: null,
    });
    await project.save();

    res.json(project);
  },
);

export default router;
