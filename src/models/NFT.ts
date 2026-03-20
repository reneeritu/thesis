import mongoose, { Schema, Document } from 'mongoose';

export interface IContributorWeight {
  alias: string;
  role: string;
  weight: number;
  timeLogged: number;
}

export interface IContributorToken extends Document {
  projectId: mongoose.Types.ObjectId;
  nftId: mongoose.Types.ObjectId;
  alias: string;
  role: string;
  weight: number;
  timeLogged: number;
  blockIndex: number;
  createdAt: Date;
}

export interface INFT extends Document {
  projectId: mongoose.Types.ObjectId;
  title: string;
  medium: string;
  creators: string[];
  contributors: IContributorWeight[];
  processBlockIndices: number[];
  disputed: boolean;
  status: 'active' | 'expired';
  creditBlockIndex: number;
  createdAt: Date;
}

const contributorWeightSchema = new Schema<IContributorWeight>(
  {
    alias: { type: String, required: true },
    role: { type: String, required: true },
    weight: { type: Number, required: true },
    timeLogged: { type: Number, default: 0 },
  },
  { _id: false },
);

const nftSchema = new Schema<INFT>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, unique: true },
    title: { type: String, required: true },
    medium: { type: String, default: '' },
    creators: { type: [String], required: true },
    contributors: { type: [contributorWeightSchema], required: true },
    processBlockIndices: { type: [Number], default: [] },
    disputed: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'expired'], default: 'active' },
    creditBlockIndex: { type: Number, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

nftSchema.index({ projectId: 1 });

const contributorTokenSchema = new Schema<IContributorToken>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    nftId: { type: Schema.Types.ObjectId, ref: 'NFT', required: true },
    alias: { type: String, required: true },
    role: { type: String, required: true },
    weight: { type: Number, required: true },
    timeLogged: { type: Number, default: 0 },
    blockIndex: { type: Number, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

contributorTokenSchema.index({ alias: 1 });
contributorTokenSchema.index({ projectId: 1 });
contributorTokenSchema.index({ nftId: 1 });

export const NFT = mongoose.model<INFT>('NFT', nftSchema);
export const ContributorToken = mongoose.model<IContributorToken>(
  'ContributorToken',
  contributorTokenSchema,
);
