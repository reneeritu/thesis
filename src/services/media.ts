import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { sha256Buffer } from '../utils/hash';
import { config } from '../config';

/** Ensure the upload directory exists. */
export function ensureUploadDir(): void {
  const dir = path.resolve(config.uploadDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Compute SHA-256 of a file from its path. */
export async function hashFile(filePath: string): Promise<string> {
  const buffer = await fs.promises.readFile(filePath);
  return sha256Buffer(buffer);
}

/**
 * Create a thumbnail for an image file.
 * Returns the path to the thumbnail.
 */
export async function createThumbnail(
  inputPath: string,
  maxWidth = 400,
): Promise<string> {
  const parsed = path.parse(inputPath);
  const thumbName = `${parsed.name}_thumb${parsed.ext}`;
  const thumbPath = path.join(parsed.dir, thumbName);

  await sharp(inputPath).resize({ width: maxWidth, withoutEnlargement: true }).toFile(thumbPath);

  return thumbPath;
}
