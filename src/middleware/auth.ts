import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { ChainNode } from '../models/Node';
import { AuthPayload, AuthRequest } from '../types';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';

export async function requireAuth(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed token');
  }

  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthPayload;

    const node = await ChainNode.findById(decoded.nodeId)
      .select('tokenVersion status')
      .lean();

    if (!node || node.tokenVersion !== (decoded.tokenVersion ?? 0)) {
      throw new UnauthorizedError('Token revoked');
    }

    // Suspended or removed nodes cannot act on the chain
    if (node.status === 'suspended') {
      throw new ForbiddenError('Your account is suspended');
    }
    if (node.status === 'removed') {
      throw new ForbiddenError('Your account has been removed from the chain');
    }

    req.node = {
      alias: decoded.alias,
      nodeId: decoded.nodeId,
      tokenVersion: decoded.tokenVersion,
    };
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    if (err instanceof ForbiddenError) throw err;
    throw new UnauthorizedError('Invalid or expired token');
  }
}