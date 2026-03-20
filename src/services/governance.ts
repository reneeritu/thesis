import mongoose from 'mongoose';
import { ChainNode } from '../models/Node';
import { GovernanceComplexityLevel, IGovernanceProposal, IGovernanceResult, GovernanceScope } from '../models/GovernanceProposal';
import { chainDefaults } from '../config/defaults';
import { addBlock } from './chain';

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export type GovernanceDecision = IGovernanceResult['decision'];

export const GOVERNANCE_DISCUSS_DAYS_BY_LEVEL: Record<3 | 4, number> = {
  3: 14,
  4: 30,
};

export const GOVERNANCE_VOTING_DAYS_BY_LEVEL: Record<3 | 4, number> = {
  3: 7,
  4: 14,
};

export function computeComplexityLevel(scope: GovernanceScope): 3 | 4 {
  return scope === 'parameter' ? 3 : 4;
}

export async function computeEligibleActiveNodes(): Promise<number> {
  return ChainNode.countDocuments({ status: 'active' });
}

export function ceilPercentOf(n: number, percent: number): number {
  return Math.ceil((n * percent) / 100);
}

export async function computeResult(proposal: IGovernanceProposal): Promise<IGovernanceResult> {
  const eligibleActiveNodes = await computeEligibleActiveNodes();
  const votesCast = proposal.votes.length;
  const yesVotes = proposal.votes.filter((v) => v.approve).length;

  const quorumVotes = ceilPercentOf(eligibleActiveNodes, 10);
  const yesThreshold = ceilPercentOf(
    eligibleActiveNodes,
    proposal.complexityLevel === 3 ? 51 : 70,
  );

  const quorumMet = votesCast >= quorumVotes;

  let decision: GovernanceDecision;
  if (!quorumMet) {
    decision = 'failed_quorum';
  } else if (yesVotes >= yesThreshold) {
    decision = 'passed';
  } else {
    decision = 'rejected';
  }

  return {
    eligibleActiveNodes,
    votesCast,
    yesVotes,
    quorumVotes,
    yesThreshold,
    quorumMet,
    decision,
  };
}

export const SAFE_DEFAULTS_UPDATE_KEYS = [
  'moderatorCountByLevel',
  'moderatorInviteMultiplier',
  'moderatorAcceptDeadlineHours',
  'mediationTimeLockHours',
  'mediationMaxProposals',
  'falseEmergencyFlagPenalty',
  'moderatorBadFaithPenalty',
  'appealWindowDays',
  'maxAppeals',
] as const;

export type SafeDefaultsUpdateKey = (typeof SAFE_DEFAULTS_UPDATE_KEYS)[number];

export function getDiscussEndsAt(complexityLevel: 3 | 4, now = new Date()): Date {
  // Spec: discuss time lock depends on complexity level.
  // We reuse the spec's day mapping rather than mediation-only settings.
  const days = GOVERNANCE_DISCUSS_DAYS_BY_LEVEL[complexityLevel];
  return addDays(now, days);
}

export function getVotingEndsAt(complexityLevel: 3 | 4, now = new Date()): Date {
  const days = GOVERNANCE_VOTING_DAYS_BY_LEVEL[complexityLevel];
  return addDays(now, days);
}

export function validateSafeChangeKeys(changes: Record<string, unknown>): SafeDefaultsUpdateKey[] {
  const keys = Object.keys(changes) as string[];
  for (const k of keys) {
    if (!SAFE_DEFAULTS_UPDATE_KEYS.includes(k as SafeDefaultsUpdateKey)) {
      throw new Error(`Disallowed governance change key: ${k}`);
    }
  }
  return keys as SafeDefaultsUpdateKey[];
}

export async function applyGovernanceChanges(
  proposal: IGovernanceProposal,
): Promise<void> {
  const changes = proposal.changes ?? {};
  const keys = validateSafeChangeKeys(changes as Record<string, unknown>);

  // chainDefaults is exported as `const` but can be mutated at runtime.
  // We intentionally restrict updates to the safe whitelist.
  const mutableDefaults = chainDefaults as any;

  for (const key of keys) {
    mutableDefaults[key] = (changes as any)[key];
  }
}

export async function closeProposalAndExecute(
  proposal: IGovernanceProposal,
): Promise<IGovernanceResult> {
  const result = await computeResult(proposal);
  proposal.status = result.decision;
  proposal.result = result;

  if (result.decision === 'passed') {
    await applyGovernanceChanges(proposal);
  }

  await proposal.save();

  await addBlock('governance', proposal.proposerAlias, {
    proposalId: proposal._id.toString(),
    eventType: 'result',
    decision: result.decision,
    eligibleActiveNodes: result.eligibleActiveNodes,
    votesCast: result.votesCast,
    yesVotes: result.yesVotes,
    quorumVotes: result.quorumVotes,
    yesThreshold: result.yesThreshold,
    quorumMet: result.quorumMet,
  });

  return result;
}

export async function startVotingIfNeeded(
  proposal: IGovernanceProposal,
  now = new Date(),
): Promise<void> {
  if (proposal.status !== 'discussion') return;
  if (now < proposal.discussEndsAt) {
    throw new Error('Discussion period has not ended');
  }
  proposal.status = 'voting';
  proposal.votingEndsAt = getVotingEndsAt(proposal.complexityLevel, now);
  await proposal.save();
}

export function isVotingOver(proposal: IGovernanceProposal, now = new Date()): boolean {
  if (proposal.status !== 'voting') return false;
  if (!proposal.votingEndsAt) return true;
  return now > proposal.votingEndsAt;
}

