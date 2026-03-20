import mongoose, { Schema, Document } from 'mongoose';

export const FLAG_CATEGORIES = [
  'emergency',
  'content',
  'attribution',
  'governance',
  'dispute',
] as const;

export type FlagCategory = (typeof FLAG_CATEGORIES)[number];

export const FLAG_TYPES = [
  'csam',
  'non_consensual_imagery',
  'hate_speech',
  'harassment',
  'impersonation',
  'doxxing',
  'illegal_content',
  'misinformation',
  'spam',
  'nudity',
  'plagiarism',
  'false_credit',
  'undeclared_ai',
  'missing_lineage',
  'space_misconduct',
  'moderator_bad_faith',
  'contract_violation',
  'false_flagging',
  'credit_dispute',
  'veto_dispute',
  'space_ban_dispute',
  'classification_appeal',
] as const;

export type FlagType = (typeof FLAG_TYPES)[number];

export const FLAG_TARGET_TYPES = [
  'node',
  'trace',
  'project',
  'space',
  'nft',
  'contract',
  'media',
] as const;

export type FlagTargetType = (typeof FLAG_TARGET_TYPES)[number];

export const FLAG_STATUSES = [
  'open',
  'panel_assigned',
  'under_review',
  'ruled',
  'appealed',
  'closed',
  'disputed_closed',
] as const;

export type FlagStatus = (typeof FLAG_STATUSES)[number];

export const CATEGORY_TO_TYPES: Record<FlagCategory, readonly FlagType[]> = {
  emergency: ['csam', 'non_consensual_imagery'],
  content: ['hate_speech', 'harassment', 'impersonation', 'doxxing', 'illegal_content', 'misinformation', 'spam', 'nudity'],
  attribution: ['plagiarism', 'false_credit', 'undeclared_ai', 'missing_lineage'],
  governance: ['space_misconduct', 'moderator_bad_faith', 'contract_violation', 'false_flagging'],
  dispute: ['credit_dispute', 'veto_dispute', 'space_ban_dispute', 'classification_appeal'],
};

export interface IFlag extends Document {
  flagCategory: FlagCategory;
  flagType: FlagType;
  targetType: FlagTargetType;
  targetId: mongoose.Types.ObjectId;
  raisedBy: string;
  spaceId: mongoose.Types.ObjectId | null;
  isInsideMember: boolean;
  complexityLevel: 1 | 2 | 3 | 4;
  status: FlagStatus;
  mediationId: mongoose.Types.ObjectId | null;
  reason: string;
  blockIndex: number;
  emergencyActionTaken: boolean;
  appealCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const flagSchema = new Schema<IFlag>(
  {
    flagCategory: { type: String, required: true, enum: FLAG_CATEGORIES },
    flagType: { type: String, required: true, enum: FLAG_TYPES },
    targetType: { type: String, required: true, enum: FLAG_TARGET_TYPES },
    targetId: { type: Schema.Types.ObjectId, required: true },
    raisedBy: { type: String, required: true },
    spaceId: { type: Schema.Types.ObjectId, ref: 'Space', default: null },
    isInsideMember: { type: Boolean, default: false },
    complexityLevel: { type: Number, required: true, enum: [1, 2, 3, 4] },
    status: { type: String, required: true, enum: FLAG_STATUSES, default: 'open' },
    mediationId: { type: Schema.Types.ObjectId, ref: 'Mediation', default: null },
    reason: { type: String, required: true, maxlength: 2000 },
    blockIndex: { type: Number, required: true },
    emergencyActionTaken: { type: Boolean, default: false },
    appealCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

flagSchema.index({ targetType: 1, targetId: 1 });
flagSchema.index({ raisedBy: 1 });
flagSchema.index({ status: 1 });
flagSchema.index({ flagCategory: 1 });
flagSchema.index({ spaceId: 1 });

export const Flag = mongoose.model<IFlag>('Flag', flagSchema);
