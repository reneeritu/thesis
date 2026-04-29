/**
 * GET /discover/spaces   — public feed of all active spaces
 * GET /discover/projects — fully_public + process_visible, plus space_only projects
 *   in spaces the authenticated node belongs to (space-scoped rows include spaceName)
 * GET /discover/nodes    — public feed of active nodes (alias + keywords + interests)
 *
 * Discovery queries:
 * - Spaces: optional `access=open,invite_only,application` (subset — filters `settings.projectAccess`).
 * - Projects: optional `status=active,completed,disputed`; optional `activity=brainstorm,research,...`
 *   (research maps to primary + secondary research traces — limits to projects that have matching traces).
 * Sort order (recent chain activity):
 * - Spaces: latest trace timestamp in any project under the space, else space `createdAt`.
 * - Projects: latest trace on the project, else project `createdAt`.
 * - Nodes: `lastActiveAt` (fallback `createdAt`).
 * envelope shape: `{ items, total, limit, offset }`. `q` is a
 * case-insensitive anchored-or-contains match on the feed's most useful
 * human-readable field (name / title / alias). Limit is clamped to
 * [1, MAX_LIMIT] with a sensible default so a newly seeded DB can't flood
 * the client with hundreds of rows.
 */
import mongoose from 'mongoose';
import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { Space } from '../models/Space';
import { Project } from '../models/Project';
import { ChainNode } from '../models/Node';
import { Trace } from '../models/Trace';
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

/** Comma-separated query values; trims and drops empties. */
function parseCsvParam(req: AuthRequest, key: string): string[] {
  const raw = String(req.query[key] ?? '').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const SPACE_ACCESS = new Set(['open', 'invite_only', 'application']);
const PROJECT_STATUS_FILTER = new Set(['active', 'completed', 'disputed']);

/** UI discover activity keys → Trace.activityType values (research spans primary + secondary). */
const DISCOVER_ACTIVITY_TO_TRACE: Record<string, string[]> = {
  brainstorm: ['brainstorm'],
  research: ['primary_research', 'secondary_research'],
  fabrication: ['fabrication'],
  skillwork: ['skillwork'],
  pedagogy: ['pedagogy'],
  review: ['review'],
  iterate: ['iterate'],
};

function expandDiscoverActivities(keys: string[]): string[] {
  const seen = new Set<string>();
  for (const k of keys) {
    const mapped = DISCOVER_ACTIVITY_TO_TRACE[k];
    if (!mapped) continue;
    for (const t of mapped) seen.add(t);
  }
  return [...seen];
}

function iso(d: unknown): string {
  if (!d) return '';
  if (d instanceof Date) return d.toISOString();
  if (typeof d === 'string') return new Date(d).toISOString();
  return String(d);
}

router.get('/spaces', requireAuth, async (req: AuthRequest, res: Response) => {

  const alias = req.node!.alias;
  const { q, limit, offset } = parsePaging(req);
  const accessRaw = parseCsvParam(req, 'access');
  const access = accessRaw.filter((a) => SPACE_ACCESS.has(a));

  const filter: Record<string, unknown> = { status: 'active' };
  if (access.length > 0) {
    filter['settings.projectAccess'] = { $in: access };
  }
  if (q) {
    const re = new RegExp(escRe(q), 'i');
    filter.$or = [{ name: re }, { description: re }];
  }

  const total = await Space.countDocuments(filter);

  const pipeline: mongoose.PipelineStage[] = [
    { $match: filter },
    {
      $lookup: {
        from: 'projects',
        localField: '_id',
        foreignField: 'spaceId',
        as: 'plist',
      },
    },
    {
      $lookup: {
        from: 'traces',
        let: { pids: '$plist._id' },
        pipeline: [
          {
            $match: {
              $expr: { $in: ['$projectId', { $ifNull: ['$$pids', []] }] },
            },
          },
          { $sort: { timestamp: -1 } },
          { $limit: 1 },
        ],
        as: 'lt',
      },
    },
    {
      $addFields: {
        sortAt: {
          $cond: [
            { $gt: [{ $size: '$lt' }, 0] },
            { $arrayElemAt: ['$lt.timestamp', 0] },
            '$createdAt',
          ],
        },
      },
    },
    { $sort: { sortAt: -1 } },
    { $skip: offset },
    { $limit: limit },
  ];

  const docs = await Space.aggregate<Record<string, unknown>>(pipeline);

  res.json({
    items: docs.map((raw) => {
      const s = raw as {
        _id: mongoose.Types.ObjectId;
        name: string;
        description?: string;
        creatorAlias: string;
        members?: string[];
        settings?: { projectAccess?: string };
        createdAt: Date;
        logoSeed?: string;
        lt?: { activityType?: string; timestamp?: Date }[];
      };
      const sid = String(s._id);
      const lt = Array.isArray(s.lt) && s.lt[0] ? s.lt[0] : null;
      const lastTrace =
        lt?.activityType != null && lt.timestamp != null
          ? { activityType: String(lt.activityType), at: iso(lt.timestamp) }
          : null;
      const createdAtStr = iso(s.createdAt);
      const chainActivityAt = lastTrace?.at ?? createdAtStr;
      return {
        _id: sid,
        name: s.name,
        description: s.description || '',
        creatorAlias: s.creatorAlias,
        memberCount: Array.isArray(s.members) ? s.members.length : 0,
        projectAccess: s.settings?.projectAccess || 'open',
        isMember: Array.isArray(s.members) ? s.members.includes(alias) : false,
        createdAt: createdAtStr,
        logoSeed: s.logoSeed || sid,
        lastTrace,
        chainActivityAt,
      };
    }),
    total,
    limit,
    offset,
  });
});

router.get('/projects', requireAuth, async (req: AuthRequest, res: Response) => {
  const alias = req.node!.alias;
  const { q, limit, offset } = parsePaging(req);

  const me = await ChainNode.findOne({ alias }).select('spaces').lean();
  const fromNode = (me?.spaces ?? []) as mongoose.Types.ObjectId[];
  /** Membership on Space is canonical; ChainNode.spaces can lag after joins. */
  const fromMembership = (await Space.distinct('_id', {
    members: alias,
    status: 'active',
  })) as mongoose.Types.ObjectId[];

  const seen = new Set<string>();
  const memberSpaceIds: mongoose.Types.ObjectId[] = [];
  for (const id of [...fromNode, ...fromMembership]) {
    const k = String(id);
    if (seen.has(k)) continue;
    seen.add(k);
    memberSpaceIds.push(id);
  }

  const visibilityOr: Record<string, unknown>[] = [
    { visibility: { $in: ['fully_public', 'process_visible'] } },
  ];
  if (memberSpaceIds.length > 0) {
    visibilityOr.push({ visibility: 'space_only', spaceId: { $in: memberSpaceIds } });
  }

  const statusCsv = parseCsvParam(req, 'status');
  const statusPick = statusCsv.filter((s) => PROJECT_STATUS_FILTER.has(s));
  const activityKeys = parseCsvParam(req, 'activity');
  const traceTypes = expandDiscoverActivities(activityKeys);

  let projectIdsByActivity: mongoose.Types.ObjectId[] | null = null;
  if (activityKeys.length > 0) {
    if (traceTypes.length === 0) {
      return res.json({ items: [], total: 0, limit, offset });
    }
    const ids = await Trace.distinct('projectId', { activityType: { $in: traceTypes } });
    projectIdsByActivity = (ids as mongoose.Types.ObjectId[]).filter(Boolean);
    if (projectIdsByActivity.length === 0) {
      return res.json({ items: [], total: 0, limit, offset });
    }
  }

  const filter: Record<string, unknown> = {
    $or: visibilityOr,
  };
  if (statusPick.length > 0) {
    filter.status = { $in: statusPick };
  } else {
    filter.status = { $nin: ['archived'] };
  }
  if (projectIdsByActivity) {
    filter._id = { $in: projectIdsByActivity };
  }
  if (q) {
    filter.title = new RegExp(escRe(q), 'i');
  }

  const total = await Project.countDocuments(filter);

  const projPipeline: mongoose.PipelineStage[] = [
    { $match: filter },
    {
      $lookup: {
        from: 'traces',
        let: { pid: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$projectId', '$$pid'] } } },
          { $sort: { timestamp: -1 } },
          { $limit: 1 },
        ],
        as: 'lt',
      },
    },
    {
      $addFields: {
        sortAt: {
          $cond: [
            { $gt: [{ $size: '$lt' }, 0] },
            { $arrayElemAt: ['$lt.timestamp', 0] },
            '$createdAt',
          ],
        },
      },
    },
    { $sort: { sortAt: -1 } },
    { $skip: offset },
    { $limit: limit },
  ];

  const docs = await Project.aggregate<Record<string, unknown>>(projPipeline);

  const spaceIdStrs = [
    ...new Set(
      docs.map((raw) =>
        String((raw as { spaceId: mongoose.Types.ObjectId }).spaceId),
      ),
    ),
  ];
  const spaceDocs = await Space.find({
    _id: { $in: spaceIdStrs.map((id) => new mongoose.Types.ObjectId(id)) },
  })
    .select('name')
    .lean();
  const spaceNameById = new Map(spaceDocs.map((s) => [String(s._id), s.name]));

  res.json({
    items: docs.map((raw) => {
      const p = raw as {
        _id: mongoose.Types.ObjectId;
        title: string;
        status: string;
        spaceId: mongoose.Types.ObjectId;
        creatorAlias: string;
        contributors?: { alias: string }[];
        visibility: string;
        createdAt: Date;
        logoSeed?: string;
        lt?: { activityType?: string; timestamp?: Date }[];
      };
      const sid = String(p.spaceId);
      const pid = String(p._id);
      const spaceScoped = p.visibility === 'space_only';
      const lt = Array.isArray(p.lt) && p.lt[0] ? p.lt[0] : null;
      const lastTrace =
        lt?.activityType != null && lt.timestamp != null
          ? { activityType: String(lt.activityType), at: iso(lt.timestamp) }
          : null;
      const createdAtStr = iso(p.createdAt);
      const chainActivityAt = lastTrace?.at ?? createdAtStr;
      return {
        _id: pid,
        title: p.title,
        status: p.status,
        spaceId: sid,
        spaceName: spaceNameById.get(sid) ?? '',
        spaceScoped,
        creatorAlias: p.creatorAlias,
        visibility: p.visibility,
        isContributor: Array.isArray(p.contributors)
          ? p.contributors.some((c: { alias: string }) => c.alias === alias)
          : false,
        createdAt: createdAtStr,
        logoSeed: p.logoSeed || pid,
        lastTrace,
        chainActivityAt,
      };
    }),
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
    .select(
      'alias interests keywords portfolioUrl reputationScore badges createdAt lastActiveAt',
    )
    .sort({ lastActiveAt: -1, createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  res.json({
    items: docs.map((n) => {
      const joinedAt = iso(n.createdAt);
      const lastActive = iso(n.lastActiveAt ?? n.createdAt);
      return {
        alias: n.alias,
        interests: n.interests || [],
        keywords: n.keywords || [],
        portfolioUrl: n.portfolioUrl || '',
        reputationScore: n.reputationScore,
        badges: n.badges || [],
        joinedAt,
        lastActiveAt: lastActive,
        chainActivityAt: lastActive,
      };
    }),
    total,
    limit,
    offset,
  });
});

export default router;
