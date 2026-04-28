import mongoose, { Schema, Document } from 'mongoose';

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface IApplication extends Document {
  spaceId: mongoose.Types.ObjectId;
  applicantAlias: string;
  message: string;
  status: ApplicationStatus;
  respondedByAlias?: string;
  respondedAt?: Date | null;
  simRunId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const applicationSchema = new Schema<IApplication>(
  {
    spaceId: { type: Schema.Types.ObjectId, ref: 'Space', required: true },
    applicantAlias: { type: String, required: true },
    message: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    respondedByAlias: { type: String, default: '' },
    respondedAt: { type: Date, default: null },
    simRunId: { type: String, default: null, index: true },
  },
  { timestamps: true, versionKey: false },
);

applicationSchema.index({ spaceId: 1, status: 1 });
applicationSchema.index({ applicantAlias: 1, spaceId: 1 }, { unique: true });

export const Application = mongoose.model<IApplication>('Application', applicationSchema);
