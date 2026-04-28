import type { ArcHandler, ArcContext } from './types';
import type { TimelineBeat } from '../types';
import { GovernanceProposal } from '../../../models/GovernanceProposal';
import { addBlock } from '../../chain';
import { bumpCounter } from '../store';
import { advanceGovernanceVotingClose } from '../timeAdvance';
import { heroAliasFor } from '../world';

const ARC_ID = 'governance' as const;

/** Deterministic approve: ~70% yes (mod 10 < 7). */
function approveFromAlias(alias: string): boolean {
  let h = 0;
  for (let i = 0; i < alias.length; i++) h = ((h << 5) - h + alias.charCodeAt(i)) | 0;
  const byte = (h >>> 0) & 0xff;
  return byte % 10 < 7;
}

function wrap(
  ctx: ArcContext,
  beat: TimelineBeat,
  label: string,
  fn: () => Promise<void>,
): Promise<void> {
  return (async () => {
    try {
      await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.emit({
        tick: beat.tick,
        type: 'arc:error',
        human: `${label}: ${msg}`,
      });
    }
  })();
}

async function onProposalPosted(ctx: ArcContext, beat: TimelineBeat): Promise<void> {
  const arc = ctx.scenario.arcs.find((a) => a.id === ARC_ID);
  if (!arc) {
    ctx.emit({
      tick: beat.tick,
      type: 'governance:warning',
      human: 'governance arc spec missing from scenario',
    });
    return;
  }

  const proposer = heroAliasFor(ctx.state.simRunId, 'researcher_2');
  if (
    ctx.state.heroNodeAliases.length > 0 &&
    !ctx.state.heroNodeAliases.includes(proposer)
  ) {
    ctx.emit({
      tick: beat.tick,
      type: 'governance:warning',
      human: 'researcher_2 not present in hero nodes for this run — skipping proposal_posted',
    });
    return;
  }

  await addBlock('governance', proposer, {
    scope: 'base_contract',
    simRunId: ctx.state.simRunId,
    arc: ARC_ID,
    action: 'posted',
    title: 'Mandatory AI Declaration',
  });

  const discussEndsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const proposal = await GovernanceProposal.create({
    proposerAlias: proposer,
    scope: 'base_contract',
    complexityLevel: 4,
    discussEndsAt,
    status: 'discussion',
    changes: {
      rule: 'mandatory_ai_declaration',
      requireForActivityTypes: ['ai_tool'],
    },
    votes: [],
  });

  ctx.state.projectIdByKey.set('governance_proposal', String(proposal._id));

  ctx.emit({
    tick: beat.tick,
    type: 'governance:proposal_posted',
    human: `${proposer} posted base-contract proposal "Mandatory AI Declaration" (discussion until ${discussEndsAt.toISOString()})`,
    refs: [{ kind: 'governanceProposal', id: String(proposal._id) }],
  });
}

async function onVotingOpens(ctx: ArcContext, beat: TimelineBeat): Promise<void> {
  const id = ctx.state.projectIdByKey.get('governance_proposal');
  if (!id) {
    ctx.emit({
      tick: beat.tick,
      type: 'governance:warning',
      human: 'governance_proposal id not on run state',
    });
    return;
  }

  const proposal = await GovernanceProposal.findById(id);
  if (!proposal) {
    ctx.emit({ tick: beat.tick, type: 'governance:warning', human: 'governance proposal not found' });
    return;
  }

  const votingEndsAt = new Date(Date.now() + 60 * 60 * 1000);
  const now = new Date();
  const votes = ctx.state.heroNodeAliases.map((alias) => ({
    alias,
    approve: approveFromAlias(alias),
    votedAt: now,
  }));

  proposal.status = 'voting';
  proposal.votingEndsAt = votingEndsAt;
  proposal.votes = votes;
  await proposal.save();

  const yes = votes.filter((v) => v.approve).length;
  ctx.emit({
    tick: beat.tick,
    type: 'governance:voting_opens',
    human: `Voting open for 1h — ${votes.length} hero votes cast (${yes} approve)`,
    refs: [{ kind: 'governanceProposal', id: id }],
  });
}

async function onProposalPassed(ctx: ArcContext, beat: TimelineBeat): Promise<void> {
  const id = ctx.state.projectIdByKey.get('governance_proposal');
  if (!id) {
    ctx.emit({
      tick: beat.tick,
      type: 'governance:warning',
      human: 'governance_proposal id not on run state',
    });
    return;
  }

  await advanceGovernanceVotingClose(id, ctx.state.simRunId);

  const proposal = await GovernanceProposal.findById(id);
  if (!proposal) {
    ctx.emit({ tick: beat.tick, type: 'governance:warning', human: 'governance proposal not found' });
    return;
  }

  const eligibleActiveNodes = ctx.state.heroNodeAliases.length;
  const votes = proposal.votes ?? [];
  const votesCast = votes.length;
  const yesVotes = votes.filter((v) => v.approve).length;
  const quorumVotes = Math.max(1, Math.ceil(eligibleActiveNodes * 0.3));
  const yesThreshold = 0.6;
  const approvalRate = votesCast > 0 ? yesVotes / votesCast : 0;
  const quorumMet = votesCast >= quorumVotes;
  const yesMet = votesCast > 0 && approvalRate >= yesThreshold;

  let status: typeof proposal.status;
  let decision: 'passed' | 'failed_quorum' | 'rejected';

  if (!quorumMet) {
    status = 'failed_quorum';
    decision = 'failed_quorum';
  } else if (yesMet) {
    status = 'passed';
    decision = 'passed';
  } else {
    status = 'rejected';
    decision = 'rejected';
  }

  proposal.status = status;
  proposal.result = {
    eligibleActiveNodes,
    votesCast,
    yesVotes,
    quorumVotes,
    yesThreshold,
    quorumMet,
    decision,
  };
  await proposal.save();

  const closer = heroAliasFor(ctx.state.simRunId, 'researcher_2');
  await addBlock('governance', closer, {
    simRunId: ctx.state.simRunId,
    arc: ARC_ID,
    action: 'closed',
    proposalId: id,
    status,
    decision,
    yesVotes,
    votesCast,
    eligibleActiveNodes,
  });

  if (decision === 'passed') {
    bumpCounter(ctx.state, 'governancePassed', 1);
  }

  ctx.emit({
    tick: beat.tick,
    type: 'governance:proposal_resolved',
    human: `Governance proposal ${decision}: ${yesVotes}/${votesCast} yes (quorum ${quorumMet ? 'met' : 'missed'})`,
    refs: [{ kind: 'governanceProposal', id: id }],
  });
}

export const governanceArc: ArcHandler = async (ctx, beat) => {
  switch (beat.action) {
    case 'proposal_posted':
      await wrap(ctx, beat, 'governance:proposal_posted', () => onProposalPosted(ctx, beat));
      break;
    case 'voting_opens':
      await wrap(ctx, beat, 'governance:voting_opens', () => onVotingOpens(ctx, beat));
      break;
    case 'proposal_passed':
      await wrap(ctx, beat, 'governance:proposal_passed', () => onProposalPassed(ctx, beat));
      break;
    default:
      ctx.emit({ tick: beat.tick, type: `governance:${beat.action}`, human: beat.human ?? '' });
  }
};
