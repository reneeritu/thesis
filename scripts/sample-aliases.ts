import 'dotenv/config'
import mongoose from 'mongoose'
import { ChainNode } from '../src/models/Node'

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aura2')

  const march = await ChainNode.find({
    createdAt: { $gte: new Date('2026-03-19'), $lt: new Date('2026-03-22') },
  })
    .select('alias createdAt reputationScore')
    .sort({ createdAt: 1 })
    .lean()

  console.log('Total March 19-21 registrations:', march.length)

  // Count by common prefix (first underscore split, or first 5 chars)
  const byPrefix: Record<string, number> = {}
  for (const n of march) {
    const p =
      n.alias.includes('_') ? n.alias.slice(0, n.alias.indexOf('_') + 1) :
      n.alias.slice(0, 5)
    byPrefix[p] = (byPrefix[p] || 0) + 1
  }
  const sorted = Object.entries(byPrefix).sort((a, b) => b[1] - a[1])
  console.log('\n=== alias prefix buckets ===')
  for (const [p, c] of sorted.slice(0, 30)) console.log(c.toString().padStart(4), p)

  console.log('\n=== first 30 aliases, first 30 last ===')
  march.slice(0, 30).forEach((n) => console.log(n.createdAt?.toISOString?.(), n.alias))
  console.log('---')
  march.slice(-30).forEach((n) => console.log(n.createdAt?.toISOString?.(), n.alias))

  await mongoose.disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
