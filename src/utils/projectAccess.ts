import { Project } from '../models/Project';
import { Space } from '../models/Space';
import { AuthRequest } from '../types';
import { NotFoundError, ForbiddenError } from './errors';

/**
 * Ensures the caller (or anonymous viewer) may read the project per visibility + space membership.
 * Used by GET handlers for project detail, traces, references, pivots, vetos, etc.
 */
export async function assertProjectReadableForOptionalViewer(
  projectId: string | string[],
  req: AuthRequest,
): Promise<InstanceType<typeof Project>> {
  const id = (Array.isArray(projectId) ? projectId[0] : projectId) as string;
  const project = await Project.findById(id);
  if (!project) throw new NotFoundError('Project');
  const space = await Space.findById(project.spaceId);
  if (!space) throw new NotFoundError('Space');

  const caller = req.node?.alias;
  const isMember = caller ? space.members.includes(caller) : false;
  const isContributor = caller
    ? project.contributors.some((c) => c.alias === caller && c.accepted !== false)
    : false;

  const visibilityOk =
    project.visibility === 'fully_public' || project.visibility === 'process_visible';

  if (project.visibility === 'space_only') {
    if (!caller || (!isMember && !isContributor)) {
      throw new ForbiddenError('Sign in as a space member to view this project');
    }
  } else if (!visibilityOk && !isMember && !isContributor) {
    throw new ForbiddenError('You cannot view this project');
  }

  return project;
}
