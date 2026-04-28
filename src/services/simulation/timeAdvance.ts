import { Trace } from '../../models/Trace';
import { GovernanceProposal } from '../../models/GovernanceProposal';
import { Mediation } from '../../models/Mediation';
import { Flag } from '../../models/Flag';
import { addBlock } from '../chain';

/** Confirm or dispute a proxy log directly. */
export async function advanceProxyConfirm(
  traceId: string,
  action: 'confirm' | 'dispute',
  simRunId: string,
): Promise<void> {
  const trace = await Trace.findById(traceId);
  if (!trace) return;
  trace.proxyConfirmed = action === 'confirm';
  await trace.save();
  await addBlock('trace', trace.nodeAlias, {
    action: action === 'confirm' ? 'proxy_sim_confirmed' : 'proxy_sim_disputed',
    traceId: String(trace._id),
    simRunId,
    simAdvanced: true,
  });
}

/** Force governance proposal voting window to close NOW (still requires close handler). */
export async function advanceGovernanceVotingClose(
  proposalId: string,
  simRunId: string,
): Promise<void> {
  await GovernanceProposal.findByIdAndUpdate(proposalId, {
    $set: {
      votingEndsAt: new Date(Date.now() - 1000),
      simAdvancedNote: `Sim run ${simRunId} advanced voting close`,
    },
  });
}

/** Push a flag panel deadline forward by N hours (negative = into the past). */
export async function advanceFlagPanelDeadline(
  flagId: string,
  hoursDelta: number,
  simRunId: string,
): Promise<void> {
  const flag = await Flag.findById(flagId);
  if (!flag) return;
  const f = flag as unknown as Record<string, unknown>;
  const candidates = ['panelDeadline', 'rulingDeadline', 'deadline', 'closesAt'];
  for (const k of candidates) {
    if (f[k] instanceof Date) {
      f[k] = new Date((f[k] as Date).getTime() + hoursDelta * 3600 * 1000);
    }
  }
  (f as Record<string, unknown>).simAdvancedNote = `Sim run ${simRunId} advanced panel deadline by ${hoursDelta}h`;
  await (flag as unknown as { save: () => Promise<unknown> }).save();
}

/** Push a mediation deadline forward. */
export async function advanceMediationDeadline(
  mediationId: string,
  hoursDelta: number,
  simRunId: string,
): Promise<void> {
  const mediation = await Mediation.findById(mediationId);
  if (!mediation) return;
  const m = mediation as unknown as Record<string, unknown>;
  const candidates = ['peerDeadline', 'spaceDeadline', 'chainDeadline', 'currentDeadline'];
  for (const k of candidates) {
    if (m[k] instanceof Date) {
      m[k] = new Date((m[k] as Date).getTime() + hoursDelta * 3600 * 1000);
    }
  }
  (m as Record<string, unknown>).simAdvancedNote = `Sim run ${simRunId} advanced mediation deadline by ${hoursDelta}h`;
  await (mediation as unknown as { save: () => Promise<unknown> }).save();
}
