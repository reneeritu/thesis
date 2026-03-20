import mongoose, { Schema, Document } from 'mongoose';

export const VETO_TYPES = [
  'hard_stop',
  'scope_limit',
  'content_flag',
  'nda_seal',
] as const;

export type VetoType = (typeof VETO_TYPES)[number];

export interface IVeto extends Document {
  projectId: mongoose.Types.ObjectId;
  nodeAlias: string;
  vetoType: VetoType;
  reasonHash: string;
  targetTraceIds: mongoose.Types.ObjectId[];
  signatures: { alias: string; signedAt: Date }[];
  status: 'pending' | 'active' | 'rejected';
  blockIndex: number;
  createdAt: Date;
}

const vetoSchema = new Schema<IVeto>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    nodeAlias: { type: String, required: true },
    vetoType: { type: String, required: true, enum: VETO_TYPES },
    reasonHash: { type: String, required: true },
    targetTraceIds: [{ type: Schema.Types.ObjectId, ref: 'Trace' }],
    signatures: [
      {
        alias: { type: String, required: true },
        signedAt: { type: Date, required: true },
        _id: false,
      },
    ],
    status: {
      type: String,
      enum: ['pending', 'active', 'rejected'],
      default: 'pending',
    },
    blockIndex: { type: Number, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

vetoSchema.index({ projectId: 1 });
vetoSchema.index({ nodeAlias: 1 });

export const Veto = mongoose.model<IVeto>('Veto', vetoSchema);
