import { Project } from '../models/Project';
import { Space } from '../models/Space';
import { AuthRequest } from '../types';
import { NotFoundError, ForbiddenError } from './errors';

type ContributorsLike = { alias: string; accepted?: boolean | null }[];

export type ProjectProcessLogScope = 'full' | 'summary';

/**
 * Who may read the trace / reference / pivot / veto timeline.
 * - fully_public + process_visible → anyone
 * - space_only → space members & accepted contributors only (else summary project only)
 */
export function getProjectProcessLogScope(
  project: { visibility: string; contributors: ContributorsLike },
  space: { members: string[] } | null | undefined,
  req: AuthRequest,
): ProjectProcessLogScope {
  if (!space) return 'summary';
  const caller = req.node?.alias;
  const isMember = caller ? space.members.includes(caller) : false;
  const isContributor = caller
    ? project.contributors.some((c) => c.alias === caller && c.accepted !== false)
    : false;

  if (project.visibility === 'fully_public' || project.visibility === 'process_visible') {
    return 'full';
  }
  if (caller && (isMember || isContributor)) {
    return 'full';
  }
  return 'summary';
}

/** Trace strips & batch visibility — same as full process log */
export function optionalViewerMayReadProject(
  project: { visibility: string; contributors: ContributorsLike },
  space: { members: string[] } | null | undefined,
  req: AuthRequest,
): boolean {
  return getProjectProcessLogScope(project, space, req) === 'full';
}

export async function loadProjectWithSpace(
  projectId: string | string[],
): Promise<{ project: InstanceType<typeof Project>; space: InstanceType<typeof Space> }> {
  const id = (Array.isArray(projectId) ? projectId[0] : projectId) as string;
  const project = await Project.findById(id);
  if (!project) throw new NotFoundError('Project');
  const space = await Space.findById(project.spaceId);
  if (!space) throw new NotFoundError('Space');
  return { project, space };
}

/** Minimal project payload when process log is members-only */
export function toPublicSummaryProject(project: InstanceType<typeof Project>): Record<string, unknown> {
  const o = project.toObject();
  return {
    _id: String(project._id),
    title: o.title,
    status: o.status,
    spaceId: String(project.spaceId),
    visibility: o.visibility,
    creatorAlias: o.creatorAlias,
    mentorAlias: o.mentorAlias ?? '',
    contributors: (o.contributors ?? []).map((c: { alias: string; role?: string }) => ({
      alias: c.alias,
      role: c.role ?? 'contributor',
    })),
    logoSeed: o.logoSeed,
    updatedAt: o.updatedAt,
    createdAt: o.createdAt,
    publicProcessLogRestricted: true,
  };
}

export async function assertFullProcessLogReadable(
  projectId: string | string[],
  req: AuthRequest,
): Promise<InstanceType<typeof Project>> {
  const { project, space } = await loadProjectWithSpace(projectId);
  if (getProjectProcessLogScope(project, space, req) !== 'full') {
    throw new ForbiddenError(
      project.visibility === 'space_only'
        ? 'The process log for this project is visible to space members only.'
        : 'You cannot view this content',
    );
  }
  return project;
}

/** GET /projects/:id — full Mongoose doc or summary object */
export async function getProjectPayloadForViewer(
  projectId: string,
  req: AuthRequest,
): Promise<Record<string, unknown> | InstanceType<typeof Project>> {
  const { project, space } = await loadProjectWithSpace(projectId);
  const scope = getProjectProcessLogScope(project, space, req);
  if (scope === 'full') {
    return project;
  }
  return toPublicSummaryProject(project);
}
