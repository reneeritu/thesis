import mongoose, { Schema, Document } from 'mongoose';

export interface IPivot extends Document {
  projectId: mongoose.Types.ObjectId;
  nodeAlias: string;
  reason: string;
  blockIndex: number;
  createdAt: Date;
}

const pivotSchema = new Schema<IPivot>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    nodeAlias: { type: String, required: true },
    reason: { type: String, required: true },
    blockIndex: { type: Number, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

pivotSchema.index({ projectId: 1 });

export const Pivot = mongoose.model<IPivot>('Pivot', pivotSchema);
