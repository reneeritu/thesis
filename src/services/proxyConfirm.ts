import { Trace } from '../models/Trace';
import { ChainNode } from '../models/Node';
import { addBlock } from './chain';
import { Notification } from '../models/Notification';

export async function runProxyAutoConfirm(): Promise<void> {
  const now = new Date();

  const expiredProxies = await Trace.find({
    isProxy: true,
    proxyConfirmed: false,
    proxyConfirmDeadline: { $lte: now, $ne: null },
  });

  let confirmed = 0;

  for (const trace of expiredProxies) {
    try {
      await addBlock('trace', trace.proxyForAlias || 'system', {
        action: 'proxy_auto_confirmed',
        traceId: trace._id,
        projectId: trace.projectId,
        confirmedBy: 'system_silence',
        method: 'auto_silence',
      });

      trace.proxyConfirmed = true;
      await trace.save();

      if (trace.proxyForAlias) {
        const targetExists = await ChainNode.exists({
          alias: trace.proxyForAlias,
          status: 'active',
        });

        if (targetExists) {
          await Notification.create({
            recipientAlias: trace.proxyForAlias,
            type: 'proxy_confirmation_needed',
            read: false,
            relatedId: trace._id.toString(),
            relatedType: 'trace',
            metadata: {
              message: 'A proxy log was auto-confirmed after 7 days of silence.',
              projectId: trace.projectId,
              loggedBy: trace.nodeAlias,
            },
          });
        }
      }

      confirmed++;
    } catch (err) {
      console.error(`[proxyAutoConfirm] Failed for trace ${trace._id}:`, err);
    }
  }

  console.log(`[proxyAutoConfirm] Confirmed ${confirmed} of ${expiredProxies.length} expired proxy logs`);
}