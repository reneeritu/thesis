import mongoose, { Schema, Document } from 'mongoose';

export const CONVERSATION_STATUSES = ['pending', 'accepted', 'declined', 'blocked'] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export interface IConversation extends Document {
  participants: [string, string];
  initiatorAlias: string;
  status: ConversationStatus;
  introMessage: string;
  blockedByAlias?: string;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    participants: {
      type: [String],
      required: true,
      validate: {
        validator: (v: string[]) => Array.isArray(v) && v.length === 2 && v[0] < v[1],
        message: 'participants must be [a,b] sorted ascending',
      },
    },
    initiatorAlias: { type: String, required: true },
    status: { type: String, required: true, enum: CONVERSATION_STATUSES, default: 'pending' },
    introMessage: { type: String, required: true, maxlength: 2000 },
    blockedByAlias: { type: String, default: null },
    lastMessageAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

conversationSchema.index({ participants: 1 }, { unique: true });
conversationSchema.index({ participants: 1, status: 1 });
conversationSchema.index({ lastMessageAt: -1 });

export const Conversation = mongoose.model<IConversation>('Conversation', conversationSchema);
