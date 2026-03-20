import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { optionalAuth } from '../middleware/optionalAuth';
import { validate } from '../middleware/validate';
import {
  updateProfileSchema,
  updateTrusteesSchema,
  blockNodeSchema,
} from '../schemas/node';
import { ChainNode } from '../models/Node';
import { AuthRequest } from '../types';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors';

const router = Router();

/**
 * GET /nodes/:alias
 * Public profile. Hides score (shown only to self), respects blocks.
 */
router.get('/:alias', optionalAuth, async (req: AuthRequest, res: Response) => {
  const { alias } = req.params;

  const node = await ChainNode.findOne({ alias }).select(
    '-hashedPassword -seedHash -encryptedSeedPhrase',
  );
  if (!node) throw new NotFoundError('Node');

  if (node.status === 'removed') {
    throw new NotFoundError('Node');
  }

  if (req.node && node.blockedNodes.includes(req.node.alias)) {
    throw new ForbiddenError('You are blocked by this node');
  }

  const isSelf = req.node?.alias === alias;

  res.json({
    alias: node.alias,
    interests: node.interests,
    portfolioUrl: node.portfolioUrl,
    keywords: node.keywords,
    spaces: node.spaces,
    reputationCategories: node.reputationCategories,
    badges: node.badges,
    status: node.status,
    ...(isSelf && { reputationScore: node.reputationScore }),
  });
});

/**
 * PATCH /nodes/me
 * Update own profile (interests, portfolioUrl, keywords).
 */
router.patch(
  '/me',
  requireAuth,
  validate(updateProfileSchema),
  async (req: AuthRequest, res: Response) => {
    const updates: Record<string, unknown> = {};
    if (req.body.interests !== undefined) updates.interests = req.body.interests;
    if (req.body.portfolioUrl !== undefined) updates.portfolioUrl = req.body.portfolioUrl;
    if (req.body.keywords !== undefined) updates.keywords = req.body.keywords;

    const node = await ChainNode.findOneAndUpdate(
      { alias: req.node!.alias },
      { $set: updates },
      { new: true, select: '-hashedPassword -seedHash -encryptedSeedPhrase' },
    );
    if (!node) throw new NotFoundError('Node');

    res.json(node);
  },
);

/**
 * PUT /nodes/me/trustees
 * Set social recovery trustees (3-5 aliases).
 */
router.put(
  '/me/trustees',
  requireAuth,
  validate(updateTrusteesSchema),
  async (req: AuthRequest, res: Response) => {
    const { trustees } = req.body;

    if (trustees.includes(req.node!.alias)) {
      throw new AppError('Cannot add yourself as a trustee');
    }

    for (const alias of trustees) {
      const exists = await ChainNode.findOne({ alias, status: 'active' });
      if (!exists) {
        throw new NotFoundError(`Trustee node "${alias}"`);
      }
    }

    const node = await ChainNode.findOneAndUpdate(
      { alias: req.node!.alias },
      { $set: { trustees } },
      { new: true, select: '-hashedPassword -seedHash -encryptedSeedPhrase' },
    );

    res.json({ trustees: node!.trustees });
  },
);

/**
 * POST /nodes/me/block
 * Block another node from viewing profile or sending requests.
 */
router.post(
  '/me/block',
  requireAuth,
  validate(blockNodeSchema),
  async (req: AuthRequest, res: Response) => {
    const { targetAlias } = req.body;

    if (targetAlias === req.node!.alias) {
      throw new AppError('Cannot block yourself');
    }

    await ChainNode.findOneAndUpdate(
      { alias: req.node!.alias },
      { $addToSet: { blockedNodes: targetAlias } },
    );

    res.json({ message: `Blocked ${targetAlias}` });
  },
);

/**
 * DELETE /nodes/me/block/:targetAlias
 * Unblock a node.
 */
router.delete(
  '/me/block/:targetAlias',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    await ChainNode.findOneAndUpdate(
      { alias: req.node!.alias },
      { $pull: { blockedNodes: req.params.targetAlias } },
    );

    res.json({ message: `Unblocked ${req.params.targetAlias}` });
  },
);

export default router;
