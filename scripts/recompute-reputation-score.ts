/**
 * Recompute derived reputationScore for all nodes from reputationCategories.
 *
 * Use after changing the aggregate rule so existing DB rows are consistent.
 *
 *   npx tsx scripts/recompute-reputation-score.ts
 *   npx tsx scripts/recompute-reputation-score.ts --apply
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDatabase } from '../src/config/database'
import { ChainNode } from '../src/models/Node'
import { reputationScoreFromCategories } from '../src/utils/reputationAggregate'

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  await connectDatabase()

  const cursor = ChainNode.find({}).select('_id alias reputationScore reputationCategories').cursor()
  let scanned = 0
  let wouldChange = 0
  let changed = 0

  for await (const n of cursor) {
    scanned++
    const derived = reputationScoreFromCategories(n.reputationCategories as any)
    if (n.reputationScore !== derived) {
      wouldChange++
      if (apply) {
        await ChainNode.updateOne({ _id: n._id }, { $set: { reputationScore: derived } })
        changed++
      }
    }
  }

  console.log(`[recompute] scanned=${scanned} wouldChange=${wouldChange} apply=${apply} changed=${changed}`)
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

