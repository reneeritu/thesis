import mongoose, { Schema, Document } from 'mongoose';

export interface ITrusteeVote {
  trusteeAlias: string;
  approved: boolean;
  votedAt: Date;
}

export interface IRecoveryRequest extends Document {
  nodeAlias: string;
  newPasswordHash: string;
  trustees: string[];
  votes: ITrusteeVote[];
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  expiresAt: Date;
  createdAt: Date;
}

const trusteeVoteSchema = new Schema<ITrusteeVote>(
  {
    trusteeAlias: { type: String, required: true },
    approved: { type: Boolean, required: true },
    votedAt: { type: Date, required: true },
  },
  { _id: false },
);

const recoveryRequestSchema = new Schema<IRecoveryRequest>(
  {
    nodeAlias: { type: String, required: true },
    newPasswordHash: { type: String, required: true },
    trustees: { type: [String], required: true },
    votes: { type: [trusteeVoteSchema], default: [] },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'expired'],
      default: 'pending',
    },
    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

recoveryRequestSchema.index({ nodeAlias: 1, status: 1 });
recoveryRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RecoveryRequest = mongoose.model<IRecoveryRequest>(
  'RecoveryRequest',
  recoveryRequestSchema,
);