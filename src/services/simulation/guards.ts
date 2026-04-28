import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../types';
import { ForbiddenError, AppError } from '../../utils/errors';

export function isSimModeOn(): boolean {
  const v = String(process.env.SIM_MODE ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export function getSimAdminAllowlist(): string[] {
  return String(process.env.SIM_ADMIN_ALIASES ?? '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

export function requireSimMode(_req: AuthRequest, _res: Response, next: NextFunction) {
  if (!isSimModeOn()) {
    throw new AppError('Simulation mode is disabled. Set SIM_MODE=on to enable.', 403);
  }
  next();
}

export function requireSimAdmin(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!isSimModeOn()) {
    throw new AppError('Simulation mode is disabled', 403);
  }
  const allow = getSimAdminAllowlist();
  // If allowlist is empty in dev, accept any authed user (still requires SIM_MODE=on).
  if (allow.length === 0) return next();
  const alias = req.node?.alias?.toLowerCase();
  if (!alias || !allow.includes(alias)) {
    throw new ForbiddenError('Not a simulation admin');
  }
  next();
}
