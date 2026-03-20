import mongoose, { Schema, Document } from 'mongoose';

export const EVIDENCE_TYPES = [
  'photos_of_work',
  'process_photos',
  'sketches',
  'dated_files',
  'social_post',
  'videos',
  'voice_recordings',
  'audio',
  'exhibit_record',
  'institution_record',
  'url',
  'portfolio_link',
  'other',
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const ATTESTATION_TYPES = ['self', 'peer', 'institution'] as const;
export type AttestationType = (typeof ATTESTATION_TYPES)[number];

export const ATTESTATION_RELATIONSHIPS = [
  'collaborator',
  'witness',
  'mentor',
  'institutional_contact',
] as const;
export type AttestationRelationship = (typeof ATTESTATION_RELATIONSHIPS)[number];

export interface IEvidence {
  evidenceType: EvidenceType;
  evidenceHash: string;
  otherDescription: string;
}

export interface IAttestation {
  attestationType: AttestationType;
  attestingAlias: string;
  relationship: AttestationRelationship;
  statementHash: string;
  createdAt: Date;
}

export interface IArchive extends Document {
  projectId: mongoose.Types.ObjectId;
  title: string;
  medium: string;
  approxDate: string;
  creatorAlias: string;
  collaborators: string[];
  evidence: IEvidence[];
  reconstructionFlag: boolean;
  originalWorkDeclaration: boolean;
  contextNote: string;
  attestations: IAttestation[];
  nftId: mongoose.Types.ObjectId | null;
  blockIndex: number;
  createdAt: Date;
}

const evidenceSchema = new Schema<IEvidence>(
  {
    evidenceType: { type: String, required: true, enum: EVIDENCE_TYPES },
    evidenceHash: { type: String, required: true },
    otherDescription: { type: String, default: '' },
  },
  { _id: false },
);

const attestationSchema = new Schema<IAttestation>(
  {
    attestationType: { type: String, required: true, enum: ATTESTATION_TYPES },
    attestingAlias: { type: String, required: true },
    relationship: { type: String, required: true, enum: ATTESTATION_RELATIONSHIPS },
    statementHash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const archiveSchema = new Schema<IArchive>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    title: { type: String, required: true },
    medium: { type: String, required: true },
    approxDate: { type: String, required: true },
    creatorAlias: { type: String, required: true },
    collaborators: { type: [String], default: [] },
    evidence: { type: [evidenceSchema], required: true },
    reconstructionFlag: { type: Boolean, required: true },
    originalWorkDeclaration: { type: Boolean, required: true },
    contextNote: { type: String, default: '' },
    attestations: { type: [attestationSchema], default: [] },
    nftId: { type: Schema.Types.ObjectId, ref: 'NFT', default: null },
    blockIndex: { type: Number, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

archiveSchema.index({ creatorAlias: 1 });
archiveSchema.index({ projectId: 1 });

export const Archive = mongoose.model<IArchive>('Archive', archiveSchema);
