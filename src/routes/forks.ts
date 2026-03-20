import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { forkProjectSchema } from '../schemas/fork';
import { Project } from '../models/Project';
import { Space } from '../models/Space';
import { ChainNode } from '../models/Node';
import { addBlock } from '../services/chain';
import { AuthRequest } from '../types';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors';

const router = Router();

/**
 * POST /forks
 * FORK contract — creates a new project branched from an existing one.
 *
 * Rules from spec:
 *   - Lineage link between parent and child is permanent
 *   - Parent contributors notified (tracked via inheritedFrom field)
 *   - Inherited credit preserved and visible
 *   - Forked projects do NOT inherit reputation from parent
 *   - Forks of dormant spaces carry a visible lineage marker
 */
router.post(
  '/',
  requireAuth,
  validate(forkProjectSchema),
  async (req: AuthRequest, res: Response) => {
    const { parentProjectId, title, forkReason, inheritedContributors, targetSpaceId } =
      req.body;
    const alias = req.node!.alias;

    const parent = await Project.findById(parentProjectId);
    if (!parent) throw new NotFoundError('Parent project');

    const parentSpace = await Space.findById(parent.spaceId);
    if (!parentSpace) throw new NotFoundError('Parent space');

    const targetSpace = targetSpaceId
      ? await Space.findById(targetSpaceId)
      : parentSpace;
    if (!targetSpace) throw new NotFoundError('Target space');

    if (!targetSpace.members.includes(alias)) {
      throw new ForbiddenError('You must be a member of the target space');
    }

    const inherited = ((inheritedContributors || []) as string[])
      .filter((a) => parent.contributors.some((c) => c.alias === a))
      .map((a) => {
        const orig = parent.contributors.find((c) => c.alias === a)!;
        return {
          alias: a,
          role: `inherited:${orig.role}`,
          isPrimary: false,
          signedAt: null as unknown as Date,
        };
      });

    const contributorList = [
      { alias, role: 'creator', isPrimary: true, signedAt: new Date() },
      ...inherited,
    ];

    // TODO: Parent contributor notification — notify parent contributors of the fork
    // once the outreach/notification system is implemented (Phase 3+).

    const block = await addBlock('fork', alias, {
      parentProjectId,
      targetSpaceId: targetSpace._id.toString(),
      forkReason,
      inheritedContributors: inherited.map((c) => c.alias),
      isDormantSpaceFork: parentSpace.status === 'dormant',
    });

    const forked = await Project.create({
      title,
      spaceId: targetSpace._id,
      parentProjectId: parent._id,
      creatorAlias: alias,
      contributors: contributorList,
      context: `Forked from: ${parent.title} (${parentProjectId}). Reason: ${forkReason}`,
      pedagogicalId: parent.pedagogicalId,
      mentorAlias: parent.mentorAlias,
      visibility: parent.visibility,
      startBlockIndex: block.index,
    });

    res.status(201).json({
      forkedProject: forked,
      parentProjectId,
      targetSpaceId: targetSpace._id,
      lineageMarker: parentSpace.status === 'dormant' ? 'dormant_space_fork' : 'standard_fork',
    });
  },
);

/**
 * GET /forks/parent/:parentProjectId
 * List all forks of a given parent project.
 */
router.get(
  '/parent/:parentProjectId',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const forks = await Project.find({
      parentProjectId: req.params.parentProjectId,
    }).sort({ createdAt: -1 });

    res.json(forks);
  },
);

export default router;
