import { Router, Response } from 'express';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createSpaceSchema,
  joinSpaceSchema,
  updateSpaceSettingsSchema,
} from '../schemas/space';
import { Space } from '../models/Space';
import { ChainNode } from '../models/Node';
import { AuthRequest } from '../types';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors';

const router = Router();

/**
 * POST /spaces
 * Create a new space. Creator becomes first admin and member.
 */
router.post('/', requireAuth, validate(createSpaceSchema), async (req: AuthRequest, res: Response) => {
  const { name, description, settings } = req.body;
  const alias = req.node!.alias;

  const space = await Space.create({
    name,
    description: description || '',
    creatorAlias: alias,
    admins: [alias],
    members: [alias],
    settings: {
      projectAccess: settings?.projectAccess || 'open',
      vetoAuthority: settings?.vetoAuthority || [],
      votingThreshold: settings?.votingThreshold ?? 0.5,
      privacyDefault: settings?.privacyDefault || 'space_specific',
      customContractsAllowed: settings?.customContractsAllowed ?? true,
      contentRestrictions: settings?.contentRestrictions || [],
      minDocRequirements: settings?.minDocRequirements || [],
    },
  });

  await ChainNode.findOneAndUpdate(
    { alias },
    { $addToSet: { spaces: space._id } },
  );

  res.status(201).json(space);
});

/**
 * GET /spaces/:id
 */
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const space = await Space.findById(req.params.id);
  if (!space) throw new NotFoundError('Space');

  const isMember = space.members.includes(req.node!.alias);

  res.json({
    ...space.toObject(),
    inviteCodes: isMember ? space.inviteCodes : undefined,
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

      const codeEntry = space.inviteCodes.find(
        (c) => c.code === inviteCode && !c.used,
      );
      if (!codeEntry) throw new AppError('Invalid or used invite code');

      codeEntry.used = true;
    } else if (space.settings.projectAccess === 'application') {
      throw new AppError(
        'This space requires an application — not yet implemented',
      );
    }

    space.members.push(alias);
    await space.save();

    await ChainNode.findOneAndUpdate(
      { alias },
      { $addToSet: { spaces: space._id } },
    );

    res.json({ message: `Joined space "${space.name}"` });
  },
);

/**
 * POST /spaces/:id/invite
 * Generate a single-use invite code (admin only).
 */
router.post(
  '/:id/invite',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const space = await Space.findById(req.params.id);
    if (!space) throw new NotFoundError('Space');

    if (!space.admins.includes(req.node!.alias)) {
      throw new ForbiddenError('Only admins can generate invite codes');
    }

    const code = crypto.randomBytes(6).toString('hex');
    space.inviteCodes.push({ code, used: false, createdAt: new Date() });
    await space.save();

    res.status(201).json({ inviteCode: code });
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
