import { Router, Response } from 'express';
import crypto from 'crypto';
import { AuthRequest } from '../types';
import { requireAuth } from '../middleware/auth';
import { requireSimMode, requireSimAdmin } from '../services/simulation/guards';
import { issueTokenForAlias } from '../services/simulation/tokenIssuer';
import { runScenario } from '../services/simulation/orchestrator';
import { buildScenario } from '../services/simulation/world';
import { applyScenario } from '../services/simulation/seed';
import { Application } from '../models/Application';
import {
  createRun,
  deleteRun,
  emptySnapshot,
  getRun,
  snapshot,
} from '../services/simulation/store';
import { AppError, NotFoundError } from '../utils/errors';

const router = Router();

function routeParamSimRunId(p: string | string[] | undefined): string {
  if (p === undefined) return '';
  return Array.isArray(p) ? (p[0] ?? '') : p;
}

/** POST /sim/run — kick off (or restart) a sim run. */
router.post('/run', requireAuth, requireSimAdmin, async (req: AuthRequest, res: Response) => {
  const givenId = (req.body?.simRunId as string | undefined)?.trim();
  const simRunId = givenId && /^[a-zA-Z0-9_-]{4,40}$/.test(givenId)
    ? givenId
    : `simrun_${crypto.randomBytes(4).toString('hex')}`;

  const existing = getRun(simRunId);
  if (existing) {
    deleteRun(simRunId);
  }
  const state = createRun(simRunId);
  state.status = 'idle';
  state.updatedAt = new Date().toISOString();

  const scenario = buildScenario(simRunId);
  void runScenario(state, scenario, applyScenario).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[sim] orchestrator crashed', err);
  });

  res.status(202).json({ simRunId, status: state.status });
});

/** GET /sim/status/:simRunId */
router.get('/status/:simRunId', requireSimMode, async (req: AuthRequest, res: Response) => {
  const simRunId = routeParamSimRunId(req.params.simRunId);
  const state = getRun(simRunId);
  if (!state) {
    return res.json(emptySnapshot(simRunId));
  }
  res.json(snapshot(state));
});

/** POST /sim/pause/:simRunId */
router.post('/pause/:simRunId', requireAuth, requireSimAdmin, async (req: AuthRequest, res: Response) => {
  const state = getRun(routeParamSimRunId(req.params.simRunId));
  if (!state) throw new NotFoundError('sim run');
  state.pause = true;
  state.status = state.status === 'running' ? 'paused' : state.status;
  state.updatedAt = new Date().toISOString();
  res.json(snapshot(state));
});

/** POST /sim/resume/:simRunId */
router.post('/resume/:simRunId', requireAuth, requireSimAdmin, async (req: AuthRequest, res: Response) => {
  const state = getRun(routeParamSimRunId(req.params.simRunId));
  if (!state) throw new NotFoundError('sim run');
  state.pause = false;
  if (state.status === 'paused') state.status = 'running';
  state.updatedAt = new Date().toISOString();
  res.json(snapshot(state));
});

/**
 * POST /sim/reset/:simRunId
 * Deletes non-Block sim docs tagged with this simRunId, then drops the run state.
 * Wave 2 will populate the scoped delete list. Stub: just drop run state for now.
 */
router.post('/reset/:simRunId', requireAuth, requireSimAdmin, async (req: AuthRequest, res: Response) => {
  const simRunId = routeParamSimRunId(req.params.simRunId);
  const deletions = await Promise.allSettled([
    Application.deleteMany({ simRunId }),
  ]);
  deleteRun(simRunId);
  res.json({
    message: `Sim run ${simRunId} reset (chain blocks preserved).`,
    deletions: deletions.map((d) => d.status),
  });
});

/** POST /sim/issue-token  body: { alias } */
router.post('/issue-token', requireAuth, requireSimAdmin, async (req: AuthRequest, res: Response) => {
  const alias = (req.body?.alias as string | undefined)?.trim();
  if (!alias) throw new AppError('alias required');
  const token = await issueTokenForAlias(alias);
  res.json({ token });
});

export default router;
