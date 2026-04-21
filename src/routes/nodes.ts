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
import { Space } from '../models/Space';
import { Project } from '../models/Project';
import { Trace } from '../models/Trace';
import { NFT } from '../models/NFT';
import { AuthRequest } from '../types';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors';

/**
 * Activity-to-category map, duplicated here to avoid depending on the engine's internal
 * constant shape. Keep in sync with reputationEngine.ACTIVITY_CATEGORY_MAP.
 */
const ACTIVITY_TO_CATEGORY: Record<string, keyof RecentCategories> = {
  skillwork: 'craft',
  fabrication: 'craft',
  primary_research: 'research',
  secondary_research: 'research',
  brainstorm: 'research',
  iterate: 'research',
  pedagogy: 'pedagogy',
  admin: 'consistency',
  review: 'consistency',
  ai_tool: 'research',
  other: 'consistency',
};

type RecentCategories = {
  craft: number;
  research: number;
  collaboration: number;
  pedagogy: number;
  consistency: number;
  community: number;
};

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

  let spacesWithNames: { id: string; name: string }[] = [];
  if (node.spaces && node.spaces.length > 0) {
    const spaceDocs = await Space.find({ _id: { $in: node.spaces } }).select('name').lean();
    const nameById = new Map(spaceDocs.map((s) => [String(s._id), s.name as string]));
    spacesWithNames = node.spaces.map((id) => ({
      id: String(id),
      name: nameById.get(String(id)) || String(id),
    }));
  }

  const portfolioProjects = await Project.find({
    status: { $in: ['completed', 'archived'] },
    $or: [{ creatorAlias: alias }, { 'contributors.alias': alias }],
  })
    .select('title _id')
    .sort({ updatedAt: -1 })
    .lean();

  const pids = portfolioProjects.map((p) => p._id);
  const nftsForProjects =
    pids.length > 0 ? await NFT.find({ projectId: { $in: pids } }).select('projectId _id').lean() : [];
  const nftIdByProject = new Map(nftsForProjects.map((n) => [String(n.projectId), String(n._id)]));

  const completedProjects = portfolioProjects.map((p) => ({
    title: p.title,
    projectId: String(p._id),
    nftId: nftIdByProject.get(String(p._id)) || null,
  }));

  res.json({
    alias: node.alias,
    interests: node.interests,
    portfolioUrl: node.portfolioUrl,
    keywords: node.keywords,
    spaces: node.spaces,
    spacesWithNames,
    reputationCategories: node.reputationCategories,
    badges: node.badges,
    status: node.status,
    completedProjects,
    ...(isSelf && { reputationScore: node.reputationScore }),
  });
});

/**
 * GET /nodes/:alias/reputation/recent?days=90
 *
 * Approximate reputation-by-category slice for the last N days. Computed by scanning
 * traces authored (or proxy-logged to) this alias in the window and summing 1 point per
 * trace under the mapped category. This is the lightweight "motion = recent change"
 * overlay the radar shows; it intentionally omits project completions / attestations,
 * which move the all-time polygon but are sparse relative to trace cadence.
 */
router.get('/:alias/reputation/recent', optionalAuth, async (req: AuthRequest, res: Response) => {
  const { alias } = req.params;
  const rawDays = Number.parseInt(String(req.query.days ?? '90'), 10);
  const days = Number.isFinite(rawDays) && rawDays > 0 && rawDays <= 365 ? rawDays : 90;

  const node = await ChainNode.findOne({ alias }).select('_id status blockedNodes');
  if (!node || node.status === 'removed') throw new NotFoundError('Node');
  if (req.node && node.blockedNodes?.includes(req.node.alias)) {
    throw new ForbiddenError('You are blocked by this node');
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const traces = await Trace.find({
    $or: [
      { nodeAlias: alias, timestamp: { $gte: since } },
      { proxyForAlias: alias, proxyConfirmed: true, timestamp: { $gte: since } },
    ],
  })
    .select('activityType')
    .lean();

  const cats: RecentCategories = {
    craft: 0,
    research: 0,
    collaboration: 0,
    pedagogy: 0,
    consistency: 0,
    community: 0,
  };

  for (const t of traces) {
    const cat = ACTIVITY_TO_CATEGORY[t.activityType];
    if (cat) cats[cat] += 1;
  }

  res.json({ days, since, traceCount: traces.length, categories: cats });
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
