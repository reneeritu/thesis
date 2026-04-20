import mongoose, { Schema, Document } from 'mongoose';

export const ACTIVITY_TYPES = [
  'brainstorm',
  'primary_research',
  'secondary_research',
  'iterate',
  'skillwork',
  'fabrication',
  'pedagogy',
  'admin',
  'review',
  'ai_tool',
  'other',
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const LOG_MODES = ['micro', 'memo', 'reflection', 'proxy'] as const;
export type LogMode = (typeof LOG_MODES)[number];

export interface ITrace extends Document {
  projectId: mongoose.Types.ObjectId;
  nodeAlias: string;
  activityType: ActivityType;
  otherDescription: string;
  timestamp: Date;
  mediaHash: string;
  /** Reference to the Media document attached as proof (image / video / audio). */
  mediaId: mongoose.Types.ObjectId | null;
  description: string;
  duration: number;
  toolSoftware: string;
  isProxy: boolean;
  proxyForAlias: string;
  proxyConfirmed: boolean;
  proxyConfirmDeadline: Date | null;
  mode: LogMode;
  blockIndex: number;
  createdAt: Date;
  scopeLimited: boolean;
  contentFlagged: boolean;
  ndaSealed: boolean;
}

const traceSchema = new Schema<ITrace>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    nodeAlias: { type: String, required: true },
    activityType: {
      type: String,
      required: true,
      enum: ACTIVITY_TYPES,
      scopeLimited: { type: Boolean, default: false },
    contentFlagged: { type: Boolean, default: false },
    ndaSealed: { type: Boolean, default: false },
    },
    otherDescription: { type: String, default: '' },
    timestamp: { type: Date, required: true },
    mediaHash: { type: String, default: '' },
    mediaId: { type: Schema.Types.ObjectId, ref: 'Media', default: null },
    description: { type: String, default: '' },
    duration: { type: Number, default: 0 },
    toolSoftware: { type: String, default: '' },
    isProxy: { type: Boolean, default: false },
    proxyForAlias: { type: String, default: '' },
    proxyConfirmed: { type: Boolean, default: false },
    proxyConfirmDeadline: { type: Date, default: null },
    mode: {
      type: String,
      required: true,
      enum: LOG_MODES,
    },
    blockIndex: { type: Number, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

traceSchema.index({ projectId: 1 });
traceSchema.index({ nodeAlias: 1 });
traceSchema.index({ activityType: 1 });
traceSchema.index({ proxyForAlias: 1, proxyConfirmed: 1 });

export const Trace = mongoose.model<ITrace>('Trace', traceSchema);
