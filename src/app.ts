import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
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

app.get('/', (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>aura2</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #0a0a0a;
          color: #e0e0e0;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          max-width: 640px;
          padding: 3rem 2rem;
          text-align: center;
        }
        h1 {
          font-size: 2.5rem;
          font-weight: 300;
          letter-spacing: 0.3em;
          margin-bottom: 0.5rem;
          color: #fff;
        }
        .subtitle {
          font-size: 0.9rem;
          color: #888;
          margin-bottom: 2.5rem;
        }
        .status {
          display: inline-block;
          background: #111;
          border: 1px solid #222;
          border-radius: 8px;
          padding: 1rem 2rem;
          margin-bottom: 2.5rem;
        }
        .dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          background: #4ade80;
          border-radius: 50%;
          margin-right: 8px;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .endpoints {
          text-align: left;
          background: #111;
          border: 1px solid #222;
          border-radius: 8px;
          padding: 1.5rem;
        }
        .endpoints h2 {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: #666;
          margin-bottom: 1rem;
        }
        .endpoint {
          display: flex;
          align-items: baseline;
          padding: 0.4rem 0;
          font-size: 0.85rem;
          border-bottom: 1px solid #1a1a1a;
        }
        .endpoint:last-child { border-bottom: none; }
        .method {
          font-weight: 600;
          width: 55px;
          flex-shrink: 0;
          color: #60a5fa;
          font-family: monospace;
        }
        .method.post { color: #4ade80; }
        .method.patch { color: #facc15; }
        .method.put { color: #f97316; }
        .method.delete { color: #f87171; }
        .path {
          font-family: monospace;
          color: #ccc;
          flex-shrink: 0;
          margin-right: 1rem;
        }
        .desc { color: #666; font-size: 0.8rem; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>aura2</h1>
        <p class="subtitle">Art Process Documentation Chain &amp; dApp</p>
        <div class="status">
          <span class="dot"></span>
          <span style="font-size:0.85rem;">API running</span>
        </div>
        <div class="endpoints">
          <h2>Endpoints</h2>
          <div class="endpoint"><span class="method">GET</span><span class="path">/health</span><span class="desc">Health check</span></div>
          <div class="endpoint"><span class="method post">POST</span><span class="path">/auth/register</span><span class="desc">Create account</span></div>
          <div class="endpoint"><span class="method post">POST</span><span class="path">/auth/login</span><span class="desc">Login</span></div>
          <div class="endpoint"><span class="method post">POST</span><span class="path">/auth/recover</span><span class="desc">Seed phrase recovery</span></div>
          <div class="endpoint"><span class="method">GET</span><span class="path">/nodes/:alias</span><span class="desc">View profile</span></div>
          <div class="endpoint"><span class="method patch">PATCH</span><span class="path">/nodes/me</span><span class="desc">Update profile</span></div>
          <div class="endpoint"><span class="method post">POST</span><span class="path">/spaces</span><span class="desc">Create space</span></div>
          <div class="endpoint"><span class="method post">POST</span><span class="path">/spaces/:id/join</span><span class="desc">Join space</span></div>
          <div class="endpoint"><span class="method post">POST</span><span class="path">/projects</span><span class="desc">START contract</span></div>
          <div class="endpoint"><span class="method post">POST</span><span class="path">/traces</span><span class="desc">TRACE contract</span></div>
          <div class="endpoint"><span class="method post">POST</span><span class="path">/upload</span><span class="desc">Upload file</span></div>
        </div>
      </div>
    </body>
    </html>
  `);
});

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
app.use('/forks', forkRoutes);
app.use('/archives', archiveRoutes);
app.use('/mediations', mediationRoutes);
app.use('/flags', flagRoutes);
app.use('/governance', governanceRoutes);

app.use(errorHandler);

export default app;
