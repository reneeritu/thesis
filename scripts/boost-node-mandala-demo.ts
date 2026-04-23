/**
 * Set demo reputation categories + score on an existing node (for mandala preview).
 *
 *   npx tsx scripts/boost-node-mandala-demo.ts <alias>
 *   npx tsx scripts/boost-node-mandala-demo.ts <alias> --apply
 *
 * Without --apply, prints what would change. Uses repo root .env for MONGODB_URI.
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { ChainNode } from '../src/models/Node'
import { chainDefaults } from '../src/config/defaults'

const DEMO = {
  craft: 940,
  research: 720,
  collaboration: 520,
  pedagogy: 280,
  consistency: 120,
  community: 900,
} as const

function aggregateScore(): number {
  const sum = Object.values(DEMO).reduce((a, b) => a + b, 0)
  return Math.min(
    chainDefaults.reputationCap,
    Math.max(chainDefaults.reputationFloor, Math.round(sum / 6)),
  )
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--apply')
  const apply = process.argv.includes('--apply')
  const alias = args[0]?.trim().toLowerCase()
  if (!alias) {
    console.error('Usage: npx tsx scripts/boost-node-mandala-demo.ts <alias> [--apply]')
    process.exit(1)
  }

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/aura2'
  await mongoose.connect(uri)

  const node = await ChainNode.findOne({ alias }).select('alias reputationScore reputationCategories')
  if (!node) {
    console.error(`No node with alias "${alias}".`)
    process.exit(1)
  }

  console.log('Current:', {
    alias: node.alias,
    reputationScore: node.reputationScore,
    reputationCategories: node.reputationCategories,
  })
  console.log('Would set:', { reputationCategories: DEMO, reputationScore: aggregateScore() })

  if (!apply) {
    console.log('\n→ Pass --apply to write.')
    await mongoose.disconnect()
    return
  }

  await ChainNode.updateOne(
    { alias },
    {
      $set: {
        reputationCategories: { ...DEMO },
        reputationScore: aggregateScore(),
      },
    },
  )
  console.log('Updated.')
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
