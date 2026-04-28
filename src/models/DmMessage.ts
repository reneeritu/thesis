import mongoose, { Schema, Document } from 'mongoose';

export interface IDmMessage extends Document {
  conversationId: mongoose.Types.ObjectId;
  senderAlias: string;
  body: string;
  readByRecipientAt: Date | null;
  createdAt: Date;
}

const dmMessageSchema = new Schema<IDmMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderAlias: { type: String, required: true },
    body: { type: String, required: true, minlength: 1, maxlength: 4000 },
    readByRecipientAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

dmMessageSchema.index({ conversationId: 1, createdAt: 1 });

export const DmMessage = mongoose.model<IDmMessage>('DmMessage', dmMessageSchema);
