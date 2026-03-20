import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createProposalSchema, voteSchema } from '../schemas/governance';
import { GovernanceProposal } from '../models/GovernanceProposal';
import { ChainNode } from '../models/Node';
import { AuthRequest } from '../types';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors';
import { addBlock } from '../services/chain';
import {
  applyGovernanceChanges,
  closeProposalAndExecute,
  computeComplexityLevel,
  getDiscussEndsAt,
  getVotingEndsAt,
  isVotingOver,
  startVotingIfNeeded,
} from '../services/governance';

const router = Router();

function assertActiveVotingWindow(proposal: any): void {
  if (proposal.status !== 'voting') return;
  if (!proposal.votingEndsAt) throw new AppError('Voting window not initialised');
  if (new Date() > new Date(proposal.votingEndsAt)) {
    // handled by close path
  }
}

/**
 * POST /proposals
 * Create a Tier-3 governance proposal.
 */
router.post(
  '/proposals',
  requireAuth,
  validate(createProposalSchema),
  async (req: AuthRequest, res: Response) => {
    const alias = req.node!.alias;
    const { scope, changes } = req.body;

    const complexityLevel = computeComplexityLevel(scope);
    const now = new Date();

    const discussEndsAt = getDiscussEndsAt(complexityLevel, now);

    const proposal = await GovernanceProposal.create({
      proposerAlias: alias,
      scope,
      complexityLevel,
      discussEndsAt,
      votingEndsAt: null,
      status: 'discussion',
      changes,
      votes: [],
      result: null,
    });

    await addBlock('governance', alias, {
      proposalId: proposal._id.toString(),
      eventType: 'proposal_created',
      scope,
      complexityLevel,
      discussEndsAt: proposal.discussEndsAt.toISOString(),
      changes,
    });

    res.status(201).json({ proposal, message: 'Governance proposal created' });
  },
);

/**
 * POST /proposals/:id/vote
 * Submit a vote. If discussion time-lock ended, automatically transition to voting and record the vote.
 */
router.post(
  '/proposals/:id/vote',
  requireAuth,
  validate(voteSchema),
  async (req: AuthRequest, res: Response) => {
    const alias = req.node!.alias;
    const { approve } = req.body;
    const proposalId = req.params.id;

    // Check node is active
    const node = await ChainNode.findOne({ alias: req.node!.alias });
    if (!node || node.status !== 'active') {
      throw new ForbiddenError('Only active nodes can participate in governance');
    }

    const proposal = await GovernanceProposal.findById(proposalId);
    if (!proposal) throw new NotFoundError('GovernanceProposal');

    if (proposal.status === 'passed' || proposal.status === 'failed_quorum' || proposal.status === 'rejected') {
      throw new AppError('Proposal already closed');
    }

    const now = new Date();

    // If in voting and voting window is already over, close on this attempt then reject this vote.
    if (proposal.status === 'voting' && isVotingOver(proposal, now)) {
      await closeProposalAndExecute(proposal);
      throw new AppError('Voting period ended — proposal closed');
    }

    // Transition discussion -> voting if discuss window ended.
    if (proposal.status === 'discussion') {
      if (now < proposal.discussEndsAt) {
        throw new AppError('Cannot vote yet — discussion period still active');
      }
      await startVotingIfNeeded(proposal, now);
    }

    // A node should not be able to vote during the discussion period.
    if (proposal.status !== 'voting') {
      throw new AppError(`Invalid proposal status for voting: ${proposal.status}`);
    }

    // Enforce one vote per node.
    const alreadyVoted = proposal.votes.some((v) => v.alias === alias);
    if (alreadyVoted) throw new AppError('You have already voted');

    if (!proposal.votingEndsAt) {
      proposal.votingEndsAt = getVotingEndsAt(proposal.complexityLevel, now);
    }

    proposal.votes.push({ alias, approve, votedAt: now });
    await proposal.save();

    const yesVotes = proposal.votes.filter((v) => v.approve).length;
    const votesCast = proposal.votes.length;

    await addBlock('governance', alias, {
      proposalId: proposal._id.toString(),
      eventType: 'vote',
      approve,
      yesVotes,
      votesCast,
    });

    res.json({ proposal, message: 'Vote recorded' });
  },
);

/**
 * POST /proposals/:id/close
 * Close the proposal after voting ends and execute changes if passed.
 */
router.post(
  '/proposals/:id/close',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const alias = req.node!.alias;
    const proposalId = req.params.id;

    // Check node is active
    const node = await ChainNode.findOne({ alias: req.node!.alias });
    if (!node || node.status !== 'active') {
      throw new ForbiddenError('Only active nodes can participate in governance');
    }

    const proposal = await GovernanceProposal.findById(proposalId);
    if (!proposal) throw new NotFoundError('GovernanceProposal');

    if (proposal.status === 'passed' || proposal.status === 'failed_quorum' || proposal.status === 'rejected') {
      return res.json({ proposal, message: 'Proposal already closed' });
    }

    if (proposal.status !== 'voting') {
      throw new AppError('Proposal is not in voting phase yet');
    }

    if (!proposal.votingEndsAt) {
      throw new AppError('Voting window not initialised');
    }

    if (new Date() < proposal.votingEndsAt) {
      throw new AppError('Voting period has not ended yet');
    }

    const result = await closeProposalAndExecute(proposal);

    // closeProposalAndExecute already appended governance_result block.
    res.json({ proposal, result, message: 'Proposal closed' });
  },
);

/**
 * GET /proposals/:id
 */
router.get(
  '/proposals/:id',
  async (req: AuthRequest, res: Response) => {
    const proposalId = req.params.id;
    const proposal = await GovernanceProposal.findById(proposalId).lean();
    if (!proposal) throw new NotFoundError('GovernanceProposal');
    res.json({ proposal });
  },
);

export default router;

