import mongoose, { Schema, Document } from 'mongoose';

export const RELATIONSHIP_TYPES = [
  'inspired_by',
  'built_on',
  'forked_from',
  'in_response_to',
  'pedagogical_source',
  'ai_generated',
  'other',
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export interface IReference extends Document {
  projectId: mongoose.Types.ObjectId;
  nodeAlias: string;
  sourceProjectId: string;
  externalUrl: string;
  citation: string;
  relationshipType: RelationshipType;
  otherExplanation: string;
  blockIndex: number;
  createdAt: Date;
}

const referenceSchema = new Schema<IReference>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    nodeAlias: { type: String, required: true },
    sourceProjectId: { type: String, default: '' },
    externalUrl: { type: String, default: '' },
    citation: { type: String, default: '' },
    relationshipType: { type: String, required: true, enum: RELATIONSHIP_TYPES },
    otherExplanation: { type: String, default: '' },
    blockIndex: { type: Number, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

referenceSchema.index({ projectId: 1 });
referenceSchema.index({ sourceProjectId: 1 });

export const Reference = mongoose.model<IReference>('Reference', referenceSchema);
