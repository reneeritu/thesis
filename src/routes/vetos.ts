import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createVetoSchema, signVetoSchema } from '../schemas/veto';
import { Veto } from '../models/Veto';
import { Project } from '../models/Project';
import { Space } from '../models/Space';
import { addBlock } from '../services/chain';
import { sha256 } from '../utils/hash';
import { AuthRequest } from '../types';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors';

const router = Router();

/**
 * POST /vetos
 * VETO contract — stops or limits something on a project.
 *
 * hard_stop: requires majority sign-off from contributors OR preassigned
 *            veto authority (e.g. teacher). Starts as "pending" until
 *            enough signatures are collected, unless issuer has veto authority.
 * scope_limit / content_flag: takes effect immediately from any contributor.
 * nda_seal: encrypts targeted trace logs; takes effect immediately.
 *
 * TODO: scope_limit, content_flag, and nda_seal vetos are recorded but have
 * no enforcement effect yet. scope_limit should restrict trace activity types,
 * content_flag should hide/flag targeted traces from public view, and nda_seal
 * should encrypt targeted trace log content. Build enforcement when the
 * content visibility and encryption layers are implemented.
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

    if (status === 'active' && vetoType === 'hard_stop') {
      project.status = 'halted';
      await project.save();
    }

    res.status(201).json(veto);
  },
);

/**
 * POST /vetos/:id/sign
 * Sign a pending hard_stop veto. Once majority of contributors sign,
 * the veto activates and the project is stopped.
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

      // TODO: With 2 contributors, majority = 1, so the initial poster's signature
      // alone activates the veto instantly (same as having veto authority). Consider
      // whether 2-person projects should require both contributors for hard_stop.
      const majority = Math.ceil(project.contributors.length / 2);
      if (veto.signatures.length >= majority) {
        veto.status = 'active';
        project.status = 'halted';
        await project.save();
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
