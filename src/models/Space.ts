import mongoose, { Schema, Document } from 'mongoose';

export interface ISpaceSettings {
  projectAccess: 'open' | 'invite_only' | 'application';
  vetoAuthority: string[];
  votingThreshold: number;
  privacyDefault: 'public' | 'space_specific' | 'private';
  customContractsAllowed: boolean;
  contentRestrictions: string[];
  minDocRequirements: string[];
}

export interface IInviteCode {
  code: string;
  used: boolean;
  createdAt: Date;
}

export interface ISpace extends Document {
  name: string;
  description: string;
  creatorAlias: string;
  admins: string[];
  members: string[];
  settings: ISpaceSettings;
  inviteCodes: IInviteCode[];
  status: 'active' | 'dormant';
  parentSpaceId: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const spaceSettingsSchema = new Schema<ISpaceSettings>(
  {
    projectAccess: {
      type: String,
      enum: ['open', 'invite_only', 'application'],
      default: 'open',
    },
    vetoAuthority: { type: [String], default: [] },
    votingThreshold: { type: Number, default: 0.5, min: 0, max: 1 },
    privacyDefault: {
      type: String,
      enum: ['public', 'space_specific', 'private'],
      default: 'space_specific',
    },
    customContractsAllowed: { type: Boolean, default: true },
    contentRestrictions: { type: [String], default: [] },
    minDocRequirements: { type: [String], default: [] },
  },
  { _id: false },
);

const inviteCodeSchema = new Schema<IInviteCode>(
  {
    code: { type: String, required: true },
    used: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const spaceSchema = new Schema<ISpace>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    creatorAlias: { type: String, required: true },
    admins: { type: [String], required: true },
    members: { type: [String], default: [] },
    settings: { type: spaceSettingsSchema, required: true },
    inviteCodes: { type: [inviteCodeSchema], default: [] },
    status: { type: String, enum: ['active', 'dormant'], default: 'active' },
    parentSpaceId: { type: Schema.Types.ObjectId, ref: 'Space', default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

spaceSchema.index({ creatorAlias: 1 });
spaceSchema.index({ members: 1 });
spaceSchema.index({ status: 1 });

export const Space = mongoose.model<ISpace>('Space', spaceSchema);
