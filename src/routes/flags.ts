import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createFlagSchema,
  exclusionRequestSchema,
  exclusionVoteSchema,
  rulingSchema,
  appealSchema,
} from '../schemas/flag';
import { Flag, CATEGORY_TO_TYPES } from '../models/Flag';
import { ModerationPanel } from '../models/ModerationPanel';
import { Mediation } from '../models/Mediation';
import { Space } from '../models/Space';
import { ChainNode } from '../models/Node';
import { NFT } from '../models/NFT';
import { chainDefaults } from '../config/defaults';
import {
  assignPanel,
  classifyFlagComplexity,
  applyReputationPenalty,
  suspendNode,
  recordFlagBlock,
} from '../services/moderation';
import {
  resolveFlagMedia,
  permanentDelete,
  hideContent,
  destroyBackup,
  restoreContent,
  removeContent,
  hideInSpace,
} from '../services/contentSafety';
import { AuthRequest } from '../types';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors';

const router = Router();

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Filter panel data based on anonymity level and the caller's role.
 * Level 1-2: moderators see parties; parties do NOT see moderator aliases.
 * Level 3: fully anonymous both ways until ruled; moderators revealed after.
 * Level 4: fully transparent.
 */
function filterPanelForCaller(
  panel: Record<string, unknown>,
  complexityLevel: number,
  callerAlias: string,
  raisedBy: string,
  isRuled: boolean,
) {
  const isModerator =
    Array.isArray(panel.acceptedModerators) &&
    (panel.acceptedModerators as { alias: string }[]).some((m) => m.alias === callerAlias);
  const isParty = callerAlias === raisedBy;

  if (complexityLevel === 4) return panel;

  const filtered = { ...panel };

  if (complexityLevel <= 2) {
    if (isParty && !isModerator) {
      filtered.invitedModerators = (panel.invitedModerators as unknown[]).map(() => ({ alias: 'anonymous' }));
      filtered.acceptedModerators = (panel.acceptedModerators as unknown[]).map(() => ({ alias: 'anonymous' }));
    }
  } else if (complexityLevel === 3) {
    if (!isRuled) {
      if (isParty && !isModerator) {
        filtered.invitedModerators = (panel.invitedModerators as unknown[]).map(() => ({ alias: 'anonymous' }));
        filtered.acceptedModerators = (panel.acceptedModerators as unknown[]).map(() => ({ alias: 'anonymous' }));
      }
      if (isModerator && !isParty) {
        filtered.raisedBy = 'anonymous';
      }
    }
  }

  return filtered;
}

/**
 * POST /flags
 * Raise a flag. Any node can flag any target.
 * Emergency flags trigger immediate auto-action.
 * Dispute flags also create a Mediation case.
 */
router.post(
  '/',
  requireAuth,
  validate(createFlagSchema),
  async (req: AuthRequest, res: Response) => {
    const { flagCategory, flagType, targetType, targetId, spaceId, reason } = req.body;
    const alias = req.node!.alias;

    const validTypes = CATEGORY_TO_TYPES[flagCategory as keyof typeof CATEGORY_TO_TYPES];
    if (!validTypes || !validTypes.includes(flagType)) {
      throw new AppError(`Flag type '${flagType}' is not valid for category '${flagCategory}'`);
    }

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      throw new AppError('Invalid targetId');
    }

    let resolvedSpaceId: mongoose.Types.ObjectId | null = null;
    let isInsideMember = false;
    if (spaceId) {
      const space = await Space.findById(spaceId);
      if (space) {
        resolvedSpaceId = space._id as mongoose.Types.ObjectId;
        isInsideMember = space.members.includes(alias);
      }
    }

    if (flagType === 'nudity') {
      if (!resolvedSpaceId) {
        throw new AppError('Nudity flags require a spaceId — nudity is permitted at chain level');
      }
      const space = await Space.findById(resolvedSpaceId);
      if (space && !space.settings.contentRestrictions.includes('nudity')) {
        throw new AppError('This space does not restrict nudity in its contentRestrictions');
      }
    }

    const hasNFT = targetType === 'nft';
    const complexity = classifyFlagComplexity(flagCategory, flagType, targetType, 2, false, hasNFT);

    const blockIndex = await recordFlagBlock(alias, {
      flagCategory,
      flagType,
      targetType,
      targetId,
      action: 'raised',
    });

    const flag = await Flag.create({
      flagCategory,
      flagType,
      targetType,
      targetId: new mongoose.Types.ObjectId(targetId),
      raisedBy: alias,
      spaceId: resolvedSpaceId,
      isInsideMember,
      complexityLevel: complexity,
      status: 'open',
      mediationId: null,
      reason,
      blockIndex,
      emergencyActionTaken: false,
      appealCount: 0,
    });

    if (flagCategory === 'emergency') {
      const resolved = await resolveFlagMedia(targetType, targetId);

      if (flagType === 'csam') {
        if (resolved.mediaIds.length > 0) {
          await permanentDelete(resolved.mediaIds);
        }
        const suspendAlias = resolved.uploaderAlias || (targetType === 'node' ? targetId : null);
        if (suspendAlias) await suspendNode(suspendAlias);

        flag.emergencyActionTaken = true;
        flag.status = 'panel_assigned';
        await flag.save();
      } else if (flagType === 'non_consensual_imagery') {
        if (resolved.mediaIds.length > 0) {
          await hideContent(resolved.mediaIds, flag._id as mongoose.Types.ObjectId);
        }
        const suspendAlias = resolved.uploaderAlias || (targetType === 'node' ? targetId : null);
        if (suspendAlias) await suspendNode(suspendAlias);

        flag.emergencyActionTaken = true;
        flag.status = 'panel_assigned';
        await flag.save();
      }

      const isNcii = flagType === 'non_consensual_imagery';
      await assignPanel(flag, 0, undefined, undefined);

      if (isNcii) {
        const panel = await ModerationPanel.findOne({ flagId: flag._id }).sort({ createdAt: -1 });
        if (panel) {
          panel.timeLockExpiry = addHours(new Date(), chainDefaults.emergencyPanelTimeLockHours);
          await panel.save();
        }
      }

      return res.status(201).json({ flag, emergencyActionTaken: true });
    }

    if (flagCategory === 'dispute') {
      const mediation = await Mediation.create({
        projectId: new mongoose.Types.ObjectId(targetId),
        spaceId: resolvedSpaceId || new mongoose.Types.ObjectId(),
        triggerType: flagType as 'credit_dispute' | 'veto_dispute' | 'space_ban_dispute' | 'classification_appeal',
        triggeredBy: alias,
        parties: [alias],
        status: 'peer_to_peer',
        complexityLevel: complexity,
        relatedEntityId: new mongoose.Types.ObjectId(targetId),
        relatedEntityType: targetType === 'nft' ? 'nft' : targetType === 'space' ? 'space_ban' : 'veto',
        reason,
        proposals: [],
        revisedAgreement: null,
        peerDeadline: addHours(new Date(), chainDefaults.mediationTimeLockHours[complexity] ?? 168),
        spaceDeadline: null,
        blockIndex,
        resolutionBlockIndex: null,
      });

      flag.mediationId = mediation._id as mongoose.Types.ObjectId;
      await flag.save();

      return res.status(201).json({ flag, mediation });
    }

    await assignPanel(flag, 0);

    res.status(201).json({ flag });
  },
);

/**
 * POST /flags/:id/accept-panel
 * Accept a moderator role on the active panel for this flag.
 */
router.post(
  '/:id/accept-panel',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const flag = await Flag.findById(req.params.id);
    if (!flag) throw new NotFoundError('Flag');

    const alias = req.node!.alias;

    const panel = await ModerationPanel.findOne({
      flagId: flag._id,
      status: 'awaiting_moderators',
    }).sort({ createdAt: -1 });

    if (!panel) throw new AppError('No panel awaiting moderators for this flag');

    const isInvited = panel.invitedModerators.some((m) => m.alias === alias);
    if (!isInvited) throw new ForbiddenError('You are not invited to this panel');

    const alreadyAccepted = panel.acceptedModerators.some((m) => m.alias === alias);
    if (alreadyAccepted) throw new AppError('Already accepted');

    panel.acceptedModerators.push({ alias, acceptedAt: new Date() });

    if (panel.acceptedModerators.length >= panel.requiredModerators) {
      panel.status = 'reviewing';
      const timeLockHours = chainDefaults.mediationTimeLockHours[panel.complexityLevel] ?? 168;
      panel.timeLockExpiry = addHours(new Date(), timeLockHours);

      flag.status = 'under_review';
      await flag.save();
    }

    await panel.save();

    res.json({ panel, message: panel.status === 'reviewing' ? 'Panel complete — review started' : 'Accepted' });
  },
);

/**
 * POST /flags/:id/exclude
 * Request to exclude a moderator from the panel.
 * Max 1 exclusion request per party per flag.
 */
router.post(
  '/:id/exclude',
  requireAuth,
  validate(exclusionRequestSchema),
  async (req: AuthRequest, res: Response) => {
    const flag = await Flag.findById(req.params.id);
    if (!flag) throw new NotFoundError('Flag');

    const alias = req.node!.alias;
    if (alias !== flag.raisedBy) {
      throw new ForbiddenError('Only the flagging party can request exclusion');
    }

    const panel = await ModerationPanel.findOne({
      flagId: flag._id,
      status: { $in: ['awaiting_moderators', 'reviewing'] },
    }).sort({ createdAt: -1 });

    if (!panel) throw new AppError('No active panel for this flag');

    const alreadyRequested = panel.exclusionRequests.some((e) => e.requestedBy === alias);
    if (alreadyRequested) {
      throw new AppError('You have already submitted an exclusion request for this panel');
    }

    const { targetAlias, reason } = req.body;

    const isOnPanel = panel.acceptedModerators.some((m) => m.alias === targetAlias) ||
      panel.invitedModerators.some((m) => m.alias === targetAlias);
    if (!isOnPanel) throw new AppError('Target is not on this panel');

    panel.exclusionRequests.push({
      requestedBy: alias,
      targetAlias,
      reason,
      votes: [],
      resolved: false,
      outcome: 'pending',
    });
    await panel.save();

    res.status(201).json({ panel, message: 'Exclusion request submitted — panel members will vote' });
  },
);

/**
 * POST /flags/:id/exclude/:index/vote
 * Vote on an exclusion request. Only accepted panel members (not the target) can vote.
 */
router.post(
  '/:id/exclude/:index/vote',
  requireAuth,
  validate(exclusionVoteSchema),
  async (req: AuthRequest, res: Response) => {
    const flag = await Flag.findById(req.params.id);
    if (!flag) throw new NotFoundError('Flag');

    const alias = req.node!.alias;
    const exclusionIndex = parseInt(req.params.index as string, 10);

    const panel = await ModerationPanel.findOne({
      flagId: flag._id,
      status: { $in: ['awaiting_moderators', 'reviewing'] },
    }).sort({ createdAt: -1 });

    if (!panel) throw new AppError('No active panel for this flag');

    if (exclusionIndex >= panel.exclusionRequests.length) {
      throw new AppError('Invalid exclusion index');
    }

    const exclusion = panel.exclusionRequests[exclusionIndex];
    if (exclusion.resolved) throw new AppError('Exclusion request already resolved');

    const isAccepted = panel.acceptedModerators.some((m) => m.alias === alias);
    if (!isAccepted) throw new ForbiddenError('Only accepted panel members can vote');

    if (alias === exclusion.targetAlias) {
      throw new ForbiddenError('The excluded moderator cannot vote on their own exclusion');
    }

    const alreadyVoted = exclusion.votes.some((v) => v.alias === alias);
    if (alreadyVoted) throw new AppError('Already voted');

    const { approved } = req.body;
    exclusion.votes.push({ alias, approved });

    const eligibleVoters = panel.acceptedModerators.filter(
      (m) => m.alias !== exclusion.targetAlias,
    ).length;
    const approveCount = exclusion.votes.filter((v) => v.approved).length;
    const denyCount = exclusion.votes.filter((v) => !v.approved).length;
    const majority = Math.ceil(eligibleVoters / 2);

    if (approveCount >= majority) {
      exclusion.resolved = true;
      exclusion.outcome = 'approved';

      panel.acceptedModerators = panel.acceptedModerators.filter(
        (m) => m.alias !== exclusion.targetAlias,
      );
      panel.invitedModerators = panel.invitedModerators.filter(
        (m) => m.alias !== exclusion.targetAlias,
      );

      if (panel.acceptedModerators.length < panel.requiredModerators && panel.status === 'reviewing') {
        panel.status = 'awaiting_moderators';
      }
    } else if (denyCount > eligibleVoters - majority) {
      exclusion.resolved = true;
      exclusion.outcome = 'denied';
    }

    await panel.save();

    res.json({ panel, exclusion });
  },
);

/**
 * POST /flags/:id/rule
 * Issue a ruling on the flag. Only accepted panel members can rule.
 * The time lock must have expired.
 */
router.post(
  '/:id/rule',
  requireAuth,
  validate(rulingSchema),
  async (req: AuthRequest, res: Response) => {
    const flag = await Flag.findById(req.params.id);
    if (!flag) throw new NotFoundError('Flag');

    const alias = req.node!.alias;

    const panel = await ModerationPanel.findOne({
      flagId: flag._id,
      status: 'reviewing',
    }).sort({ createdAt: -1 });

    if (!panel) throw new AppError('No panel currently reviewing this flag');

    const isAccepted = panel.acceptedModerators.some((m) => m.alias === alias);
    if (!isAccepted) throw new ForbiddenError('Only accepted panel members can issue a ruling');

    if (panel.timeLockExpiry && new Date() < panel.timeLockExpiry) {
      throw new AppError('Time lock has not expired yet — review period still active');
    }

    const { decision, statement, actions } = req.body;

    panel.ruling = {
      decision,
      ruledBy: alias,
      statement,
      actions: actions || [],
      ruledAt: new Date(),
    };
    panel.status = 'ruled';
    await panel.save();

    flag.status = 'ruled';
    await flag.save();

    await recordFlagBlock(alias, {
      flagId: flag._id,
      action: 'ruling',
      decision,
      panelLevel: panel.panelLevel,
    });

    if (decision === 'uphold' || decision === 'partial') {
      for (const action of actions || []) {
        if (action === 'node_suspended') {
          if (flag.targetType === 'node') {
            await suspendNode(flag.targetId.toString());
          }
        }
        if (action === 'reputation_penalty') {
          const penalty = flag.flagCategory === 'governance'
            ? chainDefaults.moderatorBadFaithPenalty
            : chainDefaults.falseEmergencyFlagPenalty;
          if (flag.targetType === 'node') {
            const targetNode = await ChainNode.findById(flag.targetId).select('alias').lean();
            if (targetNode) {
              await applyReputationPenalty(targetNode.alias, penalty);
            }
          }
        }
        if (action === 'content_remove') {
          const { mediaIds } = await resolveFlagMedia(flag.targetType, flag.targetId);
          if (mediaIds.length > 0) await removeContent(mediaIds);
        }
        if (action === 'content_destroy_backup') {
          const { mediaIds } = await resolveFlagMedia(flag.targetType, flag.targetId, true);
          if (mediaIds.length > 0) await destroyBackup(mediaIds);
        }
        if (action === 'content_hide_in_space') {
          if (flag.spaceId) {
            const { mediaIds } = await resolveFlagMedia(flag.targetType, flag.targetId);
            if (mediaIds.length > 0) await hideInSpace(mediaIds, flag.spaceId);
          }
        }
      }
    }

    if (decision === 'dismiss') {
      if (flag.flagType === 'false_flagging' || flag.emergencyActionTaken) {
        await applyReputationPenalty(flag.raisedBy, chainDefaults.falseEmergencyFlagPenalty);
      }
      for (const action of actions || []) {
        if (action === 'content_restore') {
          const { mediaIds } = await resolveFlagMedia(flag.targetType, flag.targetId, true);
          if (mediaIds.length > 0) await restoreContent(mediaIds);
        }
      }
    }

    res.json({ flag, panel, message: 'Ruling issued' });
  },
);

/**
 * POST /flags/:id/appeal
 * Appeal a ruling. Within appealWindowDays of the ruling.
 * Max maxAppeals per flag. Second appeal requires newEvidence.
 */
router.post(
  '/:id/appeal',
  requireAuth,
  validate(appealSchema),
  async (req: AuthRequest, res: Response) => {
    const flag = await Flag.findById(req.params.id);
    if (!flag) throw new NotFoundError('Flag');

    if (flag.status !== 'ruled') {
      throw new AppError('Flag must be in ruled status to appeal');
    }

    if (flag.appealCount >= chainDefaults.maxAppeals) {
      flag.status = 'disputed_closed';
      await flag.save();
      throw new AppError('Maximum appeals exhausted — flag marked DISPUTED-CLOSED');
    }

    const latestPanel = await ModerationPanel.findOne({
      flagId: flag._id,
      status: 'ruled',
    }).sort({ createdAt: -1 });

    if (!latestPanel || !latestPanel.ruling) {
      throw new AppError('No ruling found to appeal');
    }

    const ruledAt = latestPanel.ruling.ruledAt;
    const appealDeadline = addHours(ruledAt, chainDefaults.appealWindowDays * 24);
    if (new Date() > appealDeadline) {
      flag.status = 'closed';
      await flag.save();
      throw new AppError('Appeal window has expired');
    }

    const alias = req.node!.alias;
    const { reason, newEvidence } = req.body;

    // Only parties involved in the flag can appeal
    // For dispute flags, check mediation parties too
    let isParty = flag.raisedBy === alias;
    if (!isParty && flag.mediationId) {
      const mediation = await Mediation.findById(flag.mediationId);
      if (mediation && mediation.parties.includes(alias)) {
        isParty = true;
      }
    }
    if (!isParty) {
      throw new ForbiddenError('Only parties involved in this flag can appeal');
    }

    if (flag.appealCount >= 1 && !newEvidence) {
      throw new AppError('Second appeal requires new evidence');
    }

    flag.appealCount += 1;
    flag.status = 'appealed';
    await flag.save();

    await recordFlagBlock(alias, {
      flagId: flag._id,
      action: 'appeal',
      appealNumber: flag.appealCount,
    });

    const appealComplexity = Math.min(flag.complexityLevel + 1, 4) as 1 | 2 | 3 | 4;

    const previousModAliases = latestPanel.acceptedModerators.map((m) => m.alias);
    const newPanel = await assignPanel(flag, flag.appealCount, appealComplexity, previousModAliases);

    res.status(201).json({ flag, panel: newPanel, message: `Appeal ${flag.appealCount} filed — new panel assigned` });
  },
);

/**
 * POST /flags/:id/slash
 * Report moderator bad faith. Only parties of the original flag can slash.
 * Requires evidence of bad faith.
 */
router.post(
  '/:id/slash',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const flag = await Flag.findById(req.params.id);
    if (!flag) throw new NotFoundError('Flag');

    const alias = req.node!.alias;
    const { evidence } = req.body;

    // Only parties of the original flag can raise a slash
    let isParty = flag.raisedBy === alias;
    if (!isParty && flag.mediationId) {
      const mediation = await Mediation.findById(flag.mediationId);
      if (mediation && mediation.parties.includes(alias)) {
        isParty = true;
      }
    }
    if (!isParty) {
      throw new ForbiddenError('Only parties involved in this flag can report moderator bad faith');
    }

    // Evidence is required for slash
    if (!evidence || typeof evidence !== 'string' || evidence.trim().length < 20) {
      throw new AppError('Evidence of bad faith is required (minimum 20 characters)');
    }

    // Flag must have been ruled before slashing
    if (flag.status !== 'ruled' && flag.status !== 'closed' && flag.status !== 'appealed') {
      throw new AppError('Can only report bad faith after a ruling has been issued');
    }

    const panels = await ModerationPanel.find({ flagId: flag._id });
    const allModAliases = new Set<string>();
    for (const p of panels) {
      for (const m of p.acceptedModerators) allModAliases.add(m.alias);
    }

    if (allModAliases.size === 0) {
      throw new AppError('No moderators found on this flag to report');
    }

    const blockIndex = await recordFlagBlock(alias, {
      flagCategory: 'governance',
      flagType: 'moderator_bad_faith',
      targetType: 'node',
      relatedFlagId: flag._id,
      evidence: evidence.trim(),
      action: 'slash_report',
    });

    const slashFlag = await Flag.create({
      flagCategory: 'governance',
      flagType: 'moderator_bad_faith',
      targetType: 'node',
      targetId: flag.targetId,
      raisedBy: alias,
      spaceId: flag.spaceId,
      isInsideMember: false,
      complexityLevel: 4,
      status: 'open',
      mediationId: null,
      reason: `Moderator bad faith reported on flag ${flag._id}: ${evidence.trim()}`,
      blockIndex,
      emergencyActionTaken: false,
      appealCount: 0,
    });

    await assignPanel(slashFlag, 0, 4, Array.from(allModAliases));

    res.status(201).json({
      slashFlag,
      message: 'Slashing flag created — separate panel assigned excluding original moderators',
    });
  },
);
/**
 * GET /flags/my-panels
 * List flags where the current node is an invited or accepted moderator.
 */
router.get(
  '/my-panels',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const alias = req.node!.alias;

    const panels = await ModerationPanel.find({
      $or: [
        { 'invitedModerators.alias': alias },
        { 'acceptedModerators.alias': alias },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();

    const flagIds = [...new Set(panels.map((p) => p.flagId.toString()))];
    const flags = await Flag.find({ _id: { $in: flagIds } }).lean();

    const flagMap = new Map(flags.map((f) => [f._id!.toString(), f]));

    const result = panels.map((p) => ({
      panel: p,
      flag: flagMap.get(p.flagId.toString()) || null,
    }));

    res.json(result);
  },
);

/**
 * GET /flags/target/:targetType/:targetId
 * List all flags on a specific target.
 */
router.get(
  '/target/:targetType/:targetId',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const targetType = req.params.targetType as string;
    const targetId = req.params.targetId as string;
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      throw new AppError('Invalid targetId');
    }
    const flags = await Flag.find({ targetType, targetId }).sort({ createdAt: -1 });
    res.json(flags);
  },
);

/**
 * GET /flags/:id
 * Get flag details with panels, filtered by anonymity level.
 */
router.get(
  '/:id',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const flag = await Flag.findById(req.params.id);
    if (!flag) throw new NotFoundError('Flag');

    const alias = req.node!.alias;
    const panels = await ModerationPanel.find({ flagId: flag._id }).sort({ panelLevel: 1 }).lean();

    const isRuled = flag.status === 'ruled' || flag.status === 'closed' || flag.status === 'disputed_closed';

    const filteredPanels = panels.map((p) =>
      filterPanelForCaller(p as unknown as Record<string, unknown>, flag.complexityLevel, alias, flag.raisedBy, isRuled),
    );

    const flagObj = flag.toObject();
    if (flag.complexityLevel === 3 && !isRuled) {
      const isMod = panels.some((p) =>
        (p.acceptedModerators as { alias: string }[]).some((m) => m.alias === alias),
      );
      if (isMod) {
        flagObj.raisedBy = 'anonymous';
      }
    }

    res.json({ flag: flagObj, panels: filteredPanels });
  },
);

export default router;
