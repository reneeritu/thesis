/**
 * GET /discover/spaces   — public feed of all active spaces
 * GET /discover/projects — public feed of fully_public + process_visible projects
 * GET /discover/nodes    — public feed of active nodes (alias + keywords + interests)
 *
 * All three support `?q=<search>&limit=<N>&offset=<M>` and return the same
 * envelope shape: `{ items, total, limit, offset }`. `q` is a
 * case-insensitive anchored-or-contains match on the feed's most useful
 * human-readable field (name / title / alias). Limit is clamped to
 * [1, MAX_LIMIT] with a sensible default so a newly seeded DB can't flood
 * the client with hundreds of rows.
 */
import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { Space } from '../models/Space';
import { Project } from '../models/Project';
import { ChainNode } from '../models/Node';
import { AuthRequest } from '../types';

const router = Router();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** Pulls + clamps `q`, `limit`, `offset` from the querystring. */
function parsePaging(req: AuthRequest): { q: string; limit: number; offset: number } {
  const qRaw = String(req.query.q ?? '').trim();
  // Cap the search needle so we don't build absurd regexes.
  const q = qRaw.slice(0, 80);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.parseInt(String(req.query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
  );
  const offset = Math.max(0, Number.parseInt(String(req.query.offset ?? 0), 10) || 0);
  return { q, limit, offset };
}

/** Escapes regex metachars so user input can be used safely inside `new RegExp(...)`. */
function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.get('/spaces', requireAuth, async (req: AuthRequest, res: Response) => {
  const alias = req.node!.alias;
  const { q, limit, offset } = parsePaging(req);

  const filter: Record<string, unknown> = { status: 'active' };
  if (q) {
    const re = new RegExp(escRe(q), 'i');
    filter.$or = [{ name: re }, { description: re }];
  }

  const total = await Space.countDocuments(filter);
  const docs = await Space.find(filter)
    .select('name description creatorAlias members admins settings createdAt')
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  res.json({
    items: docs.map((s) => ({
      _id: String(s._id),
      name: s.name,
      description: s.description || '',
      creatorAlias: s.creatorAlias,
      memberCount: Array.isArray(s.members) ? s.members.length : 0,
      projectAccess: s.settings?.projectAccess || 'open',
      isMember: Array.isArray(s.members) ? s.members.includes(alias) : false,
      createdAt: s.createdAt,
    })),
    total,
    limit,
    offset,
  });
});

router.get('/projects', requireAuth, async (req: AuthRequest, res: Response) => {
  const alias = req.node!.alias;
  const { q, limit, offset } = parsePaging(req);

  const filter: Record<string, unknown> = {
    visibility: { $in: ['fully_public', 'process_visible'] },
    status: { $nin: ['archived'] },
  };
  if (q) {
    filter.title = new RegExp(escRe(q), 'i');
  }

  const total = await Project.countDocuments(filter);
  const docs = await Project.find(filter)
    .select('title status spaceId creatorAlias contributors visibility createdAt')
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  res.json({
    items: docs.map((p) => ({
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
    total,
    limit,
    offset,
  });
});

router.get('/nodes', requireAuth, async (req: AuthRequest, res: Response) => {
  const { q, limit, offset } = parsePaging(req);

  const filter: Record<string, unknown> = { status: 'active' };
  if (q) {
    const re = new RegExp(escRe(q), 'i');
    filter.$or = [{ alias: re }, { interests: re }, { keywords: re }];
  }

  const total = await ChainNode.countDocuments(filter);
  const docs = await ChainNode.find(filter)
    .select('alias interests keywords portfolioUrl reputationScore badges createdAt')
    .sort({ reputationScore: -1, createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  res.json({
    items: docs.map((n) => ({
      alias: n.alias,
      interests: n.interests || [],
      keywords: n.keywords || [],
      portfolioUrl: n.portfolioUrl || '',
      reputationScore: n.reputationScore,
      badges: n.badges || [],
      joinedAt: n.createdAt,
    })),
    total,
    limit,
    offset,
  });
});

export default router;
