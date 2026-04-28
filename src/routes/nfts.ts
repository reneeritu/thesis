import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { optionalAuth } from '../middleware/optionalAuth';
import { NFT, ContributorToken } from '../models/NFT';
import { Project } from '../models/Project';
import { Archive } from '../models/Archive';
import { Media } from '../models/Media';
import { Trace } from '../models/Trace';
import { Pivot } from '../models/Pivot';
import { Reference } from '../models/Reference';
import { sanitiseSvg, MAX_SVG_BYTES } from '../services/svgSanitise';
import { AuthRequest } from '../types';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors';
import { assertProjectReadableForOptionalViewer } from '../utils/projectAccess';

const router = Router();

/**
 * GET /nfts/:id
 * NFT detail + contributor tokens + linked project (+ archive row if minted from archive flow).
 */
router.get('/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  const nft = await NFT.findById(req.params.id);
  if (!nft) throw new NotFoundError('NFT');

  const project = await assertProjectReadableForOptionalViewer(nft.projectId.toString(), req);

  const contributorTokens = await ContributorToken.find({ nftId: nft._id });

  const archive = await Archive.findOne({ nftId: nft._id });

  // Timeline counts drive the generative artwork engine on the frontend.
  const [traceCount, pivotCount, referenceCount] = await Promise.all([
    Trace.countDocuments({ projectId: nft.projectId }),
    Pivot.countDocuments({ projectId: nft.projectId }),
    Reference.countDocuments({ projectId: nft.projectId }),
  ]);

  res.json({
    nft,
    contributorTokens,
    project,
    archive: archive || null,
    counts: { traceCount, pivotCount, referenceCount },
  });
});

/**
 * PUT /nfts/:id/artwork
 * Attach (or replace) the artwork on a provenance certificate.
 *
 * Two modes:
 *   { type: 'generated', svg, paramsJson, rendererVersion }
 *     - SVG produced by the built-in generative engine.
 *     - svg is still re-sanitised defensively before storage.
 *   { type: 'uploaded', mediaId }
 *     - Media previously uploaded via POST /upload/cert-artwork.
 *
 * Only primary contributors on the owning project may call this.
 */
router.put('/:id/artwork', requireAuth, async (req: AuthRequest, res: Response) => {
  const nft = await NFT.findById(req.params.id);
  if (!nft) throw new NotFoundError('Certificate');

  const project = await Project.findById(nft.projectId);
  if (!project) throw new NotFoundError('Project');

  const alias = req.node!.alias;
  const isPrimary = project.contributors.some((c) => c.alias === alias && c.isPrimary);
  if (!isPrimary) {
    throw new ForbiddenError('Only primary contributors can set certificate artwork');
  }

  const { type } = req.body as { type?: string };

  if (type === 'generated') {
    const { svg, paramsJson, rendererVersion } = req.body as {
      svg?: string;
      paramsJson?: string;
      rendererVersion?: string;
    };
    if (typeof svg !== 'string' || !svg.trim()) {
      throw new AppError('svg is required for generated artwork');
    }
    if (Buffer.byteLength(svg, 'utf8') > MAX_SVG_BYTES) {
      throw new AppError('Generated SVG is too large');
    }
    if (typeof paramsJson !== 'string') {
      throw new AppError('paramsJson is required for generated artwork');
    }
    try {
      JSON.parse(paramsJson);
    } catch {
      throw new AppError('paramsJson must be valid JSON');
    }

    const clean = sanitiseSvg(svg);

    nft.artwork = {
      type: 'generated',
      svg: clean,
      paramsJson,
      rendererVersion: rendererVersion || 'unknown',
      mimeType: 'image/svg+xml',
      width: 1024,
      height: 1024,
      updatedAt: new Date(),
      updatedBy: alias,
    };
    await nft.save();
    return res.json({ artwork: nft.artwork });
  }

  if (type === 'uploaded') {
    const { mediaId } = req.body as { mediaId?: string };
    if (!mediaId || !/^[a-fA-F0-9]{24}$/.test(mediaId)) {
      throw new AppError('Valid mediaId is required');
    }
    const media = await Media.findById(mediaId);
    if (!media) throw new NotFoundError('Media');
    if (media.status !== 'active') {
      throw new AppError('Media is not active');
    }
    if (media.uploaderAlias !== alias) {
      throw new ForbiddenError('Only the uploader can attach this media');
    }
    if (String(media.projectId) !== String(nft.projectId)) {
      throw new AppError('Media does not belong to this project');
    }

    nft.artwork = {
      type: 'uploaded',
      mediaId: media._id as any,
      mimeType: media.mimeType,
      updatedAt: new Date(),
      updatedBy: alias,
    };
    await nft.save();
    return res.json({ artwork: nft.artwork });
  }

  throw new AppError("type must be 'generated' or 'uploaded'");
});

export default router;
