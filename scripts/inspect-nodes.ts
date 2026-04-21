/**
 * One-off diagnostic: how many nodes are in the DB, and what do they look like?
 * Run with:  npx tsx scripts/inspect-nodes.ts
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { ChainNode } from '../src/models/Node'

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/aura2'
  await mongoose.connect(uri)

  const total = await ChainNode.countDocuments({})
  const active = await ChainNode.countDocuments({ status: 'active' })
  const frozen = await ChainNode.countDocuments({ status: 'frozen' })
  const zero = await ChainNode.countDocuments({ reputationScore: 0 })
  const never = await ChainNode.countDocuments({ lastActiveAt: { $exists: false } })

  // Sample the oldest 5 and newest 5
  const oldest = await ChainNode.find({}, { alias: 1, createdAt: 1, reputationScore: 1, lastActiveAt: 1 })
    .sort({ createdAt: 1 })
    .limit(5)
    .lean()

  const newest = await ChainNode.find({}, { alias: 1, createdAt: 1, reputationScore: 1, lastActiveAt: 1 })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean()

  // Bucket by createdAt day, top 10 busiest days
  const byDay = await ChainNode.aggregate([
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ])

  console.log('=== Node counts ===')
  console.log('total:            ', total)
  console.log('active:           ', active)
  console.log('frozen:           ', frozen)
  console.log('reputationScore=0:', zero)
  console.log('no lastActiveAt:  ', never)
  console.log()
  console.log('=== 5 oldest ===')
  oldest.forEach((n) => console.log(n.createdAt?.toISOString?.(), n.alias, 'rep=' + n.reputationScore))
  console.log()
  console.log('=== 5 newest ===')
  newest.forEach((n) => console.log(n.createdAt?.toISOString?.(), n.alias, 'rep=' + n.reputationScore))
  console.log()
  console.log('=== top 10 registration days ===')
  byDay.forEach((b) => console.log(b._id, b.count))

  await mongoose.disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
