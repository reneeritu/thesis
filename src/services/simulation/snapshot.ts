import mongoose from 'mongoose';
import { Block } from '../../models/Block';
import { Trace } from '../../models/Trace';
import { Flag } from '../../models/Flag';
import { Mediation } from '../../models/Mediation';
import { NFT } from '../../models/NFT';
import { GovernanceProposal } from '../../models/GovernanceProposal';
import { RunState, snapshot as buildSnapshot } from './store';
import { SimulationCounters, SimulationSnapshot } from './types';

function projectObjectIds(ids: string[]): mongoose.Types.ObjectId[] {
  return ids
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
}

export async function recomputeCounters(state: RunState): Promise<SimulationCounters> {
  const projectObjectIdsArr = projectObjectIds(state.projectIds);

  const [tracesCount, flagsCount, mediationsResolved, nftsMinted, govPassed, blocksCount] =
    await Promise.all([
      projectObjectIdsArr.length
        ? Trace.countDocuments({ projectId: { $in: projectObjectIdsArr } })
        : Promise.resolve(0),
      projectObjectIdsArr.length
        ? Flag.countDocuments({ targetType: 'project', targetId: { $in: projectObjectIdsArr } }).catch(
            () => 0,
          )
        : Promise.resolve(0),
      projectObjectIdsArr.length
        ? Mediation.countDocuments({
            status: 'resolved',
            projectId: { $in: projectObjectIdsArr },
          }).catch(() => 0)
        : Promise.resolve(0),
      projectObjectIdsArr.length
        ? NFT.countDocuments({ projectId: { $in: projectObjectIdsArr } }).catch(() => 0)
        : Promise.resolve(0),
      GovernanceProposal.countDocuments({
        status: { $in: ['passed', 'rejected', 'failed_quorum'] },
      }).catch(() => 0),
      Block.countDocuments({ 'data.simRunId': state.simRunId }).catch(() => 0),
    ]);

  return {
    blocksWritten: blocksCount,
    tracesLogged: tracesCount,
    flagsFiled: flagsCount,
    mediationsResolved,
    nftsMinted,
    governancePassed: govPassed,
  };
}

export async function buildLiveSnapshot(state: RunState): Promise<SimulationSnapshot> {
  try {
    state.counters = await recomputeCounters(state);
  } catch {
    /* keep last-known counters */
  }
  state.updatedAt = new Date().toISOString();
  return buildSnapshot(state);
}
