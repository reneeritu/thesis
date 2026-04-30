import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import notificationRoutes from './routes/notifications';
import authRoutes from './routes/auth';
import nodeRoutes from './routes/nodes';
import spaceRoutes from './routes/spaces';
import projectRoutes from './routes/projects';
import traceRoutes from './routes/traces';
import uploadRoutes from './routes/upload';
import vetoRoutes from './routes/vetos';
import pivotRoutes from './routes/pivots';
import referenceRoutes from './routes/references';
import creditRoutes from './routes/credits';
import forkRoutes from './routes/forks';
import archiveRoutes from './routes/archives';
import nftRoutes from './routes/nfts';
import mediationRoutes from './routes/mediations';
import flagRoutes from './routes/flags';
import governanceRoutes from './routes/governance';
import discoverRoutes from './routes/discover';
import endorsementRoutes from './routes/endorsements';
import simRoutes from './routes/sim';
import conversationRoutes from './routes/conversations';
import adminRoutes from './routes/admin';

// TODO: All list endpoints (e.g. /traces/project/:id, /vetos/project/:id,
// /references/project/:id, /forks/parent/:id, etc.) currently return every
// record with no pagination. Add cursor-based or offset pagination with
// configurable page size once data volumes grow.

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

const publicDir = path.join(__dirname, '..', 'public');
/** Legacy static UI (original site) */
app.use('/legacy', express.static(publicDir));
// Serve legacy JS/CSS assets so /legacy/index.html works correctly
app.use('/js', express.static(path.join(publicDir, 'js')));
app.use('/css', express.static(path.join(publicDir, 'css')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (config.nodeEnv === 'production') {
  app.use(
    '/auth/login',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many login attempts, try again later' },
    }),
  );
  app.use(
    '/auth/register',
    rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many accounts created, try again later' },
    }),
  );
}

app.use('/auth', authRoutes);
app.use('/nodes', nodeRoutes);
app.use('/spaces', spaceRoutes);
app.use('/projects', projectRoutes);
app.use('/traces', traceRoutes);
app.use('/', uploadRoutes);
app.use('/vetos', vetoRoutes);
app.use('/pivots', pivotRoutes);
app.use('/references', referenceRoutes);
app.use('/credits', creditRoutes);
app.use('/nfts', nftRoutes);
app.use('/forks', forkRoutes);
app.use('/archives', archiveRoutes);
app.use('/mediations', mediationRoutes);
app.use('/flags', flagRoutes);
app.use('/governance', governanceRoutes);
app.use('/discover', discoverRoutes);
app.use('/endorsements', endorsementRoutes);
app.use('/conversations', conversationRoutes);

app.use('/notifications', notificationRoutes);
app.use('/sim', simRoutes);
app.use('/api/admin', adminRoutes);

// React SPA (frontend/dist) at root
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));

// SPA fallback for non-API GET requests.
//
// Rule: if the request looks like a browser page navigation (Accept includes
// text/html), always serve index.html and let React Router handle the path.
// API calls from the SPA always include "application/json" in Accept so they
// correctly pass through to the Express routes above.
//
// This replaces the old blocklist approach which caused "Cannot GET /:spa-path"
// errors whenever a new SPA route shared a prefix with an API route (e.g.
// /nfts/:id navigating to /nfts/:id/artwork in the browser).
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  const accept = req.headers.accept ?? '';
  // Pass through if the caller wants JSON (API call from the SPA / curl).
  if (accept.includes('application/json') && !accept.includes('text/html')) {
    return next();
  }
  // Let static assets pass through to errorHandler (they'll 404 gracefully).
  const p = req.path;
  if (p.startsWith('/health') || p.startsWith('/upload') || p.startsWith('/media')) {
    return next();
  }
  // Everything else (browser navigation) → SPA entry point.
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.use(errorHandler);

export default app;
