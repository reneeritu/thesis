import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { generateMnemonic, validateMnemonic } from 'bip39';
import { config } from '../config';
import { sha256, encrypt } from '../utils/hash';
import { AuthPayload } from '../types';

const BCRYPT_ROUNDS = 12;

export function generateSeedPhrase(): string {
  return generateMnemonic(128);
}

export function isValidSeedPhrase(mnemonic: string): boolean {
  return validateMnemonic(mnemonic);
}

/** SHA-256 hash of the mnemonic — used for fast verification during recovery. */
export function hashSeed(mnemonic: string): string {
  return sha256(mnemonic.trim().toLowerCase());
}

/** Encrypt the seed phrase with the server-side AES key for on-chain storage. */
export function encryptSeedPhrase(mnemonic: string): string {
  if (!config.encryptionKey || config.encryptionKey.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY must be a 64-character hex string (32 bytes)',
    );
  }
  return encrypt(mnemonic, config.encryptionKey);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: AuthPayload): string {
  const options: SignOptions = {
    expiresIn: config.jwtExpiresIn,
  } as SignOptions;
  return jwt.sign(
    { alias: payload.alias, nodeId: payload.nodeId, tokenVersion: payload.tokenVersion },
    config.jwtSecret,
    options,
  );
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, config.jwtSecret) as AuthPayload;
}
