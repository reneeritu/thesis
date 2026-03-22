import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { NFT, ContributorToken } from '../models/NFT';
import { Project } from '../models/Project';
import { Archive } from '../models/Archive';
import { AuthRequest } from '../types';
import { NotFoundError } from '../utils/errors';

const router = Router();

/**
 * GET /nfts/:id
 * NFT detail + contributor tokens + linked project (+ archive row if minted from archive flow).
 */
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const nft = await NFT.findById(req.params.id);
  if (!nft) throw new NotFoundError('NFT');

  const contributorTokens = await ContributorToken.find({ nftId: nft._id });
  const project = await Project.findById(nft.projectId);
  if (!project) throw new NotFoundError('Project');

  const archive = await Archive.findOne({ nftId: nft._id });

  res.json({
    nft,
    contributorTokens,
    project,
    archive: archive || null,
  });
});

export default router;
