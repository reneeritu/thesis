import mongoose, { Schema, Document } from 'mongoose';
import { chainDefaults } from '../config/defaults';

export interface IReputationCategories {
  craft: number;
  research: number;
  collaboration: number;
  pedagogy: number;
  consistency: number;
  community: number;
}

export interface IChainNode extends Document {
  alias: string;
  hashedPassword: string;
  seedHash: string;
  encryptedSeedPhrase: string;
  tokenVersion: number;
  trustees: string[];
  interests: string[];
  portfolioUrl: string;
  keywords: string[];
  spaces: mongoose.Types.ObjectId[];
  reputationScore: number;
  reputationCategories: IReputationCategories;
  badges: string[];
  status: 'active' | 'removed' | 'suspended';
  lastActiveAt: Date;
  blockedNodes: string[];
  identityBlockIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

const reputationCategorySchema = new Schema<IReputationCategories>(
  {
    craft: { type: Number, default: 0 },
    research: { type: Number, default: 0 },
    collaboration: { type: Number, default: 0 },
    pedagogy: { type: Number, default: 0 },
    consistency: { type: Number, default: 0 },
    community: { type: Number, default: 0 },
  },
  { _id: false },
);

const chainNodeSchema = new Schema<IChainNode>(
  {
    alias: {
      type: String,
      required: true,
      unique: true,
      minlength: chainDefaults.aliasMinLength,
      maxlength: chainDefaults.aliasMaxLength,
      trim: true,
      lowercase: true,
    },
    hashedPassword: { type: String, required: true },
    seedHash: { type: String, required: true },
    encryptedSeedPhrase: { type: String, required: true },
    tokenVersion: { type: Number, default: 0 },
    trustees: {
      type: [String],
      default: [],
      validate: {
        validator: (v: string[]) => v.length <= chainDefaults.socialRecoveryMaxTrustees,
        message: `Cannot exceed ${chainDefaults.socialRecoveryMaxTrustees} trustees`,
      },
    },
    interests: { type: [String], default: [] },
    portfolioUrl: { type: String, default: '' },
    keywords: { type: [String], default: [] },
    spaces: [{ type: Schema.Types.ObjectId, ref: 'Space' }],
    reputationScore: { type: Number, default: chainDefaults.reputationBaseScore },
    reputationCategories: {
      type: reputationCategorySchema,
      default: () => ({
        craft: 0,
        research: 0,
        collaboration: 0,
        pedagogy: 0,
        consistency: 0,
        community: 0,
      }),
    },
    badges: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['active', 'removed', 'suspended'],
      default: 'active',
    },
    lastActiveAt: { type: Date, default: Date.now },
    blockedNodes: { type: [String], default: [] },
    identityBlockIndex: { type: Number, required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

chainNodeSchema.index({ status: 1 });
chainNodeSchema.index({ 'reputationScore': 1 });

export const ChainNode = mongoose.model<IChainNode>('ChainNode', chainNodeSchema);
