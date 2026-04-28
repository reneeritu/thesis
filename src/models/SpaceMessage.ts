import mongoose, { Schema, Document } from 'mongoose';

export interface ISpaceMessage extends Document {
  spaceId: mongoose.Types.ObjectId;
  senderAlias: string;
  body: string;
  pinned: boolean;
  createdAt: Date;
}

const spaceMessageSchema = new Schema<ISpaceMessage>(
  {
    spaceId: { type: Schema.Types.ObjectId, ref: 'Space', required: true, index: true },
    senderAlias: { type: String, required: true },
    body: { type: String, required: true, minlength: 1, maxlength: 4000 },
    pinned: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

spaceMessageSchema.index({ spaceId: 1, createdAt: -1 });

export const SpaceMessage = mongoose.model<ISpaceMessage>('SpaceMessage', spaceMessageSchema);
