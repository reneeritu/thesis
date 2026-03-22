import { runProxyAutoConfirm } from './proxyConfirm';
import { runReputationDecay } from './reputationEngine';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_MONTH_MS = 30 * ONE_DAY_MS;

/**
 * Node's setTimeout/setInterval only accept a signed 32-bit delay in milliseconds.
 * Values above 2^31-1 overflow and clamp to 1ms — which made the monthly job run
 * in a tight loop and starve the server (502s, auth hanging) on Render.
 * @see https://nodejs.org/api/timers.html#setintervalcallback-delay-args
 */
const MAX_INTERVAL_MS = 0x7fffffff; // ~24.85 days

export function startScheduler(): void {
  setInterval(async () => {
    try {
      await runProxyAutoConfirm();
    } catch (err) {
      console.error('[scheduler] proxyAutoConfirm error:', err);
    }
  }, ONE_DAY_MS);

  const reputationIntervalMs = Math.min(ONE_MONTH_MS, MAX_INTERVAL_MS);
  setInterval(async () => {
    try {
      await runReputationDecay();
    } catch (err) {
      console.error('[scheduler] reputationDecay error:', err);
    }
  }, reputationIntervalMs);

  console.log('[scheduler] Background jobs started');
}