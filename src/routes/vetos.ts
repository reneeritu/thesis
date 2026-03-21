import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createVetoSchema, signVetoSchema } from '../schemas/veto';
import { Veto } from '../models/Veto';
import { Trace } from '../models/Trace';
import { Project } from '../models/Project';
import { Space } from '../models/Space';
import { addBlock } from '../services/chain';
import { sha256 } from '../utils/hash';
import { AuthRequest } from '../types';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors';

const router = Router();

/**
 * Apply enforcement side effects for a veto based on its type.
 * Called when a veto becomes active.
 */
async function enforceVeto(
  vetoType: string,
  targetTraceIds: string[],
  projectId: string,
): Promise<void> {
  if (vetoType === 'scope_limit') {
    // Mark targeted traces as scope-limited (flagged for visibility)
    if (targetTraceIds.length > 0) {
      await Trace.updateMany(
        { _id: { $in: targetTraceIds } },
        { $set: { scopeLimited: true } },
      );
    }
  }

  if (vetoType === 'content_flag') {
    // Hide targeted traces from public view
    if (targetTraceIds.length > 0) {
      await Trace.updateMany(
        { _id: { $in: targetTraceIds } },
        { $set: { contentFlagged: true } },
      );
    }
  }

  if (vetoType === 'nda_seal') {
    // Mark targeted traces as NDA sealed
    // Content encryption happens at the media/serving layer
    // Hash stays on chain; content marked as sealed in DB
    if (targetTraceIds.length > 0) {
      await Trace.updateMany(
        { _id: { $in: targetTraceIds } },
        { $set: { ndaSealed: true } },
      );
    } else {
      // If no specific traces targeted, seal all traces on the project
      await Trace.updateMany(
        { projectId },
        { $set: { ndaSealed: true } },
      );
    }
  }
}

/**
 * POST /vetos
 */
router.post(
  '/',
  requireAuth,
  validate(createVetoSchema),
  async (req: AuthRequest, res: Response) => {
    const { projectId, vetoType, reason, targetTraceIds } = req.body;
    const alias = req.node!.alias;

    const project = await Project.findById(projectId);
    if (!project) throw new NotFoundError('Project');
    if (project.status !== 'active') throw new AppError('Project is not active');

    const isContributor = project.contributors.some((c) => c.alias === alias);
    if (!isContributor) {
      throw new ForbiddenError('You are not a contributor on this project');
    }

    const reasonHash = sha256(reason);

    const block = await addBlock('veto', alias, {
      projectId,
      vetoType,
      reasonHash,
      targetTraceIds: targetTraceIds || [],
    });

    const space = await Space.findById(project.spaceId);
    const hasVetoAuthority = space?.settings.vetoAuthority.includes(alias) ?? false;

    let status: 'pending' | 'active' = 'pending';

    if (vetoType === 'hard_stop') {
      if (hasVetoAuthority) {
        status = 'active';
      }
    } else {
      // scope_limit, content_flag, nda_seal activate immediately
      status = 'active';
    }

    const veto = await Veto.create({
      projectId,
      nodeAlias: alias,
      vetoType,
      reasonHash,
      targetTraceIds: targetTraceIds || [],
      signatures: [{ alias, signedAt: new Date() }],
      status,
      blockIndex: block.index,
    });

    // Apply enforcement when veto is immediately active
    if (status === 'active') {
      if (vetoType === 'hard_stop') {
        project.status = 'halted';
        await project.save();
      } else {
        await enforceVeto(vetoType, targetTraceIds || [], projectId);
      }
    }

    res.status(201).json(veto);
  },
);

/**
 * POST /vetos/:id/sign
 */
router.post(
  '/:id/sign',
  requireAuth,
  validate(signVetoSchema),
  async (req: AuthRequest, res: Response) => {
    const veto = await Veto.findById(req.params.id);
    if (!veto) throw new NotFoundError('Veto');
    if (veto.status !== 'pending') throw new AppError('Veto is not pending');

    const alias = req.node!.alias;
    const project = await Project.findById(veto.projectId);
    if (!project) throw new NotFoundError('Project');

    const isContributor = project.contributors.some((c) => c.alias === alias);
    if (!isContributor) throw new ForbiddenError('Not a contributor');

    if (veto.signatures.some((s) => s.alias === alias)) {
      throw new AppError('Already signed');
    }

    const { approved } = req.body;

    if (approved) {
      veto.signatures.push({ alias, signedAt: new Date() });

      // Require at least 2 signatures for hard_stop regardless of contributor count
      const majority = Math.max(2, Math.ceil(project.contributors.length / 2));
      if (veto.signatures.length >= majority) {
        veto.status = 'active';
        project.status = 'halted';
        await project.save();

        // Apply enforcement after activation
        await enforceVeto(
          veto.vetoType,
          veto.targetTraceIds.map((id) => id.toString()),
          veto.projectId.toString(),
        );
      }
    }

    await veto.save();
    res.json(veto);
  },
);

/**
 * GET /vetos/project/:projectId
 */
router.get(
  '/project/:projectId',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const vetos = await Veto.find({ projectId: req.params.projectId }).sort({
      createdAt: -1,
    });
    res.json(vetos);
  },
);

export default router;