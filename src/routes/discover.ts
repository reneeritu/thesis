/**
 * GET /discover/spaces  — public feed of all active spaces
 * GET /discover/projects — public feed of fully_public + process_visible projects
 * GET /discover/nodes   — public feed of active nodes (alias + keywords + interests)
 */
import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { Space } from '../models/Space';
import { Project } from '../models/Project';
import { ChainNode } from '../models/Node';
import { AuthRequest } from '../types';

const router = Router();

router.get('/spaces', requireAuth, async (req: AuthRequest, res: Response) => {
  const alias = req.node!.alias;
  const docs = await Space.find({ status: 'active' })
    .select('name description creatorAlias members admins settings createdAt')
    .sort({ createdAt: -1 })
    .lean();

  res.json(
    docs.map((s) => ({
      _id: String(s._id),
      name: s.name,
      description: s.description || '',
      creatorAlias: s.creatorAlias,
      memberCount: Array.isArray(s.members) ? s.members.length : 0,
      projectAccess: s.settings?.projectAccess || 'open',
      isMember: Array.isArray(s.members) ? s.members.includes(alias) : false,
      createdAt: s.createdAt,
    })),
  );
});

router.get('/projects', requireAuth, async (req: AuthRequest, res: Response) => {
  const alias = req.node!.alias;
  const docs = await Project.find({
    visibility: { $in: ['fully_public', 'process_visible'] },
    status: { $nin: ['archived'] },
  })
    .select('title status spaceId creatorAlias contributors visibility createdAt')
    .sort({ createdAt: -1 })
    .lean();

  res.json(
    docs.map((p) => ({
      _id: String(p._id),
      title: p.title,
      status: p.status,
      spaceId: String(p.spaceId),
      creatorAlias: p.creatorAlias,
      visibility: p.visibility,
      isContributor: Array.isArray(p.contributors)
        ? p.contributors.some((c: { alias: string }) => c.alias === alias)
        : false,
      createdAt: p.createdAt,
    })),
  );
});

router.get('/nodes', requireAuth, async (_req: AuthRequest, res: Response) => {
  const docs = await ChainNode.find({ status: 'active' })
    .select('alias interests keywords portfolioUrl reputationScore badges createdAt')
    .sort({ createdAt: -1 })
    .lean();

  res.json(
    docs.map((n) => ({
      alias: n.alias,
      interests: n.interests || [],
      keywords: n.keywords || [],
      portfolioUrl: n.portfolioUrl || '',
      reputationScore: n.reputationScore,
      badges: n.badges || [],
      joinedAt: n.createdAt,
    })),
  );
});

export default router;
