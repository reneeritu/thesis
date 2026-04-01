import mongoose, { Schema, Document } from 'mongoose';

export const MEDIA_STATUSES = ['active', 'hidden', 'removed'] as const;
export type MediaStatus = (typeof MEDIA_STATUSES)[number];

export interface IMedia extends Document {
  traceId: mongoose.Types.ObjectId | null;
  /** Set after archive/project creation when evidence was uploaded before the project existed */
  projectId: mongoose.Types.ObjectId | null;
  /** Space context for archive-evidence uploads (before projectId exists) */
  spaceId: mongoose.Types.ObjectId | null;
  uploaderAlias: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  hash: string;
  path: string;
  status: MediaStatus;
  encryptedBackupPath: string | null;
  hiddenInSpaces: mongoose.Types.ObjectId[];
  createdAt: Date;
}

const mediaSchema = new Schema<IMedia>(
  {
    traceId: { type: Schema.Types.ObjectId, ref: 'Trace', default: null },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    spaceId: { type: Schema.Types.ObjectId, ref: 'Space', default: null },
    uploaderAlias: { type: String, required: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    hash: { type: String, required: true },
    path: { type: String, required: true },
    status: { type: String, enum: MEDIA_STATUSES, default: 'active' },
    encryptedBackupPath: { type: String, default: null },
    hiddenInSpaces: { type: [Schema.Types.ObjectId], default: [] },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

mediaSchema.index({ projectId: 1 });
mediaSchema.index({ spaceId: 1 });
mediaSchema.index({ traceId: 1 });
mediaSchema.index({ hash: 1 });
mediaSchema.index({ status: 1 });

export const Media = mongoose.model<IMedia>('Media', mediaSchema);
