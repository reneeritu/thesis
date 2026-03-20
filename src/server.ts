import app from './app';
import { config } from './config';
import { connectDatabase } from './config/database';
import { ensureGenesis } from './services/chain';
import { ensureUploadDir } from './services/media';
import { startScheduler } from './services/scheduler';

async function start() {
  await connectDatabase();
  await ensureGenesis();
  ensureUploadDir();
  startScheduler();

  app.listen(config.port, () => {
    console.log(
      `aura2 backend running on port ${config.port} [${config.nodeEnv}]`,
    );
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});