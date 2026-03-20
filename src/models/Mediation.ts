import mongoose, { Schema, Document } from 'mongoose';

export const MEDIATION_TRIGGER_TYPES = [
  'credit_dispute',
  'veto_dispute',
  'space_ban_dispute',
  'classification_appeal',
] as const;

export type MediationTriggerType = (typeof MEDIATION_TRIGGER_TYPES)[number];

export const MEDIATION_STATUSES = [
  'peer_to_peer',
  'space_escalated',
  'chain_escalated',
  'resolved',
  'failed',
] as const;

export type MediationStatus = (typeof MEDIATION_STATUSES)[number];

export const COMPLEXITY_LEVELS = [1, 2, 3, 4] as const;
export type ComplexityLevel = (typeof COMPLEXITY_LEVELS)[number];

export const RELATED_ENTITY_TYPES = [
  'nft',
  'veto',
  'space_ban',
  'classification',
] as const;

export type RelatedEntityType = (typeof RELATED_ENTITY_TYPES)[number];

export interface IProposalResponse {
  alias: string;
  accepted: boolean;
  respondedAt: Date;
}

export interface IWeightEntry {
  alias: string;
  weight: number;
}

export interface IProposal {
  proposedBy: string;
  description: string;
  weightMap?: IWeightEntry[];
  responses: IProposalResponse[];
  createdAt: Date;
}

export interface IMediation extends Document {
  projectId: mongoose.Types.ObjectId;
  spaceId: mongoose.Types.ObjectId;
  triggerType: MediationTriggerType;
  triggeredBy: string;
  parties: string[];
  status: MediationStatus;
  complexityLevel: ComplexityLevel;
  relatedEntityId: mongoose.Types.ObjectId;
  relatedEntityType: RelatedEntityType;
  reason: string;
  proposals: IProposal[];
  revisedAgreement: IWeightEntry[] | null;
  peerDeadline: Date;
  spaceDeadline: Date | null;
  blockIndex: number;
  resolutionBlockIndex: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const proposalResponseSchema = new Schema<IProposalResponse>(
  {
    alias: { type: String, required: true },
    accepted: { type: Boolean, required: true },
    respondedAt: { type: Date, required: true },
  },
  { _id: false },
);

const weightEntrySchema = new Schema<IWeightEntry>(
  {
    alias: { type: String, required: true },
    weight: { type: Number, required: true },
  },
  { _id: false },
);

const proposalSchema = new Schema<IProposal>(
  {
    proposedBy: { type: String, required: true },
    description: { type: String, required: true },
    weightMap: { type: [weightEntrySchema], default: undefined },
    responses: { type: [proposalResponseSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const mediationSchema = new Schema<IMediation>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    spaceId: { type: Schema.Types.ObjectId, ref: 'Space', required: true },
    triggerType: {
      type: String,
      required: true,
      enum: MEDIATION_TRIGGER_TYPES,
    },
    triggeredBy: { type: String, required: true },
    parties: { type: [String], required: true },
    status: {
      type: String,
      required: true,
      enum: MEDIATION_STATUSES,
      default: 'peer_to_peer',
    },
    complexityLevel: { type: Number, required: true, enum: COMPLEXITY_LEVELS },
    relatedEntityId: { type: Schema.Types.ObjectId, required: true },
    relatedEntityType: {
      type: String,
      required: true,
      enum: RELATED_ENTITY_TYPES,
    },
    reason: { type: String, required: true },
    proposals: { type: [proposalSchema], default: [] },
    revisedAgreement: { type: [weightEntrySchema], default: null },
    peerDeadline: { type: Date, required: true },
    spaceDeadline: { type: Date, default: null },
    blockIndex: { type: Number, required: true },
    resolutionBlockIndex: { type: Number, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

mediationSchema.index({ projectId: 1 });
mediationSchema.index({ relatedEntityId: 1, relatedEntityType: 1 });
mediationSchema.index({ status: 1 });
mediationSchema.index({ triggeredBy: 1 });

export const Mediation = mongoose.model<IMediation>('Mediation', mediationSchema);
