/**
 * Clean up automated E2E test accounts from the local DB.
 *
 * Strategy: delete every ChainNode created in the 2026-03-19 .. 2026-03-22
 * window (the three-day test binge). Sample inspection shows every alias in
 * that window matches a known fixture prefix (testa_, testb_, usera_..c_,
 * trustee1/2_, outsider_, out_, pout_, forkout_, vout_, revoke_, gov0..29_,
 * csa..h_). No legitimate account was registered in that window.
 *
 * Usage:
 *   npx tsx scripts/cleanup-test-nodes.ts            # dry run
 *   npx tsx scripts/cleanup-test-nodes.ts --apply    # actually delete
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { ChainNode } from '../src/models/Node'
import { Trace } from '../src/models/Trace'
import { Project } from '../src/models/Project'
import { Space } from '../src/models/Space'
import { NFT } from '../src/models/NFT'

const WINDOW_START = new Date('2026-03-19T00:00:00Z')
const WINDOW_END = new Date('2026-03-22T00:00:00Z')
const APPLY = process.argv.includes('--apply')

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/aura2'
  await mongoose.connect(uri)

  const filter = { createdAt: { $gte: WINDOW_START, $lt: WINDOW_END } }
  const victims = await ChainNode.find(filter).select('alias').lean()
  const aliases = victims.map((v) => v.alias)

  const tracesByAuthor = await Trace.countDocuments({ nodeAlias: { $in: aliases } })
  const projectsByCreator = await Project.countDocuments({ creatorAlias: { $in: aliases } })
  const spacesByCreator = await Space.countDocuments({ creatorAlias: { $in: aliases } })
  const projectsAsContrib = await Project.countDocuments({
    creatorAlias: { $nin: aliases },
    'contributors.alias': { $in: aliases },
  })
  const nftsByProject = projectsByCreator
    ? await NFT.countDocuments({
        projectId: {
          $in: (
            await Project.find({ creatorAlias: { $in: aliases } }).select('_id').lean()
          ).map((p) => p._id),
        },
      })
    : 0

  console.log('=== dry run ===')
  console.log('window:', WINDOW_START.toISOString(), '..', WINDOW_END.toISOString())
  console.log('matching nodes:                      ', victims.length)
  console.log('traces authored by those accounts:   ', tracesByAuthor)
  console.log('projects created by those accounts:  ', projectsByCreator)
  console.log('NFTs on those projects:              ', nftsByProject)
  console.log('spaces created by those accounts:    ', spacesByCreator)
  console.log('projects where they are contributors:', projectsAsContrib)

  if (!APPLY) {
    console.log()
    console.log('→ pass --apply to run the deletes.')
    console.log('→ projects/NFTs they only CONTRIBUTED to will be left untouched.')
    await mongoose.disconnect()
    return
  }

  console.log('\n=== applying deletes ===')

  const createdProjects = await Project.find({ creatorAlias: { $in: aliases } }).select('_id').lean()
  const createdProjectIds = createdProjects.map((p) => p._id)

  const delTracesByAuthor = await Trace.deleteMany({ nodeAlias: { $in: aliases } })
  console.log('deleted traces authored by them:         ', delTracesByAuthor.deletedCount)

  if (createdProjectIds.length) {
    const delTracesOnProjects = await Trace.deleteMany({ projectId: { $in: createdProjectIds } })
    console.log('deleted traces on their projects:        ', delTracesOnProjects.deletedCount)
    const delNfts = await NFT.deleteMany({ projectId: { $in: createdProjectIds } })
    console.log('deleted NFTs on their projects:          ', delNfts.deletedCount)
  }
  const delProjects = await Project.deleteMany({ creatorAlias: { $in: aliases } })
  console.log('deleted projects:                        ', delProjects.deletedCount)

  const delSpaces = await Space.deleteMany({ creatorAlias: { $in: aliases } })
  console.log('deleted spaces:                          ', delSpaces.deletedCount)

  const delNodes = await ChainNode.deleteMany(filter)
  console.log('deleted nodes:                           ', delNodes.deletedCount)

  const remainingActive = await ChainNode.countDocuments({ status: 'active' })
  const remainingTotal = await ChainNode.countDocuments({})
  console.log('\nremaining nodes (active / total):', remainingActive, '/', remainingTotal)

  await mongoose.disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
