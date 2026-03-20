import mongoose, { Schema, Document } from 'mongoose';

export interface IBlock extends Document {
  index: number;
  timestamp: Date;
  type:
    | 'genesis'
    | 'identity'
    | 'start'
    | 'trace'
    | 'veto'
    | 'pivot'
    | 'credit'
    | 'reference'
    | 'fork'
    | 'archive'
    | 'mediation'
    | 'flag'
    | 'governance';
  alias: string;
  data: Record<string, unknown>;
  previousHash: string;
  hash: string;
}

const blockSchema = new Schema<IBlock>(
  {
    index: { type: Number, required: true, unique: true },
    timestamp: { type: Date, required: true },
    type: {
      type: String,
      required: true,
      enum: [
        'genesis',
        'identity',
        'start',
        'trace',
        'veto',
        'pivot',
        'credit',
        'reference',
        'fork',
        'archive',
        'mediation',
        'flag',
        'governance',
      ],
    },
    alias: { type: String, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    previousHash: { type: String, required: true },
    hash: { type: String, required: true, unique: true },
  },
  {
    timestamps: false,
    versionKey: false,
  },
);

blockSchema.index({ type: 1 });
blockSchema.index({ alias: 1 });

export const Block = mongoose.model<IBlock>('Block', blockSchema);
