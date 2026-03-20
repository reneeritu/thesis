import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/** SHA-256 hex digest of arbitrary data. */
export function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/** SHA-256 hex digest of a Buffer (e.g. file contents). */
export function sha256Buffer(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Compute the hash for a chain block.
 * Deterministic: same inputs always produce the same hash.
 */
export function computeBlockHash(
  index: number,
  timestamp: string,
  previousHash: string,
  data: string,
): string {
  return sha256(`${index}:${timestamp}:${previousHash}:${data}`);
}

/**
 * Encrypt plaintext with AES-256-GCM.
 * Returns a single string: iv:authTag:ciphertext  (all hex-encoded).
 */
export function encrypt(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a string produced by `encrypt`.
 */
export function decrypt(payload: string, keyHex: string): string {
  const [ivHex, authTagHex, ciphertext] = payload.split(':');
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
