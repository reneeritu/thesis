import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema, recoverSchema } from '../schemas/auth';
import { ChainNode, type IReputationCategories } from '../models/Node';
import { RecoveryRequest } from '../models/RecoveryRequest';
import { Notification } from '../models/Notification';
import { addBlock } from '../services/chain';
import {
  generateSeedPhrase,
  hashSeed,
  encryptSeedPhrase,
  hashPassword,
  verifyPassword,
  signToken,
} from '../services/auth';
import { AppError, ConflictError, NotFoundError, UnauthorizedError, ForbiddenError } from '../utils/errors';
import { config } from '../config';
import { chainDefaults } from '../config/defaults';
import { AuthRequest } from '../types';

const router = Router();

/**
 * When true (development only), new registrations get high per-category reputation so
 * the 3D mandala shows full recursion without grinding traces. Flip locally; leave false
 * in git. Alternatively set env `DEV_MANDALA_DEMO_SCORES=true`.
 */
const APPLY_DEV_MANDALA_DEMO_SCORES = false;

function devMandalaDemoReputation(): {
  reputationCategories: IReputationCategories;
  reputationScore: number;
} {
  // Varied per arm so you see different fractal depths side-by-side (thresholds in
  // CrystalRadar3D: depth 3 ≥86, depth 2 ≥50, depth 1 ≥16).
  const reputationCategories: IReputationCategories = {
    craft: 940,
    research: 720,
    collaboration: 520,
    pedagogy: 280,
    consistency: 120,
    community: 900,
  };
  const sum = Object.values(reputationCategories).reduce((a, b) => a + b, 0);
  const reputationScore = Math.min(
    chainDefaults.reputationCap,
    Math.max(chainDefaults.reputationFloor, Math.round(sum / 6)),
  );
  return { reputationCategories, reputationScore };
}

function envDevMandalaDemoScores(): boolean {
  const v = String(process.env.DEV_MANDALA_DEMO_SCORES ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

/**
 * Demo reputation on register — never on Render (real production).
 *
 * - Env `DEV_MANDALA_DEMO_SCORES=true` (etc.) works even when NODE_ENV=production
 *   locally (many people run the API that way). Put the var in the **repo root**
 *   `.env` (same folder as `package.json`), not `frontend/.env`.
 * - Code flag `APPLY_DEV_MANDALA_DEMO_SCORES` only runs when nodeEnv is development.
 */
function shouldSeedDevMandalaDemoScores(): boolean {
  if (process.env.RENDER === 'true') return false

  if (envDevMandalaDemoScores()) return true
  if (APPLY_DEV_MANDALA_DEMO_SCORES && config.nodeEnv === 'development') return true
  return false
}

/**
 * POST /auth/register
 * Creates an account: alias + password -> seed phrase returned once.
 */
router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  const { alias, password } = req.body;

  const existing = await ChainNode.findOne({ alias });
  if (existing) throw new ConflictError('Alias already taken');

  const seedPhrase = generateSeedPhrase();
  const hashed = await hashPassword(password);
  const seedHashed = hashSeed(seedPhrase);
  const encryptedSeed = encryptSeedPhrase(seedPhrase);

  const block = await addBlock('identity', alias, {
    alias,
    encryptedSeedPhrase: encryptedSeed,
  });

  const node = await ChainNode.create({
    alias,
    hashedPassword: hashed,
    seedHash: seedHashed,
    encryptedSeedPhrase: encryptedSeed,
    identityBlockIndex: block.index,
  });

  if (shouldSeedDevMandalaDemoScores()) {
    const demo = devMandalaDemoReputation()
    // Atomic $set avoids Mongoose subdocument merge quirks on assign + save().
    await ChainNode.findByIdAndUpdate(node._id, {
      $set: {
        reputationCategories: demo.reputationCategories,
        reputationScore: demo.reputationScore,
      },
    })
    console.log(
      `[auth] DEV_MANDALA_DEMO_SCORES: seeded demo reputation for "${alias}" (categories + aggregate score).`,
    )
  }

  const token = signToken({
    alias: node.alias,
    nodeId: node._id.toString(),
    tokenVersion: node.tokenVersion,
  });

  res.status(201).json({
    message: 'Account created. Save your seed phrase — it will not be shown again.',
    alias: node.alias,
    seedPhrase,
    token,
  });
});

/**
 * POST /auth/login
 */
router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  const { alias, password } = req.body;

  const node = await ChainNode.findOne({ alias });
  if (!node) throw new NotFoundError('Node');

  if (node.status === 'suspended') throw new AppError('Account suspended', 403);
  if (node.status === 'removed') throw new AppError('Account removed', 403);

  const valid = await verifyPassword(password, node.hashedPassword);
  if (!valid) throw new UnauthorizedError('Invalid credentials');

  node.lastActiveAt = new Date();
  await node.save();

  const token = signToken({
    alias: node.alias,
    nodeId: node._id.toString(),
    tokenVersion: node.tokenVersion,
  });

  res.json({ alias: node.alias, token });
});

/**
 * POST /auth/recover
 * Seed phrase -> reset password immediately.
 */
router.post('/recover', validate(recoverSchema), async (req: Request, res: Response) => {
  const { alias, seedPhrase, newPassword } = req.body;

  const node = await ChainNode.findOne({ alias });
  if (!node) throw new NotFoundError('Node');

  const incoming = hashSeed(seedPhrase);
  if (incoming !== node.seedHash) throw new UnauthorizedError('Seed phrase does not match');

  node.hashedPassword = await hashPassword(newPassword);
  node.tokenVersion = (node.tokenVersion || 0) + 1;
  node.lastActiveAt = new Date();
  await node.save();

  const token = signToken({
    alias: node.alias,
    nodeId: node._id.toString(),
    tokenVersion: node.tokenVersion,
  });

  res.json({ message: 'Password reset successful', alias: node.alias, token });
});

/**
 * POST /auth/recover/trustees
 * Initiate social recovery via trustees.
 * Creates a recovery request and notifies all trustees.
 * Time-locked for 72 hours (spec: socialRecoveryTimeLockHours).
 */
router.post('/recover/trustees', async (req: Request, res: Response) => {
  const { alias, newPassword } = req.body;

  if (!alias || !newPassword) {
    throw new AppError('alias and newPassword are required');
  }

  const node = await ChainNode.findOne({ alias });
  if (!node) throw new NotFoundError('Node');

  if (node.trustees.length < chainDefaults.socialRecoveryMinTrustees) {
    throw new AppError(
      `Node has fewer than ${chainDefaults.socialRecoveryMinTrustees} trustees set. Social recovery unavailable.`,
    );
  }

  // Only one pending recovery request at a time
  const existing = await RecoveryRequest.findOne({
    nodeAlias: alias,
    status: 'pending',
  });
  if (existing) {
    throw new AppError('A recovery request is already pending for this account');
  }

  const newPasswordHash = await hashPassword(newPassword);
  const expiresAt = new Date(
    Date.now() + chainDefaults.socialRecoveryTimeLockHours * 60 * 60 * 1000,
  );

  const recovery = await RecoveryRequest.create({
    nodeAlias: alias,
    newPasswordHash,
    trustees: node.trustees,
    votes: [],
    status: 'pending',
    expiresAt,
  });

  // Notify all trustees
  for (const trusteeAlias of node.trustees) {
    const trusteeExists = await ChainNode.exists({
      alias: trusteeAlias,
      status: 'active',
    });
    if (trusteeExists) {
      await Notification.create({
        recipientAlias: trusteeAlias,
        type: 'collaboration_request',
        read: false,
        relatedId: recovery._id.toString(),
        relatedType: 'recovery_request',
        metadata: {
          message: `${alias} is requesting account recovery. Please vote to approve or deny.`,
          nodeAlias: alias,
          recoveryRequestId: recovery._id.toString(),
          expiresAt: expiresAt.toISOString(),
        },
      });
    }
  }

  res.status(201).json({
    message: `Recovery request created. ${node.trustees.length} trustees have been notified. They have ${chainDefaults.socialRecoveryTimeLockHours} hours to vote.`,
    recoveryRequestId: recovery._id,
    expiresAt,
    trusteesNotified: node.trustees.length,
  });
});

/**
 * POST /auth/recover/trustees/:requestId/vote
 * A trustee votes to approve or deny a recovery request.
 */
router.post(
  '/recover/trustees/:requestId/vote',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const alias = req.node!.alias;
    const { approve } = req.body;

    if (typeof approve !== 'boolean') {
      throw new AppError('approve must be true or false');
    }

    const recovery = await RecoveryRequest.findById(req.params.requestId);
    if (!recovery) throw new NotFoundError('RecoveryRequest');

    if (recovery.status !== 'pending') {
      throw new AppError('This recovery request is no longer pending');
    }

    if (new Date() > recovery.expiresAt) {
      recovery.status = 'expired';
      await recovery.save();
      throw new AppError('Recovery request has expired');
    }

    // Must be a designated trustee
    if (!recovery.trustees.includes(alias)) {
      throw new ForbiddenError('You are not a trustee for this recovery request');
    }

    // One vote per trustee
    if (recovery.votes.some((v) => v.trusteeAlias === alias)) {
      throw new AppError('You have already voted on this recovery request');
    }

    recovery.votes.push({
      trusteeAlias: alias,
      approved: approve,
      votedAt: new Date(),
    });

    // Check if majority reached
    const totalTrustees = recovery.trustees.length;
    const requiredVotes = Math.ceil(
      totalTrustees * chainDefaults.socialRecoveryMajorityFraction,
    );
    const approveVotes = recovery.votes.filter((v) => v.approved).length;
    const denyVotes = recovery.votes.filter((v) => !v.approved).length;
    const remainingVotes = totalTrustees - recovery.votes.length;

    // Majority approved
    if (approveVotes >= requiredVotes) {
      recovery.status = 'approved';
      await recovery.save();

      // Apply the password reset
      const node = await ChainNode.findOne({ alias: recovery.nodeAlias });
      if (node) {
        node.hashedPassword = recovery.newPasswordHash;
        node.tokenVersion = (node.tokenVersion || 0) + 1;
        node.lastActiveAt = new Date();
        await node.save();

        // Notify the recovering node
        await Notification.create({
          recipientAlias: recovery.nodeAlias,
          type: 'appeal_update',
          read: false,
          relatedId: recovery._id.toString(),
          relatedType: 'recovery_request',
          metadata: {
            message: 'Your account recovery was approved by your trustees. Please log in with your new password.',
          },
        });
      }

      return res.json({
        message: 'Recovery approved — password has been reset',
        status: 'approved',
      });
    }

    // Majority denied or impossible to reach approval
    if (denyVotes > totalTrustees - requiredVotes || remainingVotes + approveVotes < requiredVotes) {
      recovery.status = 'rejected';
      await recovery.save();

      await Notification.create({
        recipientAlias: recovery.nodeAlias,
        type: 'appeal_update',
        read: false,
        relatedId: recovery._id.toString(),
        relatedType: 'recovery_request',
        metadata: {
          message: 'Your account recovery request was denied by your trustees.',
        },
      });

      return res.json({
        message: 'Recovery denied by trustees',
        status: 'rejected',
      });
    }

    await recovery.save();

    res.json({
      message: 'Vote recorded',
      approveVotes,
      denyVotes,
      requiredVotes,
      remainingVotes,
    });
  },
);

/**
 * GET /auth/recover/trustees/:requestId
 * Check status of a recovery request.
 * Only the node being recovered or their trustees can view it.
 */
router.get(
  '/recover/trustees/:requestId',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const alias = req.node!.alias;
    const recovery = await RecoveryRequest.findById(req.params.requestId);
    if (!recovery) throw new NotFoundError('RecoveryRequest');

    const isNodeOrTrustee =
      recovery.nodeAlias === alias || recovery.trustees.includes(alias);
    if (!isNodeOrTrustee) {
      throw new ForbiddenError('You do not have access to this recovery request');
    }

    res.json(recovery);
  },
);

export default router;