import mongoose, { Schema, Document } from 'mongoose';

export const ENDORSEMENT_KINDS = [
  'verified_presence',
  'co_authored',
  'mentored',
  'reviewed',
] as const;

export type EndorsementKind = (typeof ENDORSEMENT_KINDS)[number];

export interface IEndorsement extends Document {
  traceId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  endorserAlias: string;
  kind: EndorsementKind;
  note: string;
  createdAt: Date;
}

const endorsementSchema = new Schema<IEndorsement>(
  {
    traceId: { type: Schema.Types.ObjectId, ref: 'Trace', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    endorserAlias: { type: String, required: true },
    kind: { type: String, required: true, enum: ENDORSEMENT_KINDS },
    note: { type: String, default: '', maxlength: 500 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

endorsementSchema.index({ traceId: 1, endorserAlias: 1, kind: 1 }, { unique: true });
endorsementSchema.index({ projectId: 1 });

export const Endorsement = mongoose.model<IEndorsement>('Endorsement', endorsementSchema);
