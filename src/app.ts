import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
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

/** False until Mongo + genesis finish — API routes return 503 until then. */
let ready = false;

export function setReady(value: boolean): void {
  ready = value;
}

export function isReady(): boolean {
  return ready;
}

app.use(helmet({
  // Allow Google Fonts + Vite-built assets; keep sensible defaults otherwise.
  contentSecurityPolicy: false,
}));
app.use(compression());
app.use(cors());
app.use(express.json());

const publicDir = path.join(__dirname, '..', 'public');
/** Legacy static UI (original site) */
app.use('/legacy', express.static(publicDir));
// Serve legacy JS/CSS assets so /legacy/index.html works correctly
app.use('/js', express.static(path.join(publicDir, 'js')));
app.use('/css', express.static(path.join(publicDir, 'css')));

app.get('/health', (_req, res) => {
  // Always 200 so Render/free-tier probes succeed during Mongo connect.
  res.json({
    status: ready ? 'ok' : 'starting',
    ready,
    timestamp: new Date().toISOString(),
  });
});

// Gate mutating / JSON API traffic until the DB is up. Static assets still serve.
app.use((req, res, next) => {
  if (ready) return next();
  const p = req.path;
  if (
    p === '/health' ||
    p.startsWith('/legacy') ||
    p.startsWith('/js') ||
    p.startsWith('/css') ||
    p === '/robots.txt' ||
    p === '/sitemap.xml' ||
    p === '/og.png' ||
    p === '/favicon.svg' ||
    p.startsWith('/assets/')
  ) {
    return next();
  }
  // Allow HTML shell so the SPA can download while DB connects.
  const accept = req.headers.accept ?? '';
  if (req.method === 'GET' && accept.includes('text/html')) {
    return next();
  }
  if (req.method === 'GET' && !accept.includes('application/json')) {
    return next();
  }
  res.status(503).json({
    error: 'Service starting — database not ready yet. Retry in a few seconds.',
  });
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

// Hashed Vite assets — long cache. HTML stays short-lived via SPA fallback.
app.use(
  '/assets',
  express.static(path.join(frontendDist, 'assets'), {
    maxAge: '1y',
    immutable: true,
    etag: true,
  }),
);

app.use(
  express.static(frontendDist, {
    maxAge: config.nodeEnv === 'production' ? '1h' : 0,
    index: false,
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
      if (
        filePath.endsWith('robots.txt') ||
        filePath.endsWith('sitemap.xml')
      ) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Content-Type', filePath.endsWith('xml')
          ? 'application/xml; charset=utf-8'
          : 'text/plain; charset=utf-8');
      }
    },
  }),
);

// SPA fallback for non-API GET requests.
//
// Rule: if the request looks like a browser page navigation (Accept includes
// text/html), always serve index.html and let React Router handle the path.
// API calls from the SPA always include "application/json" in Accept so they
// correctly pass through to the Express routes above.
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  const accept = req.headers.accept ?? '';
  // Pass through if the caller wants JSON (API call from the SPA / curl).
  if (accept.includes('application/json') && !accept.includes('text/html')) {
    return next();
  }
  const p = req.path;
  // Never soft-404 SEO / health / binary paths as the SPA shell.
  if (
    p.startsWith('/health') ||
    p.startsWith('/upload') ||
    p.startsWith('/media') ||
    p === '/robots.txt' ||
    p === '/sitemap.xml' ||
    p === '/og.png' ||
    p === '/favicon.svg' ||
    p.startsWith('/assets/')
  ) {
    return next();
  }
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.use(errorHandler);

export default app;
