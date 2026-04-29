import mongoose, { Schema, Document } from 'mongoose';

function generateSeed(): string {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

export interface ISpaceCustomContract {
  title: string;
  body: string;
  authorAlias: string;
  createdAt: Date;
}

export interface ISpaceSettings {
  projectAccess: 'open' | 'invite_only' | 'application';
  vetoAuthority: string[];
  votingThreshold: number;
  privacyDefault: 'public' | 'space_specific' | 'private';
  customContractsAllowed: boolean;
  contentRestrictions: string[];
  minDocRequirements: string[];
  customContracts: ISpaceCustomContract[];
  enforceStrictMinDoc: boolean;
}

export interface IPendingVeto {
  alias: string;
  notifiedAt: Date;
}

export interface IFoundingMember {
  alias: string;
  role: 'admin' | 'member';
}

export type InviteMode = 'single_use' | 'multi_use';

export interface IInviteCode {
  code: string;
  used: boolean;
  createdAt: Date;
  /** How many times this code may be used. null = single-use (legacy). */
  maxUses: number | null;
  usedCount: number;
  /** null = never expires */
  expiresAt: Date | null;
  mode: InviteMode;
}

export interface ISpace extends Document {
  name: string;
  description: string;
  creatorAlias: string;
  admins: string[];
  members: string[];
  /** vetoAuthority aliases that have accepted the role. */
  settings: ISpaceSettings;
  /** Aliases invited to be veto authority but have not responded yet. */
  pendingVeto: IPendingVeto[];
  inviteCodes: IInviteCode[];
  status: 'active' | 'dormant';
  parentSpaceId: mongoose.Types.ObjectId | null;
  logoSeed: string;
  createdAt: Date;
  updatedAt: Date;
}

const spaceCustomContractSchema = new Schema<ISpaceCustomContract>(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    authorAlias: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

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
    customContracts: { type: [spaceCustomContractSchema], default: [] },
    enforceStrictMinDoc: { type: Boolean, default: false },
  },
  { _id: false },
);

const pendingVetoSchema = new Schema<IPendingVeto>(
  {
    alias: { type: String, required: true },
    notifiedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const inviteCodeSchema = new Schema<IInviteCode>(
  {
    code: { type: String, required: true },
    used: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    maxUses: { type: Number, default: null },
    usedCount: { type: Number, default: 0 },
    expiresAt: { type: Date, default: null },
    mode: { type: String, enum: ['single_use', 'multi_use'], default: 'single_use' },
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
    pendingVeto: { type: [pendingVetoSchema], default: [] },
    inviteCodes: { type: [inviteCodeSchema], default: [] },
    status: { type: String, enum: ['active', 'dormant'], default: 'active' },
    parentSpaceId: { type: Schema.Types.ObjectId, ref: 'Space', default: null },
    logoSeed: { type: String, default: () => generateSeed() },
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
