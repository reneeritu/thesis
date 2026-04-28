import { ArcHandler, ArcHandlerRegistry } from './types';
import { ArcId } from '../types';
import { healthyArc } from './healthy';
import { governanceArc } from './governance';
import { creditDisputeTier2Arc } from './credit_dispute';
import { plagiarismTier2Arc } from './plagiarism';
import { undercreditTier3UnsolvedArc } from './undercredit';

const stub: ArcHandler = async (ctx, beat) => {
  ctx.emit({
    tick: beat.tick,
    type: `${beat.arcId}:${beat.action}`,
    human: beat.human ?? `${beat.arcId} stub: ${beat.action}`,
  });
};

export const ARC_HANDLERS: ArcHandlerRegistry = {
  healthy_with_fork: healthyArc,
  credit_dispute_tier2: creditDisputeTier2Arc,
  plagiarism_tier2: plagiarismTier2Arc,
  undercredit_tier3_unsolved: undercreditTier3UnsolvedArc,
  governance: governanceArc,
};

export function getArcHandler(arcId: ArcId | 'world'): ArcHandler {
  if (arcId === 'world') {
    return async (ctx, beat) => {
      ctx.emit({
        tick: beat.tick,
        type: `world:${beat.action}`,
        human: beat.human ?? `world ${beat.action}`,
      });
    };
  }
  return ARC_HANDLERS[arcId] ?? stub;
}
