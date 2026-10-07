import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema, recoverSchema } from '../schemas/auth';
import { ChainNode, type IReputationCategories } from '../models/Node';
import { addBlock } from '../services/chain';
import {
  generateSeedPhrase,
  hashSeed,
  encryptSeedPhrase,
  hashPassword,
  verifyPassword,
  signToken,
} from '../services/auth';
import { AppError, ConflictError, UnauthorizedError } from '../utils/errors';
import { clearSessionCookie, setSessionCookie } from '../utils/sessionCookie';
import { requireAuth } from '../middleware/auth';
import { AuthRequest } from '../types';
import { config } from '../config';
import { chainDefaults } from '../config/defaults';

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
  // CrystalRadar3D: depth 3 â‰¥86, depth 2 â‰¥50, depth 1 â‰¥16).
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
 * Demo reputation on register â€” never on Render (real production).
 *
 * - Env `DEV_MANDALA_DEMO_SCORES=true` (etc.) works even when NODE_ENV=production
 *   locally (many people run the API that way). Put the var in the **repo root**
 *   `.env` (same folder as `package.json`), not `frontend/.env`.
 * - Code flag `APPLY_DEV_MANDALA_DEMO_SCORES` only runs when nodeEnv is development.
 */
function shouldSeedDevMandalaDemoScores(): boolean {
  if (config.nodeEnv !== 'development') return false
  if (envDevMandalaDemoScores()) return true
  if (APPLY_DEV_MANDALA_DEMO_SCORES) return true
  return false
}

/** Cost-12 hash so a missing account still spends a compare. Not a real password. */
const DUMMY_PASSWORD_HASH = '$2b$12$4FiqrIxH8ra0a.TsO.jOI.TCVi4gVT9gECn6nwvxLXY00iAoFlOVu'
/** Same length as a SHA-256 hex digest, so a missing account still compares. */
const DUMMY_SEED_HASH = '0'.repeat(64)

function hashesMatch(stored: string, incoming: string): boolean {
  const a = Buffer.from(stored)
  const b = Buffer.from(incoming)
  if (a.length === 0 || a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

function isDuplicateAlias(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000
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

  let node
  try {
    node = await ChainNode.create({
      alias,
      hashedPassword: hashed,
      seedHash: seedHashed,
      encryptedSeedPhrase: encryptedSeed,
      identityBlockIndex: 0,
    })
  } catch (err) {
    if (isDuplicateAlias(err)) throw new ConflictError('Alias already taken')
    throw err
  }

  const block = await addBlock('identity', alias, {
    alias,
    encryptedSeedPhrase: encryptedSeed,
  });
  node.identityBlockIndex = block.index
  await node.save()

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

  setSessionCookie(res, token);
  res.status(201).json({
    message: 'Account created. Save your seed phrase — it will not be shown again.',
    alias: node.alias,
    seedPhrase,
  });
});

/**
 * POST /auth/login
 */
router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  const { alias, password } = req.body;

  const node = await ChainNode.findOne({ alias });
  const valid = await verifyPassword(password, node?.hashedPassword ?? DUMMY_PASSWORD_HASH);
  if (!node || !valid) throw new UnauthorizedError('Invalid credentials');

  if (node.status === 'suspended') throw new AppError('Account suspended', 403);
  if (node.status === 'removed') throw new AppError('Account removed', 403);

  node.lastActiveAt = new Date();
  await node.save();

  const token = signToken({
    alias: node.alias,
    nodeId: node._id.toString(),
    tokenVersion: node.tokenVersion,
  });

  setSessionCookie(res, token);
  res.json({ alias: node.alias });
});

/**
 * POST /auth/recover
 * Seed phrase -> reset password immediately.
 */
router.post('/recover', validate(recoverSchema), async (req: Request, res: Response) => {
  const { alias, seedPhrase, newPassword } = req.body;

  const node = await ChainNode.findOne({ alias });
  const incoming = hashSeed(seedPhrase);
  const matches = hashesMatch(node?.seedHash || DUMMY_SEED_HASH, incoming);
  if (!node || !matches) throw new UnauthorizedError('Invalid credentials');

  node.hashedPassword = await hashPassword(newPassword);
  node.tokenVersion = (node.tokenVersion || 0) + 1;
  node.lastActiveAt = new Date();
  await node.save();

  const token = signToken({
    alias: node.alias,
    nodeId: node._id.toString(),
    tokenVersion: node.tokenVersion,
  });

  setSessionCookie(res, token);
  res.json({ message: 'Password reset successful', alias: node.alias });
});

router.post('/logout', (_req: Request, res: Response) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ alias: req.node!.alias, nodeId: req.node!.nodeId });
});

// Social recovery (POST/GET /auth/recover/trustees*) is disabled until a
// trustee-vote UI with owner notification and cancel exists.
// Trustee lists remain available via PUT /nodes/me/trustees.

export default router;
