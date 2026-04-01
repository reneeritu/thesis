import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createArchiveSchema, addAttestationSchema } from '../schemas/archive';
import mongoose from 'mongoose';
import { Archive } from '../models/Archive';
import { Media } from '../models/Media';
import { Project } from '../models/Project';
import { Space } from '../models/Space';
import { ChainNode } from '../models/Node';
import { NFT, ContributorToken } from '../models/NFT';
import { addBlock } from '../services/chain';
import { sha256 } from '../utils/hash';
import { AuthRequest } from '../types';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors';

const router = Router();

/**
 * POST /archives
 * ARCHIVE contract — documents a past or completed project retroactively.
 *
 * Non-negotiables stored on chain:
 *   - Date documented on chain (block timestamp)
 *   - Original work declaration
 *   - Approximate date of making
 *   - Evidence provided (hashes)
 *   - Reconstruction flag (self-reported)
 *
 * Creates: archive project (status "archived"), archive record, archive-badge NFT,
 * contributor tokens for collaborators.
 */
router.post(
  '/',
  requireAuth,
  validate(createArchiveSchema),
  async (req: AuthRequest, res: Response) => {
    const {
      title,
      medium,
      approxDate,
      spaceId,
      evidence: rawEvidence,
      reconstructionFlag,
      originalWorkDeclaration,
      collaborators,
      contextNote,
    } = req.body;
    const alias = req.node!.alias;

    const space = await Space.findById(spaceId);
    if (!space) throw new NotFoundError('Space');
    if (!space.members.includes(alias)) {
      throw new ForbiddenError('You must be a member of this space');
    }

    type EvidenceIn = {
      evidenceType: string;
      evidenceHash: string;
      otherDescription?: string;
      mediaId?: mongoose.Types.ObjectId;
    };

    const evidence: EvidenceIn[] = rawEvidence.map(
      (e: {
        evidenceType: string;
        evidenceHash: string;
        otherDescription?: string;
        mediaId?: string;
      }) => {
        const out: EvidenceIn = {
          evidenceType: e.evidenceType,
          evidenceHash: e.evidenceHash,
          otherDescription: e.otherDescription,
        };
        if (e.mediaId && mongoose.Types.ObjectId.isValid(e.mediaId)) {
          out.mediaId = new mongoose.Types.ObjectId(e.mediaId);
        }
        return out;
      },
    );

    for (const e of evidence) {
      if (!e.mediaId) continue;
      const media = await Media.findById(e.mediaId);
      if (!media) throw new NotFoundError('Media');
      if (media.uploaderAlias !== alias) {
        throw new ForbiddenError('Evidence media must be uploaded by you');
      }
      if (media.hash !== e.evidenceHash) {
        throw new AppError('Evidence hash does not match uploaded media');
      }
      const sid = space._id!.toString();
      if (media.spaceId && media.spaceId.toString() !== sid) {
        throw new AppError('Evidence media must belong to the selected space');
      }
    }

    const contributorList = [
      { alias, role: 'creator', isPrimary: true, signedAt: new Date() },
    ];

    if (collaborators) {
      for (const collab of collaborators) {
        if (collab === alias) continue;
        const exists = await ChainNode.findOne({ alias: collab, status: 'active' });
        if (exists) {
          contributorList.push({
            alias: collab,
            role: 'collaborator',
            isPrimary: false,
            signedAt: null as unknown as Date,
          });
        }
      }
    }

    const block = await addBlock('archive', alias, {
      title,
      medium,
      approxDate,
      creatorAlias: alias,
      evidenceHashes: evidence.map((e: EvidenceIn) => e.evidenceHash),
      reconstructionFlag,
      originalWorkDeclaration,
    });

    const project = await Project.create({
      title,
      spaceId,
      creatorAlias: alias,
      contributors: contributorList,
      context: contextNote || '',
      status: 'archived',
      visibility: 'space_only',
      startBlockIndex: block.index,
    });

    const archive = await Archive.create({
      projectId: project._id,
      title,
      medium,
      approxDate,
      creatorAlias: alias,
      collaborators: collaborators || [],
      evidence: evidence.map((e: EvidenceIn) => ({
        evidenceType: e.evidenceType,
        evidenceHash: e.evidenceHash,
        otherDescription: e.otherDescription || '',
        ...(e.mediaId ? { mediaId: e.mediaId } : {}),
      })),
      reconstructionFlag,
      originalWorkDeclaration,
      contextNote: contextNote || '',
      attestations: [
        {
          attestationType: 'self',
          attestingAlias: alias,
          relationship: 'collaborator',
          statementHash: sha256(`Self-attestation by ${alias} for archive: ${title}`),
        },
      ],
      blockIndex: block.index,
    });

    const equalWeight = 1 / contributorList.length;
    const nft = await NFT.create({
      projectId: project._id,
      title: `[ARCHIVE] ${title}`,
      medium,
      creators: [alias],
      contributors: contributorList.map((c) => ({
        alias: c.alias,
        role: c.role,
        weight: equalWeight,
        timeLogged: 0,
      })),
      processBlockIndices: [block.index],
      creditBlockIndex: block.index,
    });

    archive.nftId = nft._id;
    await archive.save();

    const tokenDocs = contributorList.map((c) => ({
      projectId: project._id,
      nftId: nft._id,
      alias: c.alias,
      role: c.role,
      weight: equalWeight,
      timeLogged: 0,
      blockIndex: block.index,
    }));
    await ContributorToken.insertMany(tokenDocs);

    for (const e of evidence) {
      if (e.mediaId) {
        await Media.findByIdAndUpdate(e.mediaId, {
          $set: { projectId: project._id },
        });
      }
    }

    res.status(201).json({ archive, project, nft });
  },
);

/**
 * POST /archives/:id/attestations
 * Add an attestation to an archive (peer or institution).
 */
router.post(
  '/:id/attestations',
  requireAuth,
  validate(addAttestationSchema),
  async (req: AuthRequest, res: Response) => {
    const archive = await Archive.findById(req.params.id);
    if (!archive) throw new NotFoundError('Archive');

    const alias = req.node!.alias;

    if (alias === archive.creatorAlias && req.body.attestationType !== 'self') {
      throw new AppError('Creator can only self-attest');
    }

    const alreadyAttested = archive.attestations.some(
      (a) => a.attestingAlias === alias,
    );
    if (alreadyAttested) throw new AppError('Already attested');

    const { attestationType, relationship, statement } = req.body;
    const statementHash = sha256(statement);

    archive.attestations.push({
      attestationType,
      attestingAlias: alias,
      relationship,
      statementHash,
      createdAt: new Date(),
    });

    await archive.save();

    res.status(201).json({ message: 'Attestation added', archive });
  },
);

/**
 * GET /archives/space/:spaceId
 * Must be before GET /:id so "space" is not captured as id.
 */
router.get(
  '/space/:spaceId',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const projects = await Project.find({
      spaceId: req.params.spaceId,
      status: 'archived',
    });
    const projectIds = projects.map((p) => p._id);
    const archives = await Archive.find({ projectId: { $in: projectIds } }).sort({
      createdAt: -1,
    });
    res.json(archives);
  },
);

/**
 * GET /archives/:id
 */
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const archive = await Archive.findById(req.params.id);
  if (!archive) throw new NotFoundError('Archive');
  res.json(archive);
});

export default router;
