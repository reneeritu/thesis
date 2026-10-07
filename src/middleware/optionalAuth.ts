import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { ChainNode } from '../models/Node';
import { AuthPayload, AuthRequest } from '../types';
import { readSessionToken } from '../utils/sessionCookie';

/**
 * If a Bearer token is present and valid (including tokenVersion), attaches req.node.
 * If missing, invalid, or revoked, continues unauthenticated.
 */
export async function optionalAuth(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = readSessionToken(req);
  if (!token) {
    next();
    return;
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthPayload;
    const node = await ChainNode.findById(decoded.nodeId).select('tokenVersion status').lean();
    const blocked = node?.status === 'suspended' || node?.status === 'removed';
    if (node && !blocked && node.tokenVersion === (decoded.tokenVersion ?? 0)) {
      req.node = { alias: decoded.alias, nodeId: decoded.nodeId, tokenVersion: decoded.tokenVersion };
    }
  } catch {
    // ignore invalid token in optional mode
  }

  next();
}

