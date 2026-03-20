import mongoose, { Schema, Document } from 'mongoose';

export const NOTIFICATION_TYPES = [
  'proxy_confirmation_needed',
  'fork_of_your_project',
  'collaboration_request',
  'moderation_ruling',
  'appeal_update',
  'space_invite',
  'credit_dispute',
  'contributor_signed',
  'veto_raised',
  'mediation_update',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface INotification extends Document {
  recipientAlias: string;
  type: NotificationType;
  read: boolean;
  relatedId: string;
  relatedType: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  expiresAt: Date | null;
}

const notificationSchema = new Schema<INotification>(
  {
    recipientAlias: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: NOTIFICATION_TYPES,
    },
    read: { type: Boolean, default: false },
    relatedId: { type: String, default: '' },
    relatedType: { type: String, default: '' },
    metadata: { type: Schema.Types.Mixed, default: {} },
    expiresAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

notificationSchema.index({ recipientAlias: 1, read: 1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

export const Notification = mongoose.model<INotification>(
  'Notification',
  notificationSchema,
);