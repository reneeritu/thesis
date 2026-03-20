import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createMediationSchema,
  proposalSchema,
  respondSchema,
  resolveSchema,
} from '../schemas/mediation';
import { Mediation, ComplexityLevel, MediationTriggerType } from '../models/Mediation';
import { Project, IProject } from '../models/Project';
import { Veto } from '../models/Veto';
import { NFT, ContributorToken } from '../models/NFT';
import { Flag } from '../models/Flag';
import { addBlock } from '../services/chain';
import { assignPanel, recordFlagBlock } from '../services/moderation';
import { chainDefaults } from '../config/defaults';
import { AuthRequest } from '../types';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors';
import mongoose from 'mongoose';

const router = Router();

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Auto-classify dispute complexity (BACKEND.md § Auto-Classification).
 * Criteria: number of nodes, cross-space, NFT minted, trigger type.
 */
function classifyComplexity(
  triggerType: MediationTriggerType,
  project: IProject,
  hasNFT: boolean,
  crossSpace: boolean,
): ComplexityLevel {
  if (triggerType === 'classification_appeal') return 4;
  if (crossSpace || hasNFT) return 3;
  if (project.contributors.length > 2 || triggerType === 'veto_dispute') return 2;
  return 1;
}

function getTimeLockHours(level: ComplexityLevel): number {
  return chainDefaults.mediationTimeLockHours[level] ?? 168;
}

/**
 * POST /mediations
 * Trigger a new mediation case. Any project contributor can trigger.
 */
router.post(
  '/',
  requireAuth,
  validate(createMediationSchema),
  async (req: AuthRequest, res: Response) => {
    const { triggerType, projectId, relatedEntityId, relatedEntityType, reason } = req.body;
    const alias = req.node!.alias;

    const project = await Project.findById(projectId);
    if (!project) throw new NotFoundError('Project');

    const isContributor = project.contributors.some((c) => c.alias === alias);
    if (!isContributor) {
      throw new ForbiddenError('Only project contributors can trigger mediation');
    }

    const existing = await Mediation.findOne({
      relatedEntityId,
      relatedEntityType,
      status: { $nin: ['resolved', 'failed'] },
    });
    if (existing) {
      throw new AppError('An open mediation already exists for this entity');
    }

    const hasNFT = await NFT.exists({ projectId });
    const crossSpace = false; // TODO: detect cross-space disputes (Moderation System — Phase 3B)
    const level = classifyComplexity(triggerType, project, !!hasNFT, crossSpace);
    const timeLockHours = getTimeLockHours(level);

    const block = await addBlock('mediation', alias, {
      projectId,
      triggerType,
      relatedEntityId,
      relatedEntityType,
      complexityLevel: level,
      action: 'trigger',
    });

    const mediation = await Mediation.create({
      projectId,
      spaceId: project.spaceId,
      triggerType,
      triggeredBy: alias,
      parties: project.contributors.map((c) => c.alias),
      status: 'peer_to_peer',
      complexityLevel: level,
      relatedEntityId,
      relatedEntityType,
      reason,
      proposals: [],
      revisedAgreement: null,
      peerDeadline: addHours(new Date(), timeLockHours),
      spaceDeadline: null,
      blockIndex: block.index,
      resolutionBlockIndex: null,
    });

    res.status(201).json(mediation);
  },
);

/**
 * POST /mediations/:id/propose
 * Submit a resolution proposal. Only during peer_to_peer or space_escalated.
 * For credit disputes, an optional weightMap can specify revised contributor weights.
 */
router.post(
  '/:id/propose',
  requireAuth,
  validate(proposalSchema),
  async (req: AuthRequest, res: Response) => {
    const mediation = await Mediation.findById(req.params.id);
    if (!mediation) throw new NotFoundError('Mediation');

    const alias = req.node!.alias;
    if (!mediation.parties.includes(alias)) {
      throw new ForbiddenError('Only mediation parties can propose');
    }

    if (mediation.status !== 'peer_to_peer' && mediation.status !== 'space_escalated') {
      throw new AppError('Proposals can only be made during peer_to_peer or space_escalated phases');
    }

    if (mediation.proposals.length >= chainDefaults.mediationMaxProposals) {
      throw new AppError(`Maximum of ${chainDefaults.mediationMaxProposals} proposals reached`);
    }

    const { description, weightMap } = req.body;

    if (weightMap && mediation.triggerType === 'credit_dispute') {
      const project = await Project.findById(mediation.projectId);
      if (!project) throw new NotFoundError('Project');

      const allAliases = project.contributors.map((c) => c.alias);
      const providedAliases = new Set(weightMap.map((w: { alias: string }) => w.alias));
      const missing = allAliases.filter((a: string) => !providedAliases.has(a));
      if (missing.length > 0) {
        throw new AppError(
          `All on-chain contributors must be in weightMap. Missing: ${missing.join(', ')}`,
        );
      }

      const totalWeight = weightMap.reduce(
        (s: number, w: { weight: number }) => s + w.weight,
        0,
      );
      if (Math.abs(totalWeight - 1) > 0.001) {
        throw new AppError('Weights must sum to 1');
      }
    }

    mediation.proposals.push({
      proposedBy: alias,
      description,
      weightMap: weightMap || undefined,
      responses: [],
      createdAt: new Date(),
    });
    await mediation.save();

    res.status(201).json(mediation);
  },
);

/**
 * POST /mediations/:id/respond
 * Accept or reject a specific proposal. If ALL parties accept, the mediation
 * can be finalized via the /resolve endpoint.
 */
router.post(
  '/:id/respond',
  requireAuth,
  validate(respondSchema),
  async (req: AuthRequest, res: Response) => {
    const mediation = await Mediation.findById(req.params.id);
    if (!mediation) throw new NotFoundError('Mediation');

    const alias = req.node!.alias;
    if (!mediation.parties.includes(alias)) {
      throw new ForbiddenError('Only mediation parties can respond');
    }

    if (mediation.status === 'resolved' || mediation.status === 'failed') {
      throw new AppError('Mediation is already closed');
    }

    const { proposalIndex, accepted } = req.body;
    if (proposalIndex >= mediation.proposals.length) {
      throw new AppError('Invalid proposal index');
    }

    const proposal = mediation.proposals[proposalIndex];
    const alreadyResponded = proposal.responses.some((r) => r.alias === alias);
    if (alreadyResponded) {
      throw new AppError('You have already responded to this proposal');
    }

    proposal.responses.push({ alias, accepted, respondedAt: new Date() });
    await mediation.save();

    const allAccepted =
      mediation.parties.length > 0 &&
      mediation.parties.every((p) =>
        proposal.responses.some((r) => r.alias === p && r.accepted),
      );

    res.json({
      mediation,
      allAccepted,
      message: allAccepted
        ? 'All parties accepted — call /resolve to finalize'
        : 'Response recorded',
    });
  },
);

/**
 * POST /mediations/:id/escalate
 * Escalate to the next level: peer_to_peer -> space_escalated -> chain_escalated.
 * Escalation from peer_to_peer requires the peerDeadline to have passed OR
 * at least one proposal to have been fully rejected.
 * Escalation from space_escalated requires the spaceDeadline to have passed.
 */
router.post(
  '/:id/escalate',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const mediation = await Mediation.findById(req.params.id);
    if (!mediation) throw new NotFoundError('Mediation');

    const alias = req.node!.alias;
    if (!mediation.parties.includes(alias)) {
      throw new ForbiddenError('Only mediation parties can escalate');
    }

    const now = new Date();

    if (mediation.status === 'peer_to_peer') {
      const deadlinePassed = now >= mediation.peerDeadline;
      const hasRejectedProposal = mediation.proposals.some((p) =>
        p.responses.some((r) => !r.accepted),
      );

      if (!deadlinePassed && !hasRejectedProposal) {
        throw new AppError(
          'Cannot escalate yet — peer deadline has not passed and no proposal has been rejected',
        );
      }

      mediation.status = 'space_escalated';
      mediation.spaceDeadline = addHours(now, getTimeLockHours(mediation.complexityLevel));
      await mediation.save();

      const flagBlockIndex = await recordFlagBlock(alias, {
        mediationId: mediation._id,
        action: 'mediation_space_escalation',
        triggerType: mediation.triggerType,
      });

      const spaceFlag = await Flag.create({
        flagCategory: 'dispute',
        flagType: mediation.triggerType,
        targetType: 'project',
        targetId: mediation.projectId,
        raisedBy: alias,
        spaceId: mediation.spaceId,
        isInsideMember: true,
        complexityLevel: mediation.complexityLevel,
        status: 'open',
        mediationId: mediation._id as mongoose.Types.ObjectId,
        reason: `Mediation escalated to space level: ${mediation.reason}`,
        blockIndex: flagBlockIndex,
        emergencyActionTaken: false,
        appealCount: 0,
      });

      const panel = await assignPanel(spaceFlag, 0);

      return res.json({ mediation, flag: spaceFlag, panel, message: 'Escalated to space level — moderator panel assigned' });
    }

    if (mediation.status === 'space_escalated') {
      if (mediation.spaceDeadline && now < mediation.spaceDeadline) {
        throw new AppError('Cannot escalate yet — space deadline has not passed');
      }

      mediation.status = 'chain_escalated';
      await mediation.save();

      const chainComplexity = Math.min(mediation.complexityLevel + 1, 4) as 1 | 2 | 3 | 4;

      const existingFlag = await Flag.findOne({
        mediationId: mediation._id,
        flagCategory: 'dispute',
      }).sort({ createdAt: -1 });

      if (existingFlag) {
        const previousPanelMods: string[] = [];
        const { ModerationPanel } = await import('../models/ModerationPanel');
        const prevPanels = await ModerationPanel.find({ flagId: existingFlag._id });
        for (const p of prevPanels) {
          for (const m of p.acceptedModerators) previousPanelMods.push(m.alias);
        }

        const chainPanel = await assignPanel(existingFlag, 1, chainComplexity, previousPanelMods);
        return res.json({ mediation, panel: chainPanel, message: 'Escalated to chain level — new panel assigned' });
      }

      return res.json({ mediation, message: 'Escalated to chain level' });
    }

    throw new AppError(`Cannot escalate from status: ${mediation.status}`);
  },
);

/**
 * POST /mediations/:id/resolve
 * Finalize the mediation with a revised agreement. Requires all parties
 * to have accepted the proposal at proposalIndex.
 *
 * Side-effects by trigger type:
 * - credit_dispute: updates NFT weights and ContributorTokens, project -> completed
 * - veto_dispute: upholds or reverses the veto based on proposal description
 * - space_ban_dispute / classification_appeal: stub (Phase 3B)
 */
router.post(
  '/:id/resolve',
  requireAuth,
  validate(resolveSchema),
  async (req: AuthRequest, res: Response) => {
    const mediation = await Mediation.findById(req.params.id);
    if (!mediation) throw new NotFoundError('Mediation');

    const alias = req.node!.alias;
    if (!mediation.parties.includes(alias)) {
      throw new ForbiddenError('Only mediation parties can resolve');
    }

    if (mediation.status === 'resolved' || mediation.status === 'failed') {
      throw new AppError('Mediation is already closed');
    }

    const { proposalIndex } = req.body;
    if (proposalIndex >= mediation.proposals.length) {
      throw new AppError('Invalid proposal index');
    }

    const proposal = mediation.proposals[proposalIndex];
    const allAccepted = mediation.parties.every((p) =>
      proposal.responses.some((r) => r.alias === p && r.accepted),
    );
    if (!allAccepted) {
      throw new AppError('Not all parties have accepted this proposal');
    }

    const block = await addBlock('mediation', alias, {
      mediationId: mediation._id,
      projectId: mediation.projectId,
      action: 'resolved',
      proposalIndex,
    });

    mediation.status = 'resolved';
    mediation.resolutionBlockIndex = block.index;

    if (mediation.triggerType === 'credit_dispute') {
      if (proposal.weightMap && proposal.weightMap.length > 0) {
        mediation.revisedAgreement = proposal.weightMap;

        const nft = await NFT.findById(mediation.relatedEntityId);
        if (nft) {
          nft.contributors = nft.contributors.map((c) => {
            const revised = proposal.weightMap!.find((w) => w.alias === c.alias);
            return revised ? { ...c, weight: revised.weight } : c;
          });
          nft.disputed = false;
          await nft.save();

          for (const entry of proposal.weightMap) {
            await ContributorToken.updateOne(
              { nftId: nft._id, alias: entry.alias },
              { $set: { weight: entry.weight } },
            );
          }
        }
      }

      const project = await Project.findById(mediation.projectId);
      if (project && project.status === 'disputed') {
        project.status = 'completed';
        await project.save();
      }
    } else if (mediation.triggerType === 'veto_dispute') {
      const veto = await Veto.findById(mediation.relatedEntityId);
      if (veto) {
        const descLower = proposal.description.toLowerCase();
        if (descLower.includes('reverse') || descLower.includes('overturn')) {
          veto.status = 'rejected';
          await veto.save();

          const project = await Project.findById(mediation.projectId);
          if (project && project.status === 'halted') {
            project.status = 'active';
            await project.save();
          }
        }
      }
    }
    // TODO: space_ban_dispute and classification_appeal resolution
    // side-effects will be implemented with the Moderation System (Phase 3B)

    await mediation.save();

    res.json({ mediation, message: 'Mediation resolved' });
  },
);

/**
 * POST /mediations/:id/fail
 * Mark mediation as failed. Only from chain_escalated status.
 *
 * For credit disputes: enforces equal split across all contributors,
 * marks NFT as permanently disputed, project stays disputed.
 */
router.post(
  '/:id/fail',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const mediation = await Mediation.findById(req.params.id);
    if (!mediation) throw new NotFoundError('Mediation');

    const alias = req.node!.alias;
    if (!mediation.parties.includes(alias)) {
      throw new ForbiddenError('Only mediation parties can trigger failure');
    }

    if (mediation.status !== 'chain_escalated') {
      throw new AppError('Mediation can only be failed from chain_escalated status');
    }

    const block = await addBlock('mediation', alias, {
      mediationId: mediation._id,
      projectId: mediation.projectId,
      action: 'failed',
    });

    mediation.status = 'failed';
    mediation.resolutionBlockIndex = block.index;

    if (mediation.triggerType === 'credit_dispute') {
      const nft = await NFT.findById(mediation.relatedEntityId);
      if (nft) {
        const equalWeight = 1 / nft.contributors.length;
        nft.contributors = nft.contributors.map((c) => ({ ...c, weight: equalWeight }));
        nft.disputed = true;
        await nft.save();

        for (const c of nft.contributors) {
          await ContributorToken.updateOne(
            { nftId: nft._id, alias: c.alias },
            { $set: { weight: equalWeight } },
          );
        }
      }
    }
    // TODO: veto_dispute, space_ban_dispute, classification_appeal failure
    // side-effects will be implemented with the Moderation System (Phase 3B)

    await mediation.save();

    res.json({ mediation, message: 'Mediation failed — defaults enforced' });
  },
);

/**
 * GET /mediations/project/:projectId
 */
router.get(
  '/project/:projectId',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const mediations = await Mediation.find({ projectId: req.params.projectId }).sort({
      createdAt: -1,
    });
    res.json(mediations);
  },
);

/**
 * GET /mediations/:id
 */
router.get(
  '/:id',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const mediation = await Mediation.findById(req.params.id);
    if (!mediation) throw new NotFoundError('Mediation');
    res.json(mediation);
  },
);

export default router;
