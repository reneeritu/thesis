import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { ChainNode } from '../models/Node';
import { AuthPayload, AuthRequest } from '../types';

/**
 * If a Bearer token is present and valid (including tokenVersion), attaches req.node.
 * If missing, invalid, or revoked, continues unauthenticated.
 */
export async function optionalAuth(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthPayload;
    const node = await ChainNode.findById(decoded.nodeId).select('tokenVersion').lean();
    if (node && node.tokenVersion === (decoded.tokenVersion ?? 0)) {
      req.node = { alias: decoded.alias, nodeId: decoded.nodeId, tokenVersion: decoded.tokenVersion };
    }
  } catch {
    // ignore invalid token in optional mode
  }

  next();
}

