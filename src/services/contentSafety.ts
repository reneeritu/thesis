import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Media, IMedia } from '../models/Media';
import { config } from '../config';

const BACKUP_DIR = path.resolve(config.uploadDir, 'ncii-backups');

function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function unlinkSafe(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // tolerate missing files
  }
}

function thumbnailPath(filePath: string): string {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}_thumb${parsed.ext}`);
}

/**
 * Resolve a flag target to its associated Media records and uploader alias.
 */
/**
 * Resolve a flag target to its associated Media records and uploader alias.
 * By default only returns active media; pass includeHidden to also return hidden media
 * (needed for restore/destroy-backup operations on NCII content).
 */
export async function resolveFlagMedia(
  targetType: string,
  targetId: mongoose.Types.ObjectId | string,
  includeHidden = false,
): Promise<{ mediaIds: mongoose.Types.ObjectId[]; uploaderAlias: string | null }> {
  let media: IMedia[] = [];
  const statusFilter = includeHidden ? { $in: ['active', 'hidden'] } : 'active';

  if (targetType === 'media') {
    const doc = await Media.findById(targetId);
    if (doc) media = [doc];
  } else if (targetType === 'trace') {
    media = await Media.find({ traceId: targetId, status: statusFilter });
  } else if (targetType === 'project') {
    media = await Media.find({ projectId: targetId, status: statusFilter });
  } else if (targetType === 'node') {
    const { ChainNode } = await import('../models/Node');
    const node = await ChainNode.findById(targetId).select('alias').lean();
    if (node) {
      media = await Media.find({ uploaderAlias: node.alias, status: statusFilter });
    }
  }

  const uploaderAlias = media.length > 0 ? media[0].uploaderAlias : null;
  const mediaIds = media.map((m) => m._id as mongoose.Types.ObjectId);

  return { mediaIds, uploaderAlias };
}

/**
 * CSAM: Permanently delete files from disk and remove DB records.
 * Content is gone — no backup, no recovery.
 */
export async function permanentDelete(mediaIds: mongoose.Types.ObjectId[]): Promise<number> {
  let count = 0;
  for (const id of mediaIds) {
    const doc = await Media.findById(id);
    if (!doc) continue;

    unlinkSafe(doc.path);
    unlinkSafe(thumbnailPath(doc.path));
    await Media.deleteOne({ _id: id });
    count++;
  }
  return count;
}

/**
 * NCII: Hide content from users, create AES-256-GCM encrypted backup for appeal window.
 * Original file is deleted from its public path; encrypted copy retained for protocol panel.
 */
export async function hideContent(
  mediaIds: mongoose.Types.ObjectId[],
  flagId: mongoose.Types.ObjectId | string,
): Promise<number> {
  ensureBackupDir();

  const key = config.encryptionKey;
  if (!key || key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters for NCII backup');
  }
  const keyBuffer = Buffer.from(key.slice(0, 32), 'utf-8');

  let count = 0;
  for (const id of mediaIds) {
    const doc = await Media.findById(id);
    if (!doc || doc.status !== 'active') continue;

    if (fs.existsSync(doc.path)) {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

      const plaintext = fs.readFileSync(doc.path);
      const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const authTag = cipher.getAuthTag();

      const backupPath = path.join(BACKUP_DIR, `${flagId}_${id}.enc`);
      const header = Buffer.alloc(32);
      iv.copy(header, 0);
      authTag.copy(header, 16);
      fs.writeFileSync(backupPath, Buffer.concat([header, encrypted]));

      unlinkSafe(doc.path);
      unlinkSafe(thumbnailPath(doc.path));

      doc.encryptedBackupPath = backupPath;
    }

    doc.status = 'hidden';
    await doc.save();
    count++;
  }
  return count;
}

/**
 * NCII confirmed: Destroy encrypted backup, mark media as permanently removed.
 */
export async function destroyBackup(mediaIds: mongoose.Types.ObjectId[]): Promise<number> {
  let count = 0;
  for (const id of mediaIds) {
    const doc = await Media.findById(id);
    if (!doc) continue;

    if (doc.encryptedBackupPath) {
      unlinkSafe(doc.encryptedBackupPath);
      doc.encryptedBackupPath = null;
    }
    doc.status = 'removed';
    await doc.save();
    count++;
  }
  return count;
}

/**
 * NCII false flag: Decrypt backup, restore original file, set media back to active.
 */
export async function restoreContent(mediaIds: mongoose.Types.ObjectId[]): Promise<number> {
  const key = config.encryptionKey;
  if (!key || key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters for NCII restore');
  }
  const keyBuffer = Buffer.from(key.slice(0, 32), 'utf-8');

  let count = 0;
  for (const id of mediaIds) {
    const doc = await Media.findById(id);
    if (!doc || !doc.encryptedBackupPath) continue;

    if (fs.existsSync(doc.encryptedBackupPath)) {
      const data = fs.readFileSync(doc.encryptedBackupPath);
      const iv = data.subarray(0, 16);
      const authTag = data.subarray(16, 32);
      const ciphertext = data.subarray(32);

      const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

      const dir = path.dirname(doc.path);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(doc.path, decrypted);

      unlinkSafe(doc.encryptedBackupPath);
    }

    doc.encryptedBackupPath = null;
    doc.status = 'active';
    await doc.save();
    count++;
  }
  return count;
}

/**
 * Illegal content: Delete file from disk, mark media as removed.
 */
export async function removeContent(mediaIds: mongoose.Types.ObjectId[]): Promise<number> {
  let count = 0;
  for (const id of mediaIds) {
    const doc = await Media.findById(id);
    if (!doc) continue;

    unlinkSafe(doc.path);
    unlinkSafe(thumbnailPath(doc.path));

    doc.status = 'removed';
    await doc.save();
    count++;
  }
  return count;
}

/**
 * Nudity: Hide media within specific spaces only (not chain-wide).
 */
export async function hideInSpace(
  mediaIds: mongoose.Types.ObjectId[],
  spaceId: mongoose.Types.ObjectId,
): Promise<number> {
  let count = 0;
  for (const id of mediaIds) {
    const doc = await Media.findById(id);
    if (!doc) continue;

    const already = doc.hiddenInSpaces.some((s) => s.toString() === spaceId.toString());
    if (!already) {
      doc.hiddenInSpaces.push(spaceId);
      await doc.save();
    }
    count++;
  }
  return count;
}
