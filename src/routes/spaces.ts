import { Router, Response } from 'express';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createSpaceSchema,
  joinSpaceSchema,
  updateSpaceSettingsSchema,
  generateInviteSchema,
  vetoRespondSchema,
} from '../schemas/space';
import { Space } from '../models/Space';
import { ChainNode } from '../models/Node';
import { Notification } from '../models/Notification';
import { AuthRequest } from '../types';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors';

const router = Router();

const INVITE_DEFAULT_EXPIRY_DAYS = 15;

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * POST /spaces
 * Create a new space.
 * - Creator becomes first admin + member.
 * - Optional foundingMembers: other aliases added as admin/member immediately.
 * - Optional vetoAuthority aliases: stored in pendingVeto, notifications sent.
 *   Settings.vetoAuthority stays empty until each named node accepts.
 */
router.post('/', requireAuth, validate(createSpaceSchema), async (req: AuthRequest, res: Response) => {
  const { name, description, settings, foundingMembers } = req.body;
  const creatorAlias = req.node!.alias;

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

  const space = await Space.create({
    name,
    description: description || '',
    creatorAlias,
    admins,
    members,
    settings: {
      projectAccess: settings?.projectAccess || 'open',
      vetoAuthority: [],           // empty until accepted
      votingThreshold: settings?.votingThreshold ?? 0.5,
      privacyDefault: settings?.privacyDefault || 'space_specific',
      customContractsAllowed: settings?.customContractsAllowed ?? true,
      contentRestrictions: settings?.contentRestrictions || [],
      minDocRequirements: settings?.minDocRequirements || [],
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
    .select('name description status members settings')
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
    .select('name description creatorAlias members admins settings createdAt')
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
  }));

  res.json(out);
});

/**
 * GET /spaces/:id
 */
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const space = await Space.findById(req.params.id);
  if (!space) throw new NotFoundError('Space');

  const alias = req.node!.alias;
  const isMember = space.members.includes(alias);
  const isAdmin = space.admins.includes(alias);

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
      throw new AppError('This space requires an application — not yet implemented');
    }

    space.members.push(alias);
    await space.save();

    await ChainNode.findOneAndUpdate({ alias }, { $addToSet: { spaces: space._id } });

    res.json({ message: `Joined space "${space.name}"` });
  },
);

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
