import mongoose, { Schema, Document } from 'mongoose';

export interface IContributor {
  alias: string;
  role: string;
  isPrimary: boolean;
  signedAt: Date | null;
}

export interface IProject extends Document {
  title: string;
  spaceId: mongoose.Types.ObjectId;
  parentProjectId: mongoose.Types.ObjectId | null;
  creatorAlias: string;
  contributors: IContributor[];
  context: string;
  pedagogicalId: string;
  mentorAlias: string;
  status: 'active' | 'halted' | 'completed' | 'disputed' | 'archived';
  visibility: 'space_only' | 'process_visible' | 'fully_public';
  startBlockIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

const contributorSchema = new Schema<IContributor>(
  {
    alias: { type: String, required: true },
    role: { type: String, default: 'contributor' },
    isPrimary: { type: Boolean, default: false },
    signedAt: { type: Date, default: null },
  },
  { _id: false },
);

const projectSchema = new Schema<IProject>(
  {
    title: { type: String, required: true, trim: true },
    spaceId: { type: Schema.Types.ObjectId, ref: 'Space', required: true },
    parentProjectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    creatorAlias: { type: String, required: true },
    contributors: { type: [contributorSchema], required: true },
    context: { type: String, default: '' },
    pedagogicalId: { type: String, default: '' },
    mentorAlias: { type: String, default: '' },
    status: {
      type: String,
      enum: ['active', 'halted', 'completed', 'disputed', 'archived'],
      default: 'active',
    },
    visibility: {
      type: String,
      enum: ['space_only', 'process_visible', 'fully_public'],
      default: 'space_only',
    },
    startBlockIndex: { type: Number, required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

projectSchema.index({ spaceId: 1 });
projectSchema.index({ parentProjectId: 1 });
projectSchema.index({ creatorAlias: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ 'contributors.alias': 1 });

export const Project = mongoose.model<IProject>('Project', projectSchema);
