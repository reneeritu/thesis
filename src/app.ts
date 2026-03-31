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

// TODO: All list endpoints (e.g. /traces/project/:id, /vetos/project/:id,
// /references/project/:id, /forks/parent/:id, etc.) currently return every
// record with no pagination. Add cursor-based or offset pagination with
// configurable page size once data volumes grow.

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
/** Static demo UI legacy endpoint */
app.use('/legacy', express.static(path.join(__dirname, '..', 'public')));

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

app.use('/notifications', notificationRoutes);

// Frontend SPA (built React app)
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));

// SPA fallback for any non-API GET request
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  // Let API and health routes pass through
  if (req.path.startsWith('/auth') || req.path.startsWith('/nodes') || req.path.startsWith('/spaces')) {
    return next();
  }
  if (req.path.startsWith('/projects') || req.path.startsWith('/traces') || req.path.startsWith('/vetos')) {
    return next();
  }
  if (req.path.startsWith('/pivots') || req.path.startsWith('/references') || req.path.startsWith('/credits')) {
    return next();
  }
  if (req.path.startsWith('/nfts') || req.path.startsWith('/forks') || req.path.startsWith('/archives')) {
    return next();
  }
  if (req.path.startsWith('/mediations') || req.path.startsWith('/flags') || req.path.startsWith('/governance')) {
    return next();
  }
  if (req.path.startsWith('/notifications') || req.path.startsWith('/health') || req.path.startsWith('/upload')) {
    return next();
  }
  const indexPath = path.join(frontendDist, 'index.html');
  res.sendFile(indexPath, function (err) {
    if (!err) return;
    // If the built frontend is missing (e.g. not built in this env), fall back to legacy static UI
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });
});

app.use(errorHandler);

export default app;
