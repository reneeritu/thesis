import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { optionalAuth } from '../middleware/optionalAuth';
import { validate } from '../middleware/validate';
import { startProjectSchema, addContributorSchema } from '../schemas/project';
import { Project } from '../models/Project';
import { Space } from '../models/Space';
import { ChainNode } from '../models/Node';
import { Trace } from '../models/Trace';
import { Reference } from '../models/Reference';
import { Pivot } from '../models/Pivot';
import { Veto } from '../models/Veto';
import { Notification } from '../models/Notification';
import { addBlock } from '../services/chain';
import { AuthRequest } from '../types';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors';
import {
  getProjectPayloadForViewer,
  assertFullProcessLogReadable,
} from '../utils/projectAccess';
import { spacePrivacyAllowsPublicFullBrowse } from '../utils/spacePrivacy';

const router = Router();

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

    const now = new Date();
    const contributorList: {
      alias: string;
      role: string;
      isPrimary: boolean;
      signedAt: Date | null;
      accepted: boolean | null;
      invitedAt: Date | null;
    }[] = [
      { alias, role: 'creator', isPrimary: true, signedAt: now, accepted: true, invitedAt: null },
    ];

    const invitedAliases: string[] = [];

    if (contributors) {
      for (const c of contributors) {
        if (c.alias === alias) continue;
        const exists = await ChainNode.findOne({ alias: c.alias, status: 'active' });
        if (!exists) throw new NotFoundError(`Contributor "${c.alias}"`);
        contributorList.push({
          alias: c.alias,
          role: c.role || 'contributor',
          isPrimary: c.isPrimary ?? false,
          signedAt: null,
          accepted: null,   // pending
          invitedAt: now,
        });
        invitedAliases.push(c.alias);
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
      visibility: visibility || 'process_visible',
      startBlockIndex: block.index,
    });

    // Notify invited contributors
    for (const invitedAlias of invitedAliases) {
      await Notification.create({
        recipientAlias: invitedAlias,
        type: 'contributor_invite',
        relatedId: String(project._id),
        relatedType: 'project',
        metadata: {
          projectId: String(project._id),
          projectTitle: title,
          inviterAlias: alias,
          message: `${alias} has invited you as a contributor to project "${title}". Accept or decline from the project page.`,
        },
      });
    }

    res.status(201).json(project);
  },
);

/**
 * GET /projects/search?q=...
 * Search projects by title/context/aliases and tool/software traces.
 */
router.get(
  '/search',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const q = String(req.query.q || '').trim();
    const spaceId = String(req.query.spaceId || '').trim();
    if (!q) return res.json([]);

    const rx = new RegExp(escapeRegex(q), 'i');
    const baseFilter: Record<string, unknown> = {};
    if (spaceId) baseFilter.spaceId = spaceId;

    const textMatched = await Project.find({
      ...baseFilter,
      $or: [
        { title: rx },
        { context: rx },
        { creatorAlias: rx },
        { mentorAlias: rx },
      ],
    })
      .select('_id title status spaceId context creatorAlias mentorAlias logoSeed')
      .lean();

    const toolProjectIds = await Trace.find({ toolSoftware: rx })
      .distinct('projectId');

    const mergedIds = new Set<string>([
      ...textMatched.map((p) => String(p._id)),
      ...toolProjectIds.map((id) => String(id)),
    ]);

    if (mergedIds.size === 0) return res.json([]);

    const idList = [...mergedIds];
    const projects = await Project.find({
      _id: { $in: idList },
      ...(spaceId ? { spaceId } : {}),
    })
      .select('_id title status spaceId context creatorAlias mentorAlias createdAt logoSeed')
      .sort({ createdAt: -1 })
      .lean();

    const spaceIds = [...new Set(projects.map((p) => String(p.spaceId)))];
    const spaces = await Space.find({ _id: { $in: spaceIds } })
      .select('_id name')
      .lean();
    const spaceNameById = new Map(spaces.map((s) => [String(s._id), String(s.name || '')]));

    const traceRows = await Trace.find({
      projectId: { $in: projects.map((p) => p._id) },
      toolSoftware: { $ne: '' },
    })
      .select('projectId toolSoftware')
      .lean();

    const toolsByProject = new Map<string, string[]>();
    for (const t of traceRows) {
      const pid = String(t.projectId);
      const current = toolsByProject.get(pid) || [];
      const tool = String(t.toolSoftware || '').trim();
      if (tool && !current.includes(tool)) current.push(tool);
      toolsByProject.set(pid, current.slice(0, 8));
    }

    const out = projects.map((p) => ({
      _id: String(p._id),
      title: p.title,
      status: p.status,
      spaceId: String(p.spaceId),
      spaceName: spaceNameById.get(String(p.spaceId)) || String(p.spaceId),
      context: p.context || '',
      creatorAlias: p.creatorAlias,
      mentorAlias: p.mentorAlias || '',
      tools: toolsByProject.get(String(p._id)) || [],
      logoSeed: p.logoSeed,
    }));

    res.json(out);
  },
);

/**
 * GET /projects/space/:spaceId
 * List projects in a space. (Must be registered before GET /:id so "space" is not captured as id.)
 */
router.get(
  '/space/:spaceId',
  optionalAuth,
  async (req: AuthRequest, res: Response) => {
    const space = await Space.findById(req.params.spaceId);
    if (!space) throw new NotFoundError('Space');

    const caller = req.node?.alias;
    const fullBrowse = spacePrivacyAllowsPublicFullBrowse(space.settings?.privacyDefault);
    const isMember = caller ? space.members.includes(caller) : false;

    let projects = await Project.find({ spaceId: req.params.spaceId }).sort({
      createdAt: -1,
    });

    if (!isMember) {
      if (!fullBrowse) {
        return res.json([]);
      }
      projects = projects.filter(
        (p) =>
          p.visibility === 'fully_public' || p.visibility === 'process_visible',
      );
    }

    res.json(projects);
  },
);

/**
 * GET /projects/by-node/:alias
 * Public listing of projects an alias contributes to.
 * Visibility rules:
 *   - Own projects are always returned (if authed as that alias).
 *   - 'fully_public' + 'process_visible' projects are visible to anyone.
 *   - 'space_only' projects are only visible to space members.
 */
router.get(
  '/by-node/:alias',
  optionalAuth,
  async (req: AuthRequest, res: Response) => {
    const target = String(req.params.alias);
    const callerAlias = req.node?.alias;
    const isSelf = callerAlias === target;

    const projects = await Project.find({
      $or: [{ creatorAlias: target }, { 'contributors.alias': target }],
    })
      .select('_id title status spaceId visibility creatorAlias contributors createdAt logoSeed')
      .sort({ createdAt: -1 })
      .lean();

    if (projects.length === 0) return res.json([]);

    // Figure out which space_only ones the caller is allowed to see.
    let allowedSpaceIds = new Set<string>();
    if (callerAlias) {
      const spaceIds = [...new Set(projects.map((p) => String(p.spaceId)))];
      const spaces = await Space.find({
        _id: { $in: spaceIds },
        members: callerAlias,
      })
        .select('_id name')
        .lean();
      allowedSpaceIds = new Set(spaces.map((s) => String(s._id)));
    }

    const allSpaceIds = [...new Set(projects.map((p) => String(p.spaceId)))];
    const spaceNames = await Space.find({ _id: { $in: allSpaceIds } })
      .select('_id name')
      .lean();
    const spaceNameById = new Map(spaceNames.map((s) => [String(s._id), String(s.name || '')]));

    const filtered = projects.filter((p) => {
      if (isSelf) return true;
      if (p.visibility === 'fully_public' || p.visibility === 'process_visible') return true;
      if (p.visibility === 'space_only') return true;
      return allowedSpaceIds.has(String(p.spaceId));
    });

    const out = filtered.map((p) => {
      const sid = String(p.spaceId);
      const memberCanSeeLog =
        isSelf ||
        p.visibility === 'fully_public' ||
        p.visibility === 'process_visible' ||
        allowedSpaceIds.has(sid);
      return {
        _id: String(p._id),
        title: p.title,
        status: p.status,
        visibility: p.visibility,
        spaceId: sid,
        spaceName: spaceNameById.get(sid) || sid,
        creatorAlias: p.creatorAlias,
        role:
          p.creatorAlias === target
            ? 'creator'
            : (p.contributors?.find((c) => c.alias === target)?.role || 'contributor'),
        logoSeed: p.logoSeed,
        ...(p.visibility === 'space_only' && !memberCanSeeLog
          ? { publicProcessLogRestricted: true as const }
          : {}),
      };
    });

    res.json(out);
  },
);

/**
 * GET /projects/:id
 * Readable without auth when visibility is process_visible or fully_public; space_only requires membership.
 */
router.get('/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  const payload = await getProjectPayloadForViewer(String(req.params.id), req);
  res.json(payload);
});

/**
 * GET /projects/:id/export
 * Download the project plus all its chain slice (traces, references,
 * pivots, vetos) as a single JSON blob. NDA-sealed traces are only
 * included if the caller owns them. Caller must be a contributor.
 */
router.get(
  '/:id/export',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const project = await Project.findById(req.params.id);
    if (!project) throw new NotFoundError('Project');

    const alias = req.node!.alias;
    const isContributor = project.contributors.some(
      (c) => c.alias === alias && c.accepted !== false,
    );
    if (!isContributor) {
      throw new ForbiddenError('Only contributors can export this project');
    }

    const [traces, references, pivots, vetos] = await Promise.all([
      Trace.find({ projectId: project._id }).sort({ timestamp: 1 }).lean(),
      Reference.find({ projectId: project._id }).sort({ createdAt: 1 }).lean(),
      Pivot.find({ projectId: project._id }).sort({ createdAt: 1 }).lean(),
      Veto.find({ projectId: project._id }).sort({ createdAt: 1 }).lean(),
    ]);

    const ownTraces = traces.filter(
      (t) => !(t as { ndaSealed?: boolean }).ndaSealed || t.nodeAlias === alias,
    );

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="project-${String(project._id)}.json"`,
    );
    res.json({
      exportedAt: new Date().toISOString(),
      exportedBy: alias,
      project,
      traces: ownTraces,
      references,
      pivots,
      vetos,
    });
  },
);

/**
 * POST /projects/:id/join-request
 * Non-contributor asks to collaborate on a project. Notifies all primary
 * contributors; they can accept (adds as pending contributor) or decline
 * via the regular notification flow.
 */
router.post(
  '/:id/join-request',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const project = await Project.findById(req.params.id);
    if (!project) throw new NotFoundError('Project');
    if (project.status !== 'active') throw new AppError('Project is not active');

    const alias = req.node!.alias;
    if (project.contributors.some((c) => c.alias === alias)) {
      throw new AppError('You are already listed on this project');
    }

    const note = String(req.body?.note ?? '').slice(0, 500);
    const primaries = project.contributors.filter((c) => c.isPrimary && c.accepted);
    if (primaries.length === 0) {
      throw new AppError('No primary contributor available to receive the request');
    }

    for (const p of primaries) {
      await Notification.create({
        recipientAlias: p.alias,
        type: 'collab_request',
        relatedId: String(project._id),
        relatedType: 'project',
        metadata: {
          projectId: String(project._id),
          projectTitle: project.title,
          requesterAlias: alias,
          note,
          message: `${alias} asks to collaborate on "${project.title}".${note ? ' Note: ' + note : ''}`,
        },
      });
    }

    res.status(201).json({ ok: true, sentTo: primaries.map((p) => p.alias) });
  },
);

/**
 * POST /projects/:id/join-request/respond
 * Primary responds to a collab request. Body: { requesterAlias, accept, role? }.
 */
router.post(
  '/:id/join-request/respond',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const project = await Project.findById(req.params.id);
    if (!project) throw new NotFoundError('Project');

    const alias = req.node!.alias;
    const amPrimary = project.contributors.some(
      (c) => c.alias === alias && c.isPrimary && c.accepted,
    );
    if (!amPrimary) throw new ForbiddenError('Only primary contributors can respond');

    const { requesterAlias, accept, role } = req.body as {
      requesterAlias?: string;
      accept?: boolean;
      role?: string;
    };
    if (!requesterAlias || typeof accept !== 'boolean') {
      throw new AppError('requesterAlias and accept are required');
    }
    if (project.contributors.some((c) => c.alias === requesterAlias)) {
      throw new AppError(`${requesterAlias} is already a contributor`);
    }

    if (accept) {
      const exists = await ChainNode.findOne({ alias: requesterAlias, status: 'active' });
      if (!exists) throw new NotFoundError(`Node "${requesterAlias}"`);
      const now = new Date();
      project.contributors.push({
        alias: requesterAlias,
        role: role || 'contributor',
        isPrimary: false,
        signedAt: now,
        accepted: true,
        invitedAt: now,
      });
      await project.save();
    }

    await Notification.create({
      recipientAlias: requesterAlias,
      type: 'collab_request_response',
      relatedId: String(project._id),
      relatedType: 'project',
      metadata: {
        projectId: String(project._id),
        projectTitle: project.title,
        accepted: accept,
        responderAlias: alias,
        message: accept
          ? `${alias} accepted your request to collaborate on "${project.title}". You are now a contributor.`
          : `${alias} declined your request to collaborate on "${project.title}".`,
      },
    });

    res.json({ accepted: accept });
  },
);

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

    const now2 = new Date();
    project.contributors.push({
      alias,
      role: role || 'contributor',
      isPrimary: isPrimary ?? false,
      signedAt: null,
      accepted: null,
      invitedAt: now2,
    });
    await project.save();

    // Notify the invited contributor
    await Notification.create({
      recipientAlias: alias,
      type: 'contributor_invite',
      relatedId: String(project._id),
      relatedType: 'project',
      metadata: {
        projectId: String(project._id),
        projectTitle: project.title,
        inviterAlias: req.node!.alias,
        message: `${req.node!.alias} has invited you as a contributor to project "${project.title}". Accept or decline from the project page.`,
      },
    });

    res.json(project);
  },
);

/**
 * POST /projects/:id/contributors/respond
 * The current authenticated node accepts or declines a contributor invitation.
 * Body: { accept: boolean }
 */
const respondContributorSchema = require('zod').z.object({ accept: require('zod').z.boolean() });

router.post(
  '/:id/contributors/respond',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const project = await Project.findById(req.params.id);
    if (!project) throw new NotFoundError('Project');

    const alias = req.node!.alias;
    const contrib = project.contributors.find((c) => c.alias === alias);
    if (!contrib) throw new AppError('You are not listed as a contributor on this project');
    if (contrib.accepted !== null) throw new AppError('You have already responded to this invitation');

    const accept = req.body.accept;
    if (typeof accept !== 'boolean') throw new AppError('accept must be true or false');

    contrib.accepted = accept;
    if (accept) {
      contrib.signedAt = new Date();
    } else {
      // Remove from contributors on decline
      project.contributors = project.contributors.filter((c) => c.alias !== alias);
    }
    await project.save();

    // Notify project creator
    const decision = accept
      ? `${alias} accepted your contributor invitation on project "${project.title}".`
      : `${alias} declined your contributor invitation on project "${project.title}".`;

    await Notification.create({
      recipientAlias: project.creatorAlias,
      type: 'contributor_invite_response',
      relatedId: String(project._id),
      relatedType: 'project',
      metadata: {
        projectId: String(project._id),
        projectTitle: project.title,
        respondentAlias: alias,
        accepted: accept,
        message: decision,
      },
    });

    res.json({ accepted: accept, message: decision });
  },
);

export default router;
