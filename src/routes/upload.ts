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
import { hashFile, createThumbnail } from '../services/media';
import { config } from '../config';
import { AuthRequest } from '../types';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors';

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

export default router;
