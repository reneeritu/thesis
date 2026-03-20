import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { ChainNode } from '../models/Node';
import { AuthPayload, AuthRequest } from '../types';
import { UnauthorizedError } from '../utils/errors';

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

    const node = await ChainNode.findById(decoded.nodeId).select('tokenVersion').lean();
    if (!node || node.tokenVersion !== (decoded.tokenVersion ?? 0)) {
      throw new UnauthorizedError('Token revoked');
    }

    req.node = { alias: decoded.alias, nodeId: decoded.nodeId, tokenVersion: decoded.tokenVersion };
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError('Invalid or expired token');
  }
}
