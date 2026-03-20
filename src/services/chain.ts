import { Block, IBlock } from '../models/Block';
import { computeBlockHash } from '../utils/hash';

/**
 * Ensure the genesis block exists. Called once on server start.
 */
export async function ensureGenesis(): Promise<IBlock> {
  const existing = await Block.findOne({ index: 0 });
  if (existing) return existing;

  const timestamp = new Date().toISOString();
  const data = { message: 'aura2 genesis block' };
  const hash = computeBlockHash(0, timestamp, '0', JSON.stringify(data));

  const genesis = await Block.create({
    index: 0,
    timestamp: new Date(timestamp),
    type: 'genesis',
    alias: 'system',
    data,
    previousHash: '0',
    hash,
  });

  console.log('Genesis block created');
  return genesis;
}

/**
 * Append a new block to the chain.
 *
 * Reads the latest block, computes the next index and hash,
 * then inserts atomically (unique index prevents duplicates).
 * On duplicate-key collision (concurrent writes), retries with
 * the updated latest block up to MAX_RETRIES times.
 */
const MAX_BLOCK_RETRIES = 5;

export async function addBlock(
  type: IBlock['type'],
  alias: string,
  data: Record<string, unknown>,
): Promise<IBlock> {
  for (let attempt = 0; attempt < MAX_BLOCK_RETRIES; attempt++) {
    const latest = await Block.findOne().sort({ index: -1 });
    if (!latest) {
      throw new Error('Chain not initialised — genesis block missing');
    }

    const nextIndex = latest.index + 1;
    const timestamp = new Date().toISOString();
    const hash = computeBlockHash(
      nextIndex,
      timestamp,
      latest.hash,
      JSON.stringify(data),
    );

    try {
      const block = await Block.create({
        index: nextIndex,
        timestamp: new Date(timestamp),
        type,
        alias,
        data,
        previousHash: latest.hash,
        hash,
      });
      return block;
    } catch (err: unknown) {
      const mongoErr = err as { code?: number };
      if (mongoErr.code === 11000 && attempt < MAX_BLOCK_RETRIES - 1) {
        continue;
      }
      throw err;
    }
  }

  throw new Error('Failed to add block after maximum retries');
}

/**
 * Validate the entire chain by recomputing hashes from genesis forward.
 * Returns `{ valid: true }` or `{ valid: false, brokenAtIndex }`.
 */
export async function validateChain(): Promise<
  { valid: true } | { valid: false; brokenAtIndex: number }
> {
  const blocks = await Block.find().sort({ index: 1 }).lean();
  if (blocks.length === 0) return { valid: true };

  for (let i = 1; i < blocks.length; i++) {
    const prev = blocks[i - 1];
    const curr = blocks[i];

    if (curr.previousHash !== prev.hash) {
      return { valid: false, brokenAtIndex: curr.index };
    }

    const expected = computeBlockHash(
      curr.index,
      curr.timestamp.toISOString(),
      curr.previousHash,
      JSON.stringify(curr.data),
    );

    if (curr.hash !== expected) {
      return { valid: false, brokenAtIndex: curr.index };
    }
  }

  return { valid: true };
}

/** Get the latest block on the chain. */
export async function getLatestBlock(): Promise<IBlock | null> {
  return Block.findOne().sort({ index: -1 });
}

/** Get a block by its index. */
export async function getBlockByIndex(index: number): Promise<IBlock | null> {
  return Block.findOne({ index });
}
