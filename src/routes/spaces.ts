import { Router, Response } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/auth';
import { optionalAuth } from '../middleware/optionalAuth';
import { validate } from '../middleware/validate';
import {
  createSpaceWithParentSchema,
  joinSpaceSchema,
  updateSpaceSettingsSchema,
  generateInviteSchema,
  vetoRespondSchema,
  customContractSchema,
  respondApplicationSchema,
} from '../schemas/space';
import { Space } from '../models/Space';
import { Application } from '../models/Application';
import { ChainNode } from '../models/Node';
import { Notification } from '../models/Notification';
import { AuthRequest } from '../types';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors';
import { SpaceMessage } from '../models/SpaceMessage';
import { sendSpaceMessageSchema } from '../schemas/spaceMessage';
import { validateObjectId } from '../utils/validateObjectId';
import { Project } from '../models/Project';
import { Trace } from '../models/Trace';

const router = Router();

const INVITE_DEFAULT_EXPIRY_DAYS = 15;

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Walk up from proposed parent; detect cycles and enforce max depth (new child rank ≤ 6). */
async function assertParentHierarchyAllowed(parentId: mongoose.Types.ObjectId): Promise<void> {
  const seen = new Set<string>();
  let cur: mongoose.Types.ObjectId | null = parentId;
  let ancestors = 0;
  while (cur) {
    const idStr = String(cur);
    if (seen.has(idStr)) {
      throw new AppError('Cycle detected in space hierarchy');
    }
    seen.add(idStr);
    const doc = await Space.findById(cur).select('parentSpaceId').lean();
    if (!doc) break;
    const next = doc.parentSpaceId as mongoose.Types.ObjectId | null | undefined;
    if (!next) break;
    ancestors++;
    if (ancestors > 5) {
      throw new AppError('Space hierarchy too deep');
    }
    cur = next;
  }
}

/**
 * POST /spaces
 * Create a new space.
 * - Creator becomes first admin + member.
 * - Optional foundingMembers: other aliases added as admin/member immediately.
 * - Optional vetoAuthority aliases: stored in pendingVeto, notifications sent.
 *   Settings.vetoAuthority stays empty until each named node accepts.
 */
router.post('/', requireAuth, validate(createSpaceWithParentSchema), async (req: AuthRequest, res: Response) => {
  const { name, description, settings, foundingMembers, parentSpaceId } = req.body;
  const creatorAlias = req.node!.alias;

  let resolvedParentId: mongoose.Types.ObjectId | null = null;
  if (parentSpaceId) {
    if (!mongoose.Types.ObjectId.isValid(parentSpaceId)) {
      throw new AppError('Invalid parent space id');
    }
    resolvedParentId = new mongoose.Types.ObjectId(parentSpaceId);
    const parent = await Space.findById(resolvedParentId);
    if (!parent) throw new NotFoundError('Parent space');
    if (!parent.members.includes(creatorAlias)) {
      throw new ForbiddenError('You must be a member of the parent space to create a child space');
    }
    await assertParentHierarchyAllowed(resolvedParentId);
  }

  // Resolve founding members (must exist + not be the creator)
  const admins: string[] = [creatorAlias];
  const members: string[] = [creatorAlias];

  if (foundingMembers && foundingMembers.length > 0) {
    for (const fm of foundingMembers as { alias: string; role: 'admin' | 'member' }[]) {
      if (fm.alias === creatorAlias) continue;
      const exists = await ChainNode.findOne({ alias: fm.alias, status: 'active' });
      if (!exists) throw new NotFoundError(`Founding member "${fm.alias}"`);
      if (!members.includes(fm.alias)) members.push(fm.alias);
      if (fm.role === 'admin' && !admins.includes(fm.alias)) admins.push(fm.alias);
    }
  }

  // Requested veto aliases — move to pendingVeto; don't put in settings.vetoAuthority yet
  const requestedVeto: string[] = settings?.vetoAuthority ?? [];

  const customContractsInput =
    settings?.customContracts as { title: string; body: string; authorAlias: string }[] | undefined;

  const space = await Space.create({
    name,
    description: description || '',
    creatorAlias,
    admins,
    members,
    parentSpaceId: resolvedParentId,
    settings: {
      projectAccess: settings?.projectAccess || 'open',
      vetoAuthority: [],           // empty until accepted
      votingThreshold: settings?.votingThreshold ?? 0.5,
      privacyDefault: settings?.privacyDefault || 'space_specific',
      customContractsAllowed: settings?.customContractsAllowed ?? true,
      contentRestrictions: settings?.contentRestrictions || [],
      minDocRequirements: settings?.minDocRequirements || [],
      customContracts: (customContractsInput ?? []).map((c) => ({
        title: c.title,
        body: c.body,
        authorAlias: c.authorAlias,
        createdAt: new Date(),
      })),
      enforceStrictMinDoc: settings?.enforceStrictMinDoc ?? false,
    },
    pendingVeto: requestedVeto.map((alias: string) => ({ alias, notifiedAt: new Date() })),
  });

  // Update ChainNode.spaces for all initial members
  for (const alias of members) {
    await ChainNode.findOneAndUpdate({ alias }, { $addToSet: { spaces: space._id } });
  }

  // Notify each pending veto authority
  for (const vetoAlias of requestedVeto) {
    const vetoNodeExists = await ChainNode.exists({ alias: vetoAlias, status: 'active' });
    if (vetoNodeExists) {
      await Notification.create({
        recipientAlias: vetoAlias,
        type: 'veto_invite',
        relatedId: String(space._id),
        relatedType: 'space',
        metadata: {
          spaceId: String(space._id),
          spaceName: name,
          creatorAlias,
          message: `${creatorAlias} has invited you to join space "${name}" and serve as veto authority. You can join + accept veto, join only, or decline.`,
        },
      });
    }
  }

  // Notify creator if there are pending veto requests
  if (requestedVeto.length > 0) {
    await Notification.create({
      recipientAlias: creatorAlias,
      type: 'veto_invite',
      relatedId: String(space._id),
      relatedType: 'space',
      metadata: {
        spaceId: String(space._id),
        spaceName: name,
        message: `Your space "${name}" was created. Veto authority invitation sent to: ${requestedVeto.join(', ')}. The veto role is empty until they respond.`,
        pendingVeto: requestedVeto,
      },
    });
  }

  res.status(201).json(space);
});

/**
 * GET /spaces/search?q=...
 */
router.get('/search', requireAuth, async (req: AuthRequest, res: Response) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json([]);

  const rx = new RegExp(escapeRegex(q), 'i');
  const alias = req.node!.alias;

  const spaces = await Space.find({
    $or: [
      { name: rx },
      { description: rx },
      { 'settings.contentRestrictions': rx },
      { 'settings.minDocRequirements': rx },
    ],
  })
    .select('name description status members settings logoSeed')
    .sort({ createdAt: -1 })
    .lean();

  const out = spaces.map((s) => ({
    _id: String(s._id),
    name: s.name,
    description: s.description || '',
    status: s.status,
    projectAccess: s.settings?.projectAccess || 'open',
    contentRestrictions: s.settings?.contentRestrictions || [],
    minDocRequirements: s.settings?.minDocRequirements || [],
    memberCount: Array.isArray(s.members) ? s.members.length : 0,
    isMember: Array.isArray(s.members) ? s.members.includes(alias) : false,
    logoSeed: s.logoSeed,
  }));

  res.json(out);
});

/**
 * GET /spaces/discover
 * Public feed of all active spaces (no auth required for discovery but uses auth if present).
 */
router.get('/discover', requireAuth, async (req: AuthRequest, res: Response) => {
  const alias = req.node!.alias;
  const spaces = await Space.find({ status: 'active' })
    .select('name description creatorAlias members admins settings createdAt logoSeed')
    .sort({ createdAt: -1 })
    .lean();

  const out = spaces.map((s) => ({
    _id: String(s._id),
    name: s.name,
    description: s.description || '',
    creatorAlias: s.creatorAlias,
    memberCount: Array.isArray(s.members) ? s.members.length : 0,
    projectAccess: s.settings?.projectAccess || 'open',
    isMember: Array.isArray(s.members) ? s.members.includes(alias) : false,
    createdAt: s.createdAt,
    logoSeed: s.logoSeed,
  }));

  res.json(out);
});

/**
 * GET /spaces/:id/children
 * Child spaces with parentSpaceId === :id (active only).
 */
router.get('/:id/children', requireAuth, async (req: AuthRequest, res: Response) => {
  const parent = await Space.findById(req.params.id);
  if (!parent) throw new NotFoundError('Space');

  const children = await Space.find({
    parentSpaceId: req.params.id,
    status: 'active',
  })
    .sort({ createdAt: 1 })
    .lean();

  res.json(children);
});

function assertSpaceDiscussionReadable(
  space: { members: string[]; settings?: { privacyDefault?: string } },
  req: AuthRequest,
): void {
  const isPublic = space.settings?.privacyDefault === 'public';
  const alias = req.node?.alias;
  if (isPublic) return;
  if (!alias) {
    throw new ForbiddenError('Sign in as a member to view this discussion');
  }
  if (!space.members.includes(alias)) {
    throw new ForbiddenError('Members only');
  }
}

/**
 * GET /spaces/:id/messages
 * Latest messages (rolling chat). Public space: anyone reads. Otherwise members only.
 */
router.get('/:id/messages', optionalAuth, async (req: AuthRequest, res: Response) => {
  const space = await Space.findById(req.params.id);
  if (!space) throw new NotFoundError('Space');

  assertSpaceDiscussionReadable(space, req);

  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const beforeRaw = req.query.before;
  const before =
    beforeRaw !== undefined && beforeRaw !== null && String(beforeRaw).trim() !== ''
      ? new Date(String(beforeRaw))
      : null;
  if (before && Number.isNaN(before.getTime())) {
    throw new AppError('Invalid before — use an ISO date string');
  }

  const query: Record<string, unknown> = {
    spaceId: space._id,
    pinned: { $ne: true },
  };
  if (before) query.createdAt = { $lt: before };

  const rows = await SpaceMessage.find(query).sort({ createdAt: -1 }).limit(limit).lean();

  const pinned = await SpaceMessage.find({
    spaceId: space._id,
    pinned: true,
  })
    .sort({ createdAt: -1 })
    .lean();

  const chronological = [...rows].reverse();
  const oldest = chronological[0];
  const nextBefore =
    rows.length >= limit && oldest?.createdAt
      ? new Date(oldest.createdAt as Date).toISOString()
      : null;

  res.json({
    messages: chronological,
    pinned,
    nextBefore,
  });
});

/**
 * POST /spaces/:id/messages
 */
router.post(
  '/:id/messages',
  requireAuth,
  validate(sendSpaceMessageSchema),
  async (req: AuthRequest, res: Response) => {
    const space = await Space.findById(req.params.id);
    if (!space) throw new NotFoundError('Space');

    const alias = req.node!.alias;
    if (!space.members.includes(alias)) {
      throw new ForbiddenError('Only members can post');
    }

    const { body } = req.body as { body: string };

    const msg = await SpaceMessage.create({
      spaceId: space._id,
      senderAlias: alias,
      body,
    });

    res.status(201).json(msg);
  },
);

/**
 * POST /spaces/:id/messages/:msgId/pin — admin toggles pin
 */
router.post('/:id/messages/:msgId/pin', requireAuth, async (req: AuthRequest, res: Response) => {
  validateObjectId(req.params.msgId, 'msgId');
  const space = await Space.findById(req.params.id);
  if (!space) throw new NotFoundError('Space');

  const alias = req.node!.alias;
  if (!space.admins.includes(alias)) {
    throw new ForbiddenError('Only admins can pin messages');
  }

  const msg = await SpaceMessage.findOne({
    _id: req.params.msgId,
    spaceId: space._id,
  });
  if (!msg) throw new NotFoundError('Message');

  msg.pinned = !msg.pinned;
  await msg.save();
  res.json(msg);
});

/**
 * DELETE /spaces/:id/messages/:msgId — sender or admin
 */
router.delete('/:id/messages/:msgId', requireAuth, async (req: AuthRequest, res: Response) => {
  validateObjectId(req.params.msgId, 'msgId');
  const space = await Space.findById(req.params.id);
  if (!space) throw new NotFoundError('Space');

  const alias = req.node!.alias;
  const msg = await SpaceMessage.findOne({
    _id: req.params.msgId,
    spaceId: space._id,
  });
  if (!msg) throw new NotFoundError('Message');

  if (msg.senderAlias !== alias && !space.admins.includes(alias)) {
    throw new ForbiddenError('Only the author or an admin can delete this message');
  }

  await SpaceMessage.deleteOne({ _id: msg._id });
  res.json({ deleted: true });
});

/**
 * GET /spaces/:id/traces/recent?limit=5
 * Latest traces across all projects in this space (newest first).
 * Same visibility as GET /spaces/:id.
 */
router.get('/:id/traces/recent', optionalAuth, async (req: AuthRequest, res: Response) => {
  const space = await Space.findById(req.params.id);
  if (!space) throw new NotFoundError('Space');

  const alias = req.node?.alias;
  const isPublicSpace = space.settings?.privacyDefault === 'public';

  if (!alias) {
    if (!isPublicSpace) {
      throw new ForbiddenError('Sign in to view this space');
    }
  } else {
    const isMember = space.members.includes(alias);
    if (!isMember && !isPublicSpace) {
      throw new ForbiddenError('Sign in as a member to view this space');
    }
  }

  const rawLimit = Number.parseInt(String(req.query.limit ?? '5'), 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 && rawLimit <= 20 ? rawLimit : 5;

  const projectsInSpace = await Project.find({ spaceId: space._id }).select('_id title').lean();
  if (projectsInSpace.length === 0) {
    return res.json([]);
  }

  const projectIds = projectsInSpace.map((p) => p._id);
  const titleById = new Map(projectsInSpace.map((p) => [String(p._id), String(p.title ?? '')]));

  const traces = await Trace.find({ projectId: { $in: projectIds } })
    .sort({ timestamp: -1 })
    .limit(limit)
    .select('nodeAlias activityType timestamp projectId')
    .lean();

  const out = traces.map((t) => ({
    nodeAlias: t.nodeAlias,
    activityType: t.activityType,
    timestamp:
      t.timestamp instanceof Date ? t.timestamp.toISOString() : String(t.timestamp ?? ''),
    projectId: String(t.projectId),
    projectTitle: titleById.get(String(t.projectId)) || 'Project',
  }));

  res.json(out);
});

/**
 * GET /spaces/:id
 * Public read when privacyDefault === 'public'. Members/admins see extra fields when authed.
 */
router.get('/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  const space = await Space.findById(req.params.id);
  if (!space) throw new NotFoundError('Space');

  const alias = req.node?.alias;
  const isPublicSpace = space.settings?.privacyDefault === 'public';

  if (!alias) {
    if (!isPublicSpace) {
      throw new ForbiddenError('Sign in to view this space');
    }
    const obj = space.toObject();
    delete (obj as { inviteCodes?: unknown }).inviteCodes;
    delete (obj as { pendingVeto?: unknown }).pendingVeto;
    return res.json(obj);
  }

  const isMember = space.members.includes(alias);
  const isAdmin = space.admins.includes(alias);

  if (!isMember && !isPublicSpace) {
    throw new ForbiddenError('Sign in as a member to view this space');
  }

  res.json({
    ...space.toObject(),
    inviteCodes: isMember ? space.inviteCodes : undefined,
    pendingVeto: isAdmin ? space.pendingVeto : undefined,
  });
});

/**
 * POST /spaces/:id/join
 * Join a space (open or with invite code).
 */
router.post(
  '/:id/join',
  requireAuth,
  validate(joinSpaceSchema),
  async (req: AuthRequest, res: Response) => {
    const space = await Space.findById(req.params.id);
    if (!space) throw new NotFoundError('Space');
    if (space.status === 'dormant') throw new AppError('Space is dormant');

    const alias = req.node!.alias;
    if (space.members.includes(alias)) {
      throw new AppError('Already a member');
    }

    if (space.settings.projectAccess === 'invite_only') {
      const { inviteCode } = req.body;
      if (!inviteCode) throw new AppError('Invite code required');

      const now = new Date();
      const codeEntry = space.inviteCodes.find((c) => {
        if (c.code !== inviteCode) return false;
        if (c.expiresAt && c.expiresAt < now) return false;
        if (c.mode === 'single_use') return !c.used;
        if (c.mode === 'multi_use') return true;
        return !c.used;
      });
      if (!codeEntry) throw new AppError('Invalid, used, or expired invite code');

      if (codeEntry.mode === 'single_use') {
        codeEntry.used = true;
      }
      codeEntry.usedCount = (codeEntry.usedCount || 0) + 1;
    } else if (space.settings.projectAccess === 'application') {
      const message = req.body.message ?? '';
      const existing = await Application.findOne({
        spaceId: space._id,
        applicantAlias: alias,
      });
      if (existing?.status === 'pending') {
        throw new AppError('Application already pending', 409);
      }
      let applicationDoc;
      if (existing) {
        existing.message = message;
        existing.status = 'pending';
        existing.respondedByAlias = '';
        existing.respondedAt = null;
        await existing.save();
        applicationDoc = existing;
      } else {
        applicationDoc = await Application.create({
          spaceId: space._id,
          applicantAlias: alias,
          message,
        });
      }

      for (const adminAlias of space.admins) {
        await Notification.create({
          recipientAlias: adminAlias,
          type: 'collaboration_request',
          relatedId: String(applicationDoc._id),
          relatedType: 'application',
          metadata: {
            message: `${alias} applied to join space "${space.name}"`,
          },
        });
      }

      return res.status(202).json({
        message: `Application submitted for space "${space.name}"`,
        applicationStatus: 'pending' as const,
        applicationId: String(applicationDoc._id),
      });
    }

    space.members.push(alias);
    await space.save();

    await ChainNode.findOneAndUpdate({ alias }, { $addToSet: { spaces: space._id } });

    res.json({ message: `Joined space "${space.name}"` });
  },
);

/**
 * GET /spaces/:id/applications
 * Pending join applications (admins only).
 */
router.get('/:id/applications', requireAuth, async (req: AuthRequest, res: Response) => {
  const space = await Space.findById(req.params.id);
  if (!space) throw new NotFoundError('Space');
  if (!space.admins.includes(req.node!.alias)) {
    throw new ForbiddenError('Only admins can view applications');
  }

  const applications = await Application.find({
    spaceId: space._id,
    status: 'pending',
  })
    .sort({ createdAt: 1 })
    .lean();

  res.json(applications);
});

/**
 * POST /spaces/:id/applications/:appId/respond
 * Approve or reject a pending application (admins only).
 */
router.post(
  '/:id/applications/:appId/respond',
  requireAuth,
  validate(respondApplicationSchema),
  async (req: AuthRequest, res: Response) => {
    const space = await Space.findById(req.params.id);
    if (!space) throw new NotFoundError('Space');
    if (!space.admins.includes(req.node!.alias)) {
      throw new ForbiddenError('Only admins can respond to applications');
    }

    const appIdParam = String(req.params.appId);
    if (!mongoose.Types.ObjectId.isValid(appIdParam)) {
      throw new NotFoundError('Application');
    }

    const application = await Application.findById(appIdParam);
    if (!application) throw new NotFoundError('Application');
    if (String(application.spaceId) !== String(space._id)) {
      throw new AppError('Application does not belong to this space');
    }
    if (application.status !== 'pending') {
      throw new AppError('Application is not pending');
    }

    const { decision } = req.body as { decision: 'approve' | 'reject' };
    const responderAlias = req.node!.alias;
    const now = new Date();

    if (decision === 'approve') {
      const applicant = application.applicantAlias;
      if (!space.members.includes(applicant)) {
        space.members.push(applicant);
      }
      await space.save();
      await ChainNode.findOneAndUpdate({ alias: applicant }, { $addToSet: { spaces: space._id } });
      application.status = 'approved';
      application.respondedByAlias = responderAlias;
      application.respondedAt = now;
    } else {
      application.status = 'rejected';
      application.respondedByAlias = responderAlias;
      application.respondedAt = now;
    }

    await application.save();

    await Notification.create({
      recipientAlias: application.applicantAlias,
      type: 'collaboration_request',
      relatedId: String(application._id),
      relatedType: 'application',
      metadata: {
        message:
          decision === 'approve'
            ? `Your application to join space "${space.name}" was approved.`
            : `Your application to join space "${space.name}" was rejected.`,
      },
    });

    res.json(application);
  },
);

/**
 * POST /spaces/:id/contracts
 * Append a custom contract (admins only).
 */
router.post(
  '/:id/contracts',
  requireAuth,
  validate(customContractSchema),
  async (req: AuthRequest, res: Response) => {
    const space = await Space.findById(req.params.id);
    if (!space) throw new NotFoundError('Space');
    if (!space.admins.includes(req.node!.alias)) {
      throw new ForbiddenError('Only admins can add contracts');
    }

    const { title, body } = req.body as { title: string; body: string };
    const contract = {
      title,
      body,
      authorAlias: req.node!.alias,
      createdAt: new Date(),
    };
    if (!Array.isArray(space.settings.customContracts)) {
      space.settings.customContracts = [];
    }
    space.settings.customContracts.push(contract);
    await space.save();

    const index = space.settings.customContracts.length - 1;
    res.status(201).json({ index, contract });
  },
);

/**
 * DELETE /spaces/:id/contracts/:index
 * Remove custom contract by array index (admins only).
 */
router.delete('/:id/contracts/:index', requireAuth, async (req: AuthRequest, res: Response) => {
  const space = await Space.findById(req.params.id);
  if (!space) throw new NotFoundError('Space');
  if (!space.admins.includes(req.node!.alias)) {
    throw new ForbiddenError('Only admins can remove contracts');
  }

  const index = Number.parseInt(String(req.params.index), 10);
  if (!Number.isFinite(index) || index < 0) {
    throw new NotFoundError('Contract');
  }
  const list = space.settings.customContracts ?? [];
  if (index >= list.length) {
    throw new NotFoundError('Contract');
  }
  list.splice(index, 1);
  space.settings.customContracts = list;
  await space.save();

  res.json({ message: 'Contract removed', space });
});

/**
 * DELETE /spaces/:id/leave
 * Leave a space (cannot leave if sole admin; creator must transfer admin first).
 */
router.delete('/:id/leave', requireAuth, async (req: AuthRequest, res: Response) => {
  const space = await Space.findById(req.params.id);
  if (!space) throw new NotFoundError('Space');

  const alias = req.node!.alias;
  if (!space.members.includes(alias)) throw new AppError('You are not a member of this space');

  const isAdmin = space.admins.includes(alias);
  if (isAdmin && space.admins.length === 1) {
    throw new AppError(
      'You are the sole admin. Transfer admin rights to another member before leaving.',
    );
  }

  space.members = space.members.filter((m) => m !== alias);
  space.admins = space.admins.filter((a) => a !== alias);
  // Remove from vetoAuthority if they were one
  space.settings.vetoAuthority = space.settings.vetoAuthority.filter((v) => v !== alias);
  await space.save();

  await ChainNode.findOneAndUpdate({ alias }, { $pull: { spaces: space._id } });

  res.json({ message: `Left space "${space.name}"` });
});

/**
 * POST /spaces/:id/veto-respond
 * A node that was invited as veto authority responds.
 * Body: { joinSpace: boolean, acceptVeto: boolean }
 * Rules:
 *   - acceptVeto=true requires joinSpace=true
 *   - If joinSpace=true, node becomes a member
 *   - If acceptVeto=true, node added to settings.vetoAuthority
 *   - Either way, removed from pendingVeto
 *   - Creator notified of decision
 */
router.post(
  '/:id/veto-respond',
  requireAuth,
  validate(vetoRespondSchema),
  async (req: AuthRequest, res: Response) => {
    const space = await Space.findById(req.params.id);
    if (!space) throw new NotFoundError('Space');

    const alias = req.node!.alias;
    const pendingEntry = space.pendingVeto.find((p) => p.alias === alias);
    if (!pendingEntry) {
      throw new AppError('You do not have a pending veto invitation for this space');
    }

    const { joinSpace, acceptVeto } = req.body as { joinSpace: boolean; acceptVeto: boolean };

    if (acceptVeto && !joinSpace) {
      throw new AppError('You must join the space to accept the veto authority role');
    }

    // Remove from pending
    space.pendingVeto = space.pendingVeto.filter((p) => p.alias !== alias);

    if (joinSpace && !space.members.includes(alias)) {
      space.members.push(alias);
      await ChainNode.findOneAndUpdate({ alias }, { $addToSet: { spaces: space._id } });
    }

    if (acceptVeto && !space.settings.vetoAuthority.includes(alias)) {
      space.settings.vetoAuthority.push(alias);
    }

    await space.save();

    // Notify creator
    const decisionText = !joinSpace
      ? `${alias} declined to join space "${space.name}" and is not the veto authority.`
      : acceptVeto
        ? `${alias} joined space "${space.name}" and accepted the veto authority role.`
        : `${alias} joined space "${space.name}" but declined the veto authority role.`;

    await Notification.create({
      recipientAlias: space.creatorAlias,
      type: 'veto_invite_response',
      relatedId: String(space._id),
      relatedType: 'space',
      metadata: {
        spaceId: String(space._id),
        spaceName: space.name,
        respondentAlias: alias,
        joinSpace,
        acceptVeto,
        message: decisionText,
        pendingVetoCount: space.pendingVeto.length,
      },
    });

    res.json({
      message: decisionText,
      joined: joinSpace,
      isVeto: acceptVeto,
    });
  },
);

/**
 * POST /spaces/:id/invite
 * Generate an invite code (admin only).
 * Body: { mode?: 'single_use'|'multi_use', expiryDays?: number|null }
 * Defaults: single_use, 15-day expiry
 */
router.post(
  '/:id/invite',
  requireAuth,
  validate(generateInviteSchema),
  async (req: AuthRequest, res: Response) => {
    const space = await Space.findById(req.params.id);
    if (!space) throw new NotFoundError('Space');

    if (!space.admins.includes(req.node!.alias)) {
      throw new ForbiddenError('Only admins can generate invite codes');
    }

    const mode: 'single_use' | 'multi_use' = req.body.mode ?? 'single_use';
    const expiryDaysRaw = req.body.expiryDays;
    const expiryDays: number | null =
      expiryDaysRaw === null ? null : (expiryDaysRaw ?? INVITE_DEFAULT_EXPIRY_DAYS);

    const expiresAt = expiryDays !== null
      ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
      : null;

    const code = crypto.randomBytes(8).toString('hex');
    space.inviteCodes.push({
      code,
      used: false,
      createdAt: new Date(),
      mode,
      maxUses: mode === 'single_use' ? 1 : null,
      usedCount: 0,
      expiresAt,
    });
    await space.save();

    res.status(201).json({ inviteCode: code, mode, expiresAt });
  },
);

/**
 * PATCH /spaces/:id/settings
 * Update space settings (admin only).
 */
router.patch(
  '/:id/settings',
  requireAuth,
  validate(updateSpaceSettingsSchema),
  async (req: AuthRequest, res: Response) => {
    const space = await Space.findById(req.params.id);
    if (!space) throw new NotFoundError('Space');

    if (!space.admins.includes(req.node!.alias)) {
      throw new ForbiddenError('Only admins can update settings');
    }

    const allowed = [
      'projectAccess',
      'vetoAuthority',
      'votingThreshold',
      'privacyDefault',
      'customContractsAllowed',
      'contentRestrictions',
      'minDocRequirements',
      'customContracts',
      'enforceStrictMinDoc',
    ] as const;

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        (space.settings as unknown as Record<string, unknown>)[key] = req.body[key];
      }
    }

    await space.save();
    res.json(space);
  },
);

export default router;
