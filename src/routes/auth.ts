import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema, recoverSchema } from '../schemas/auth';
import { ChainNode } from '../models/Node';
import { addBlock } from '../services/chain';
import {
  generateSeedPhrase,
  hashSeed,
  encryptSeedPhrase,
  hashPassword,
  verifyPassword,
  signToken,
} from '../services/auth';
import { AppError, ConflictError, NotFoundError, UnauthorizedError } from '../utils/errors';

const router = Router();

/**
 * POST /auth/register
 * Creates an account: alias + password -> seed phrase returned once.
 */
router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  const { alias, password } = req.body;

  const existing = await ChainNode.findOne({ alias });
  if (existing) {
    throw new ConflictError('Alias already taken');
  }

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

  const token = signToken({ alias: node.alias, nodeId: node._id.toString(), tokenVersion: node.tokenVersion });

  res.status(201).json({
    message: 'Account created. Save your seed phrase — it will not be shown again.',
    alias: node.alias,
    seedPhrase,
    token,
  });
});

/**
 * POST /auth/login
 * Alias + password -> JWT.
 */
router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  const { alias, password } = req.body;

  const node = await ChainNode.findOne({ alias });
  if (!node) throw new NotFoundError('Node');

  if (node.status === 'suspended') {
    throw new AppError('Account suspended', 403);
  }

  const valid = await verifyPassword(password, node.hashedPassword);
  if (!valid) throw new UnauthorizedError('Invalid credentials');

  node.lastActiveAt = new Date();
  await node.save();

  const token = signToken({ alias: node.alias, nodeId: node._id.toString(), tokenVersion: node.tokenVersion });

  res.json({ alias: node.alias, token });
});

/**
 * POST /auth/recover
 * Seed phrase -> reset password.
 *
 * TODO: Social recovery via trustees is not yet implemented. The spec defines
 * a flow where pre-selected trustees (3-5) vote to approve a recovery request
 * with a 72-hour time lock. Currently recovery only works via seed phrase.
 * Build the trustee-vote recovery flow once the notification system exists.
 */
router.post('/recover', validate(recoverSchema), async (req: Request, res: Response) => {
  const { alias, seedPhrase, newPassword } = req.body;

  const node = await ChainNode.findOne({ alias });
  if (!node) throw new NotFoundError('Node');

  const incoming = hashSeed(seedPhrase);
  if (incoming !== node.seedHash) {
    throw new UnauthorizedError('Seed phrase does not match');
  }

  node.hashedPassword = await hashPassword(newPassword);
  node.tokenVersion = (node.tokenVersion || 0) + 1;
  node.lastActiveAt = new Date();
  await node.save();

  const token = signToken({ alias: node.alias, nodeId: node._id.toString(), tokenVersion: node.tokenVersion });

  res.json({ message: 'Password reset successful', alias: node.alias, token });
});

export default router;
