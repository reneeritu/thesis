import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { creditProjectSchema, signCreditSchema } from '../schemas/credit';
import { Project } from '../models/Project';
import { Trace } from '../models/Trace';
import { Block } from '../models/Block';
import { NFT, ContributorToken } from '../models/NFT';
import { Mediation } from '../models/Mediation';
import { addBlock } from '../services/chain';
import { chainDefaults } from '../config/defaults';
import { AuthRequest } from '../types';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors';

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function getCreditDisputeComplexity(contributorCount: number): 2 | 3 {
  return contributorCount > 2 ? 3 : 2;
}

function getCreditDisputeTimeLock(contributorCount: number): number {
  return chainDefaults.mediationTimeLockHours[getCreditDisputeComplexity(contributorCount)] ?? 168;
}

const router = Router();

/**
 * POST /credits
 * CREDIT contract — closes a project, mints final NFT and contributor tokens.
 *
 * Co-ownership logic:
 *   - No weights specified → equal split across all on-chain contributors
 *   - Weights specified → must cover ALL on-chain contributors, sum to 1
 *   - Any party disagrees → disputed flag
 *
 * ALL on-chain contributors must sign before the NFT is finalized.
 * This endpoint initiates the credit; signing happens via /credits/:nftId/sign.
 *
 * Off-chain contributors: if any trace or contract in the project's history
 * mentions unclaimed credit (someone not on chain), that must be included in
 * offChainContributors so the credit is claimable if they later join.
 *
 * TODO: Cross-check offChainContributors against off-chain mentions in traces
 * once traces gain an offChainMentions field. Currently the caller is trusted
 * to include all off-chain mentions.
 */
router.post(
  '/',
  requireAuth,
  validate(creditProjectSchema),
  async (req: AuthRequest, res: Response) => {
    const { projectId, medium, contributors, offChainContributors, disputeFlag } = req.body;
    const alias = req.node!.alias;

    const project = await Project.findById(projectId);
    if (!project) throw new NotFoundError('Project');
    if (project.status !== 'active') throw new AppError('Project is not active');

    const isPrimary = project.contributors.some(
      (c) => c.alias === alias && c.isPrimary,
    );
    if (!isPrimary) {
      throw new ForbiddenError('Only primary contributors can initiate credit');
    }

    const existingNft = await NFT.findOne({ projectId });
    if (existingNft) throw new AppError('Credit already initiated for this project');

    const allContributors = project.contributors.map((c) => c.alias);

    const traces = await Trace.find({ projectId });
    const timeByAlias: Record<string, number> = {};
    for (const t of traces) {
      const key = t.isProxy ? t.proxyForAlias || t.nodeAlias : t.nodeAlias;
      timeByAlias[key] = (timeByAlias[key] || 0) + (t.duration || 0);
    }

    let weightMap: { alias: string; role: string; weight: number; timeLogged: number }[];

    if (contributors && contributors.length > 0) {
      const providedAliases = new Set(
        contributors.map((c: { alias: string }) => c.alias),
      );
      const missing = allContributors.filter((a: string) => !providedAliases.has(a));
      if (missing.length > 0) {
        throw new AppError(
          `All on-chain contributors must be included in the weight list. Missing: ${missing.join(', ')}`,
        );
      }

      const totalWeight = contributors.reduce(
        (s: number, c: { alias: string; role?: string; weight?: number }) => s + (c.weight || 0),
        0,
      );
      if (totalWeight > 0 && Math.abs(totalWeight - 1) > 0.001) {
        throw new AppError('Contributor weights must sum to 1');
      }

      weightMap = contributors.map((c: { alias: string; role?: string; weight?: number }) => ({
        alias: c.alias,
        role: c.role || project.contributors.find((p) => p.alias === c.alias)?.role || 'contributor',
        weight: c.weight ?? 1 / allContributors.length,
        timeLogged: timeByAlias[c.alias] || 0,
      }));
    } else {
      const equalWeight = 1 / allContributors.length;
      weightMap = project.contributors.map((c) => ({
        alias: c.alias,
        role: c.role,
        weight: equalWeight,
        timeLogged: timeByAlias[c.alias] || 0,
      }));
    }

    const processBlocks = await Block.find({
      'data.projectId': projectId,
    }).distinct('index');

    const block = await addBlock('credit', alias, {
      projectId,
      contributors: weightMap.map((w) => ({ alias: w.alias, weight: w.weight })),
      disputed: disputeFlag || false,
      offChainContributors: offChainContributors || [],
    });

    const nft = await NFT.create({
      projectId,
      title: project.title,
      medium: medium || '',
      creators: project.contributors.filter((c) => c.isPrimary).map((c) => c.alias),
      contributors: weightMap,
      processBlockIndices: processBlocks,
      disputed: disputeFlag || false,
      creditBlockIndex: block.index,
    });

    const tokenDocs = weightMap.map((w) => ({
      projectId,
      nftId: nft._id,
      alias: w.alias,
      role: w.role,
      weight: w.weight,
      timeLogged: w.timeLogged,
      blockIndex: block.index,
    }));
    await ContributorToken.insertMany(tokenDocs);

    project.status = disputeFlag ? 'disputed' : 'completed';
    await project.save();

    let mediation = null;
    if (disputeFlag) {
      const complexity = getCreditDisputeComplexity(project.contributors.length);
      const timeLock = getCreditDisputeTimeLock(project.contributors.length);

      const mediationBlock = await addBlock('mediation', alias, {
        projectId,
        triggerType: 'credit_dispute',
        relatedEntityId: nft._id,
        relatedEntityType: 'nft',
        complexityLevel: complexity,
        action: 'trigger',
        autoCreated: true,
      });

      mediation = await Mediation.create({
        projectId,
        spaceId: project.spaceId,
        triggerType: 'credit_dispute',
        triggeredBy: alias,
        parties: project.contributors.map((c) => c.alias),
        status: 'peer_to_peer',
        complexityLevel: complexity,
        relatedEntityId: nft._id,
        relatedEntityType: 'nft',
        reason: 'Dispute flag set during credit creation',
        proposals: [],
        revisedAgreement: null,
        peerDeadline: addHours(new Date(), timeLock),
        spaceDeadline: null,
        blockIndex: mediationBlock.index,
        resolutionBlockIndex: null,
      });
    }

    res.status(201).json({
      nft,
      contributorTokens: tokenDocs.length,
      offChainContributors: offChainContributors || [],
      mediation,
    });
  },
);

/**
 * POST /credits/:nftId/sign
 * ALL on-chain contributors must sign the credit. Once every contributor
 * has signed, the NFT is considered finalized. If any contributor rejects,
 * the project moves to disputed status.
 *
 * TODO: Add a configurable timeout — if a contributor doesn't sign within
 * X days, escalate to the Mediate flow. For now, unsigned = blocked until
 * they sign or reject (option 1: accept deadlock risk).
 */
router.post(
  '/:nftId/sign',
  requireAuth,
  validate(signCreditSchema),
  async (req: AuthRequest, res: Response) => {
    const nft = await NFT.findById(req.params.nftId);
    if (!nft) throw new NotFoundError('NFT');

    const alias = req.node!.alias;
    const project = await Project.findById(nft.projectId);
    if (!project) throw new NotFoundError('Project');

    const contributor = project.contributors.find((c) => c.alias === alias);
    if (!contributor) throw new ForbiddenError('Only project contributors can sign');

    if (contributor.signedAt) throw new AppError('Already signed');

    const { accepted } = req.body;

    if (!accepted) {
      nft.disputed = true;
      project.status = 'disputed';
      await nft.save();
      await project.save();

      const existingMediation = await Mediation.findOne({
        relatedEntityId: nft._id,
        relatedEntityType: 'nft',
        status: { $nin: ['resolved', 'failed'] },
      });

      let mediation = existingMediation;
      if (!existingMediation) {
        const complexity = getCreditDisputeComplexity(project.contributors.length);
        const timeLock = getCreditDisputeTimeLock(project.contributors.length);

        const mediationBlock = await addBlock('mediation', alias, {
          projectId: project._id,
          triggerType: 'credit_dispute',
          relatedEntityId: nft._id,
          relatedEntityType: 'nft',
          complexityLevel: complexity,
          action: 'trigger',
          autoCreated: true,
        });

        mediation = await Mediation.create({
          projectId: project._id,
          spaceId: project.spaceId,
          triggerType: 'credit_dispute',
          triggeredBy: alias,
          parties: project.contributors.map((c) => c.alias),
          status: 'peer_to_peer',
          complexityLevel: complexity,
          relatedEntityId: nft._id,
          relatedEntityType: 'nft',
          reason: `Credit rejected by contributor ${alias}`,
          proposals: [],
          revisedAgreement: null,
          peerDeadline: addHours(new Date(), timeLock),
          spaceDeadline: null,
          blockIndex: mediationBlock.index,
          resolutionBlockIndex: null,
        });
      }

      return res.json({ message: 'Credit disputed — mediation triggered', nft, mediation });
    }

    contributor.signedAt = new Date();
    await project.save();

    const allSigned = project.contributors.every((c) => c.signedAt);

    res.json({
      message: allSigned ? 'All contributors signed — credit finalized' : 'Signature recorded',
      allSigned,
      nft,
    });
  },
);

/**
 * GET /credits/project/:projectId
 */
router.get(
  '/project/:projectId',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const nft = await NFT.findOne({ projectId: req.params.projectId });
    if (!nft) throw new NotFoundError('No credit found for this project');

    const tokens = await ContributorToken.find({ nftId: nft._id });

    res.json({ nft, contributorTokens: tokens });
  },
);

export default router;
