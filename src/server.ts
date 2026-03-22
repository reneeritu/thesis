/**
 * Startup order matters on PaaS (e.g. Render):
 * - Do NOT static-import `./app` at the top: it pulls in all routes → `sharp` native bindings
 *   can crash the process on some Node versions before any logs run.
 * - Connect DB and run genesis first; then dynamic-import `app` and listen.
 */
import { config } from './config';
import { connectDatabase } from './config/database';
import { ensureGenesis } from './services/chain';
import { ensureUploadDir } from './services/media';
import { startScheduler } from './services/scheduler';

function assertProductionEnv(): void {
  const isProdLike =
    config.nodeEnv === 'production' || process.env.RENDER === 'true';
  if (!isProdLike) return;

  const fatal = (msg: string) => {
    console.error(`\n[FATAL] ${msg}\n`);
    process.exit(1);
  };

  if (!process.env.MONGODB_URI?.trim()) {
    fatal(
      'MONGODB_URI is not set. On Render: Environment → add MONGODB_URI with your MongoDB Atlas connection string (not localhost).',
    );
  }

  if (
    !process.env.JWT_SECRET?.trim() ||
    process.env.JWT_SECRET === 'dev-secret-change-me'
  ) {
    fatal(
      'JWT_SECRET is missing or still the dev default. On Render: Environment → set JWT_SECRET to a long random secret.',
    );
  }

  const key = process.env.ENCRYPTION_KEY?.trim() || '';
  if (key.length !== 64 || !/^[0-9a-fA-F]+$/.test(key)) {
    fatal(
      'ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes). Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
}

async function start() {
  console.log(
    `[aura2] boot PORT=${config.port} NODE_ENV=${config.nodeEnv} RENDER=${process.env.RENDER ?? 'unset'}`,
  );

  assertProductionEnv();

  await connectDatabase();
  await ensureGenesis();
  ensureUploadDir();
  startScheduler();

  const { default: app } = await import('./app');

  app.listen(config.port, '0.0.0.0', () => {
    console.log(
      `aura2 backend listening on 0.0.0.0:${config.port} [${config.nodeEnv}]`,
    );
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
