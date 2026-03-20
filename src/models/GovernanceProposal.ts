import mongoose, { Schema, Document } from 'mongoose';

export const GOVERNANCE_SCOPES = ['parameter', 'base_contract'] as const;
export type GovernanceScope = (typeof GOVERNANCE_SCOPES)[number];

export const GOVERNANCE_COMPLEXITY_LEVELS = [3, 4] as const;
export type GovernanceComplexityLevel = (typeof GOVERNANCE_COMPLEXITY_LEVELS)[number];

export const GOVERNANCE_STATUSES = [
  'discussion',
  'voting',
  'closing',
  'passed',
  'failed_quorum',
  'rejected',
] as const;
export type GovernanceStatus = (typeof GOVERNANCE_STATUSES)[number];

export const GOVERNANCE_RESULT_DECISIONS = [
  'passed',
  'failed_quorum',
  'rejected',
] as const;
export type GovernanceDecision = (typeof GOVERNANCE_RESULT_DECISIONS)[number];

export interface IGovernanceVote {
  alias: string;
  approve: boolean;
  votedAt: Date;
}

export interface IGovernanceResult {
  eligibleActiveNodes: number;
  votesCast: number;
  yesVotes: number;
  quorumVotes: number;
  yesThreshold: number;
  quorumMet: boolean;
  decision: GovernanceDecision;
}

export interface IGovernanceProposal extends Document {
  proposerAlias: string;
  scope: GovernanceScope;
  complexityLevel: GovernanceComplexityLevel;
  discussEndsAt: Date;
  votingEndsAt: Date | null;
  status: GovernanceStatus;
  // Safe updates only (validated at API layer); stored as arbitrary JSON.
  changes: Record<string, unknown>;
  votes: IGovernanceVote[];
  result: IGovernanceResult | null;
  createdAt: Date;
  updatedAt: Date;
}

const voteSubSchema = new Schema<IGovernanceVote>(
  {
    alias: { type: String, required: true },
    approve: { type: Boolean, required: true },
    votedAt: { type: Date, required: true },
  },
  { _id: false },
);

const resultSubSchema = new Schema<IGovernanceResult>(
  {
    eligibleActiveNodes: { type: Number, required: true },
    votesCast: { type: Number, required: true },
    yesVotes: { type: Number, required: true },
    quorumVotes: { type: Number, required: true },
    yesThreshold: { type: Number, required: true },
    quorumMet: { type: Boolean, required: true },
    decision: { type: String, required: true, enum: GOVERNANCE_RESULT_DECISIONS },
  },
  { _id: false },
);

const governanceProposalSchema = new Schema<IGovernanceProposal>(
  {
    proposerAlias: { type: String, required: true },
    scope: { type: String, required: true, enum: GOVERNANCE_SCOPES },
    complexityLevel: {
      type: Number,
      required: true,
      enum: GOVERNANCE_COMPLEXITY_LEVELS,
    },
    discussEndsAt: { type: Date, required: true },
    votingEndsAt: { type: Date, default: null },
    status: {
      type: String,
      required: true,
      enum: GOVERNANCE_STATUSES,
      default: 'discussion',
    },
    changes: { type: Schema.Types.Mixed, required: true },
    votes: { type: [voteSubSchema], default: [] },
    result: { type: resultSubSchema, default: null },
  },
  { timestamps: true, versionKey: false },
);

governanceProposalSchema.index({ proposerAlias: 1 });
governanceProposalSchema.index({ status: 1 });
governanceProposalSchema.index({ discussEndsAt: 1 });
governanceProposalSchema.index({ votingEndsAt: 1 });

export const GovernanceProposal = mongoose.model<IGovernanceProposal>(
  'GovernanceProposal',
  governanceProposalSchema,
);

