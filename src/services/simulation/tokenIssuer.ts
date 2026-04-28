import { ChainNode } from '../../models/Node';
import { signToken } from '../auth';
import { AppError, NotFoundError } from '../../utils/errors';

/**
 * Issue a JWT for a sim alias bypassing rate limits.
 * Alias must start with 'sim_'.
 * Node must already exist (created by /auth/register elsewhere).
 */
export async function issueTokenForAlias(alias: string): Promise<string> {
  const lower = alias.toLowerCase();
  if (!lower.startsWith('sim_')) {
    throw new AppError('Token issuer only mints tokens for sim_* aliases');
  }
  const node = await ChainNode.findOne({ alias: lower });
  if (!node) throw new NotFoundError(`ChainNode for alias ${lower}`);
  if (node.status !== 'active') throw new AppError('Sim node is not active');
  return signToken({
    alias: node.alias,
    nodeId: node._id.toString(),
    tokenVersion: node.tokenVersion,
  });
}
