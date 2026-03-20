import { runProxyAutoConfirm } from './proxyConfirm';
import { runReputationDecay } from './reputationEngine';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_MONTH_MS = 30 * ONE_DAY_MS;

export function startScheduler(): void {
  setInterval(async () => {
    try {
      await runProxyAutoConfirm();
    } catch (err) {
      console.error('[scheduler] proxyAutoConfirm error:', err);
    }
  }, ONE_DAY_MS);

  setInterval(async () => {
    try {
      await runReputationDecay();
    } catch (err) {
      console.error('[scheduler] reputationDecay error:', err);
    }
  }, ONE_MONTH_MS);

  console.log('[scheduler] Background jobs started');
}