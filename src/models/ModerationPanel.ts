import mongoose, { Schema, Document } from 'mongoose';

export interface IInvitedModerator {
  alias: string;
  invitedAt: Date;
}

export interface IAcceptedModerator {
  alias: string;
  acceptedAt: Date;
}

export interface IExclusionVote {
  alias: string;
  approved: boolean;
}

export interface IExclusionRequest {
  requestedBy: string;
  targetAlias: string;
  reason: string;
  votes: IExclusionVote[];
  resolved: boolean;
  outcome: 'pending' | 'approved' | 'denied';
}

export interface IRuling {
  decision: 'uphold' | 'dismiss' | 'partial';
  ruledBy: string;
  statement: string;
  actions: string[];
  ruledAt: Date;
}

export const PANEL_STATUSES = [
  'awaiting_moderators',
  'reviewing',
  'ruled',
] as const;

export type PanelStatus = (typeof PANEL_STATUSES)[number];

export interface IModerationPanel extends Document {
  flagId: mongoose.Types.ObjectId;
  panelLevel: number;
  complexityLevel: 1 | 2 | 3 | 4;
  requiredModerators: number;
  invitedModerators: IInvitedModerator[];
  acceptedModerators: IAcceptedModerator[];
  exclusionRequests: IExclusionRequest[];
  ruling: IRuling | null;
  timeLockExpiry: Date | null;
  status: PanelStatus;
  createdAt: Date;
}

const invitedModeratorSchema = new Schema<IInvitedModerator>(
  {
    alias: { type: String, required: true },
    invitedAt: { type: Date, required: true },
  },
  { _id: false },
);

const acceptedModeratorSchema = new Schema<IAcceptedModerator>(
  {
    alias: { type: String, required: true },
    acceptedAt: { type: Date, required: true },
  },
  { _id: false },
);

const exclusionVoteSchema = new Schema<IExclusionVote>(
  {
    alias: { type: String, required: true },
    approved: { type: Boolean, required: true },
  },
  { _id: false },
);

const exclusionRequestSchema = new Schema<IExclusionRequest>(
  {
    requestedBy: { type: String, required: true },
    targetAlias: { type: String, required: true },
    reason: { type: String, required: true },
    votes: { type: [exclusionVoteSchema], default: [] },
    resolved: { type: Boolean, default: false },
    outcome: { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending' },
  },
  { _id: false },
);

const rulingSchema = new Schema<IRuling>(
  {
    decision: { type: String, required: true, enum: ['uphold', 'dismiss', 'partial'] },
    ruledBy: { type: String, required: true },
    statement: { type: String, required: true },
    actions: { type: [String], default: [] },
    ruledAt: { type: Date, required: true },
  },
  { _id: false },
);

const moderationPanelSchema = new Schema<IModerationPanel>(
  {
    flagId: { type: Schema.Types.ObjectId, ref: 'Flag', required: true },
    panelLevel: { type: Number, required: true, default: 0 },
    complexityLevel: { type: Number, required: true, enum: [1, 2, 3, 4] },
    requiredModerators: { type: Number, required: true },
    invitedModerators: { type: [invitedModeratorSchema], default: [] },
    acceptedModerators: { type: [acceptedModeratorSchema], default: [] },
    exclusionRequests: { type: [exclusionRequestSchema], default: [] },
    ruling: { type: rulingSchema, default: null },
    timeLockExpiry: { type: Date, default: null },
    status: { type: String, required: true, enum: PANEL_STATUSES, default: 'awaiting_moderators' },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

moderationPanelSchema.index({ flagId: 1 });
moderationPanelSchema.index({ 'invitedModerators.alias': 1 });
moderationPanelSchema.index({ 'acceptedModerators.alias': 1 });
moderationPanelSchema.index({ status: 1 });

export const ModerationPanel = mongoose.model<IModerationPanel>('ModerationPanel', moderationPanelSchema);
