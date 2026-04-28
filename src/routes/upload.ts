import fs from 'fs';
import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth';
import { optionalAuth } from '../middleware/optionalAuth';
import { ChainNode } from '../models/Node';
import { Media } from '../models/Media';
import { Project } from '../models/Project';
import { Space } from '../models/Space';
import { NFT } from '../models/NFT';
import { hashFile, createThumbnail } from '../services/media';
import { sanitiseSvg, MAX_SVG_BYTES } from '../services/svgSanitise';
import { config } from '../config';
import { AuthRequest } from '../types';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors';
import { assertProjectReadableForOptionalViewer } from '../utils/projectAccess';

const ARTWORK_IMAGE_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);
const ARTWORK_VIDEO_MIME = new Set(['video/mp4', 'video/webm']);
const ARTWORK_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const ARTWORK_VIDEO_MAX_BYTES = 25 * 1024 * 1024;
const ARTWORK_IMAGE_MIN_SIDE = 256;
const ARTWORK_IMAGE_MAX_SIDE = 4096;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.resolve(config.uploadDir));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxFileSizeMb * 1024 * 1024 },
});

const router = Router();

/**
 * POST /upload
 * Upload a file linked to a project. Returns the media record + SHA-256 hash.
 */
router.post(
  '/upload',
  requireAuth,
  upload.single('file'),
  async (req: AuthRequest, res: Response) => {
    if (!req.file) throw new AppError('No file provided');

    const { projectId, traceId } = req.body;
    if (!projectId) throw new AppError('projectId is required');

    const project = await Project.findById(projectId);
    if (!project) throw new NotFoundError('Project');
    if (project.status !== 'active') {
      throw new AppError('Cannot upload to a project that is not active');
    }

    const isContributor = project.contributors.some(
      (c) => c.alias === req.node!.alias,
    );
    if (!isContributor) {
      throw new ForbiddenError('You are not a contributor on this project');
    }

    const fileHash = await hashFile(req.file.path);

    const isImage = req.file.mimetype.startsWith('image/');
    if (isImage) {
      try {
        await createThumbnail(req.file.path);
      } catch {
        // thumbnail creation is best-effort
      }
    }

    const media = await Media.create({
      traceId: traceId || null,
      projectId,
      uploaderAlias: req.node!.alias,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      hash: fileHash,
      path: req.file.path,
    });

    res.status(201).json({
      mediaId: media._id,
      hash: fileHash,
      filename: media.filename,
      originalName: media.originalName,
      mimeType: media.mimeType,
      size: media.size,
    });
  },
);

/**
 * POST /upload/archive-evidence
 * Upload a file for archive (past work) before a project exists. Bytes are stored on disk;
 * metadata is stored on the Media document in MongoDB. projectId is set when POST /archives completes.
 */
router.post(
  '/upload/archive-evidence',
  requireAuth,
  upload.single('file'),
  async (req: AuthRequest, res: Response) => {
    if (!req.file) throw new AppError('No file provided');

    const spaceId = String(req.body.spaceId || '').trim();
    if (!spaceId) throw new AppError('spaceId is required');

    const space = await Space.findById(spaceId);
    if (!space) throw new NotFoundError('Space');
    if (!space.members.includes(req.node!.alias)) {
      throw new ForbiddenError('You must be a member of this space');
    }

    const fileHash = await hashFile(req.file.path);

    const isImage = req.file.mimetype.startsWith('image/');
    if (isImage) {
      try {
        await createThumbnail(req.file.path);
      } catch {
        // best-effort
      }
    }

    const media = await Media.create({
      traceId: null,
      projectId: null,
      spaceId,
      uploaderAlias: req.node!.alias,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      hash: fileHash,
      path: req.file.path,
    });

    res.status(201).json({
      mediaId: media._id,
      hash: fileHash,
      filename: media.filename,
      originalName: media.originalName,
      mimeType: media.mimeType,
      size: media.size,
    });
  },
);

/**
 * GET /media/project/:projectId
 * List all Media records for a project (members only).
 * Returns metadata + a URL to fetch each file.
 */
router.get(
  '/media/project/:projectId',
  optionalAuth,
  async (req: AuthRequest, res: Response) => {
    const project = await assertProjectReadableForOptionalViewer(req.params.projectId, req);

    const alias = req.node?.alias;
    const isContributor = alias
      ? project.contributors.some((c) => c.alias === alias && c.accepted !== false)
      : false;
    if (!isContributor) {
      return res.json([]);
    }

    const mediaList = await Media.find({ projectId: req.params.projectId, status: { $ne: 'removed' } })
      .select('_id filename originalName mimeType size hash uploaderAlias createdAt status')
      .sort({ createdAt: -1 })
      .lean();

    res.json(
      mediaList.map((m) => ({
        mediaId: String(m._id),
        filename: m.filename,
        originalName: m.originalName,
        mimeType: m.mimeType,
        size: m.size,
        hash: m.hash,
        uploaderAlias: m.uploaderAlias,
        createdAt: m.createdAt,
        status: m.status,
        url: `/media/${String(m._id)}`,
      })),
    );
  },
);

/**
 * GET /media/:mediaId
 * Serves uploaded media bytes, enforcing content visibility rules.
 *
 * Rules:
 * - If Media.status is 'removed' => 404 (public + authenticated)
 * - If no auth token => treat as public and only block 'removed'
 * - If authenticated:
 *   - If Media.status is 'hidden' => 403
 *   - If requesting node's space overlaps Media.hiddenInSpaces => 403
 */
router.get(
  '/media/:mediaId',
  optionalAuth,
  async (req: AuthRequest, res: Response) => {
    const mediaId = req.params.mediaId as string;

    if (!path || !mediaId || !/^[a-fA-F0-9]{24}$/.test(mediaId)) {
      throw new AppError('Invalid mediaId');
    }

    const media = await Media.findById(mediaId);
    if (!media || media.status === 'removed') throw new NotFoundError('Media');

    // Public request: only block removed content
    if (!req.node) {
      if (!fs.existsSync(media.path)) throw new NotFoundError('Media');
      return res.sendFile(media.path);
    }

    // Authenticated request: enforce hidden + hiddenInSpaces
    if (media.status === 'hidden') {
      throw new ForbiddenError('Media is hidden');
    }

    if (media.hiddenInSpaces?.length) {
      const node = await ChainNode.findById(req.node.nodeId).select('spaces').lean();
      const nodeSpaceIds = (node?.spaces ?? []).map((s: any) => s.toString());
      const hiddenSpaceIds = media.hiddenInSpaces.map((s) => s.toString());
      const overlaps = nodeSpaceIds.some((s) => hiddenSpaceIds.includes(s));
      if (overlaps) throw new ForbiddenError('Media is not visible in your space');
    }

    if (!fs.existsSync(media.path)) throw new NotFoundError('Media');
    return res.sendFile(media.path);
  },
);

/**
 * POST /upload/cert-artwork
 * Upload a candidate artwork file for a provenance certificate.
 *
 * - Must be a primary contributor on the project owning the NFT.
 * - Allow-list: PNG / JPEG / WebP / GIF / SVG / MP4 / WebM.
 * - Size: images ≤ 5 MB, video ≤ 25 MB.
 * - Image dimension guard: 256–4096 px per side.
 * - SVG is sanitised (scripts / foreign content stripped) before being stored.
 *
 * The file is stored via the Media model; use PUT /nfts/:id/artwork with
 * { type: 'uploaded', mediaId } to attach it to the certificate.
 */
const artworkUpload = multer({
  storage,
  limits: { fileSize: ARTWORK_VIDEO_MAX_BYTES },
});

router.post(
  '/upload/cert-artwork',
  requireAuth,
  artworkUpload.single('file'),
  async (req: AuthRequest, res: Response) => {
    if (!req.file) throw new AppError('No file provided');

    const nftId = String(req.body.nftId || '').trim();
    if (!/^[a-fA-F0-9]{24}$/.test(nftId)) {
      fs.unlink(req.file.path, () => undefined);
      throw new AppError('Valid nftId is required');
    }

    const nft = await NFT.findById(nftId);
    if (!nft) {
      fs.unlink(req.file.path, () => undefined);
      throw new NotFoundError('Certificate');
    }

    const project = await Project.findById(nft.projectId);
    if (!project) {
      fs.unlink(req.file.path, () => undefined);
      throw new NotFoundError('Project');
    }

    const isPrimary = project.contributors.some(
      (c) => c.alias === req.node!.alias && c.isPrimary,
    );
    if (!isPrimary) {
      fs.unlink(req.file.path, () => undefined);
      throw new ForbiddenError('Only primary contributors can set certificate artwork');
    }

    const mime = req.file.mimetype;
    const isImage = ARTWORK_IMAGE_MIME.has(mime);
    const isVideo = ARTWORK_VIDEO_MIME.has(mime);
    if (!isImage && !isVideo) {
      fs.unlink(req.file.path, () => undefined);
      throw new AppError(
        `Unsupported format ${mime}. Allowed: PNG, JPEG, WebP, GIF, SVG, MP4, WebM.`,
      );
    }

    if (isImage && req.file.size > ARTWORK_IMAGE_MAX_BYTES) {
      fs.unlink(req.file.path, () => undefined);
      throw new AppError('Image must be ≤ 5 MB');
    }
    if (isVideo && req.file.size > ARTWORK_VIDEO_MAX_BYTES) {
      fs.unlink(req.file.path, () => undefined);
      throw new AppError('Video must be ≤ 25 MB');
    }

    let width: number | undefined;
    let height: number | undefined;

    try {
      if (mime === 'image/svg+xml') {
        if (req.file.size > MAX_SVG_BYTES) {
          throw new AppError('SVG must be ≤ 400 KB');
        }
        const raw = await fs.promises.readFile(req.file.path, 'utf8');
        const clean = sanitiseSvg(raw);
        await fs.promises.writeFile(req.file.path, clean, 'utf8');
      } else if (isImage) {
        const sharp = (await import('sharp')).default;
        const meta = await sharp(req.file.path).metadata();
        width = meta.width;
        height = meta.height;
        if (!width || !height) {
          throw new AppError('Could not read image dimensions');
        }
        const min = Math.min(width, height);
        const max = Math.max(width, height);
        if (min < ARTWORK_IMAGE_MIN_SIDE || max > ARTWORK_IMAGE_MAX_SIDE) {
          throw new AppError(
            `Image must be between ${ARTWORK_IMAGE_MIN_SIDE}px and ${ARTWORK_IMAGE_MAX_SIDE}px on each side`,
          );
        }
        try {
          await createThumbnail(req.file.path);
        } catch {
          // thumbnail is best-effort
        }
      }
    } catch (err) {
      fs.unlink(req.file.path, () => undefined);
      if (err instanceof AppError) throw err;
      throw new AppError(err instanceof Error ? err.message : 'Failed to process upload');
    }

    const fileHash = await hashFile(req.file.path);
    const finalSize = (await fs.promises.stat(req.file.path)).size;

    const media = await Media.create({
      traceId: null,
      projectId: nft.projectId,
      uploaderAlias: req.node!.alias,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: mime,
      size: finalSize,
      hash: fileHash,
      path: req.file.path,
    });

    res.status(201).json({
      mediaId: String(media._id),
      hash: fileHash,
      mimeType: mime,
      size: finalSize,
      width,
      height,
      url: `/media/${String(media._id)}`,
    });
  },
);

export default router;
