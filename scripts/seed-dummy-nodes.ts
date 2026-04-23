/**
 * Seed dummy nodes directly in MongoDB (plus identity blocks) and set varied reputation.
 *
 * Why not just insert docs?
 * - `ChainNode.identityBlockIndex` is required and should correspond to a real chain block.
 * - Passwords must be hashed; seed phrases must be encrypted (needs ENCRYPTION_KEY).
 *
 * Usage (repo root):
 *   npx tsx scripts/seed-dummy-nodes.ts          # dry-run: prints only; no chain blocks, no nodes
 *   npx tsx scripts/seed-dummy-nodes.ts --apply  # writes identity blocks + ChainNode docs
 *
 * Options:
 *   --count=10           number of accounts
 *   --prefix=dummy       alias prefix (dummy_001, dummy_002...)
 *   --password=...       password for all seeded accounts
 *
 * Output:
 *   - Prints a summary to stdout
 *   - Writes credentials JSON to scripts/dev-seeded-accounts.json (apply only)
 */

import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import mongoose from 'mongoose'
import { connectDatabase } from '../src/config/database'
import { chainDefaults } from '../src/config/defaults'
import { ChainNode, type IReputationCategories } from '../src/models/Node'
import { ensureGenesis, addBlock } from '../src/services/chain'
import { encryptSeedPhrase, generateSeedPhrase, hashPassword, hashSeed } from '../src/services/auth'
import { reputationScoreFromCategories } from '../src/utils/reputationAggregate'

type SeededAccount = {
  alias: string
  password: string
  seedPhrase: string
  reputationScore: number
  reputationCategories: IReputationCategories
}

function parseArg(key: string): string | null {
  const prefix = `--${key}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  if (!hit) return null
  return hit.slice(prefix.length)
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function repForIndex(i: number): IReputationCategories {
  // Deliberately varied across categories so the mandala shows different recursion depths.
  // Cap at chainDefaults.reputationCap (1000).
  const rng = mulberry32(0xdecafbad + i * 9973)
  const bump = (base: number, spread: number) => clamp(Math.round(base + (rng() - 0.5) * spread), 0, chainDefaults.reputationCap)

  return {
    craft: bump(900 - i * 40, 180),
    research: bump(650 + i * 15, 220),
    collaboration: bump(520 - i * 10, 220),
    pedagogy: bump(280 + i * 8, 160),
    consistency: bump(120 + i * 18, 140),
    community: bump(820 - i * 20, 200),
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const count = clamp(Number.parseInt(parseArg('count') ?? '10', 10) || 10, 1, 250)
  const prefix = (parseArg('prefix') ?? 'dummy').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_')
  const password = parseArg('password') ?? 'DummyPass1!'

  console.log(`[seed] target count=${count} prefix=${prefix}_### apply=${apply}`)

  await connectDatabase()
  await ensureGenesis()

  const out: SeededAccount[] = []

  try {
    for (let i = 1; i <= count; i++) {
      const alias = `${prefix}_${String(i).padStart(3, '0')}`

      const exists = await ChainNode.exists({ alias })
      if (exists) {
        console.log(`[seed] skip (exists): ${alias}`)
        continue
      }

      const reputationCategories = repForIndex(i)
      const derivedScore = reputationScoreFromCategories(reputationCategories)

      // Dry-run must not call addBlock — that would append real chain rows without nodes.
      if (!apply) {
        console.log(
          `[seed] dry-run: would create ${alias} derivedRepScore=${derivedScore} (no DB/chain writes; use --apply)`,
        )
        continue
      }

      const seedPhrase = generateSeedPhrase()
      const hashedPassword = await hashPassword(password)
      const seedHash = hashSeed(seedPhrase)
      const encryptedSeedPhrase = encryptSeedPhrase(seedPhrase)

      const identityBlock = await addBlock('identity', alias, {
        alias,
        encryptedSeedPhrase,
        seeded: true,
        seededAt: new Date().toISOString(),
      })

      await ChainNode.create({
        alias,
        hashedPassword,
        seedHash,
        encryptedSeedPhrase,
        identityBlockIndex: identityBlock.index,
        reputationCategories,
        // reputationScore is set on save from categories (Node pre-save hook).
      })

      console.log(
        `[seed] created: ${alias} blockIndex=${identityBlock.index} derivedRepScore=${reputationScoreFromCategories(reputationCategories)}`,
      )
      out.push({
        alias,
        password,
        seedPhrase,
        reputationScore: reputationScoreFromCategories(reputationCategories),
        reputationCategories,
      })
    }

    if (apply) {
      const fp = path.resolve(process.cwd(), 'scripts', 'dev-seeded-accounts.json')
      fs.writeFileSync(
        fp,
        JSON.stringify({ createdAt: new Date().toISOString(), accounts: out }, null, 2),
        'utf8',
      )
      console.log(`[seed] wrote credentials: ${fp}`)
      console.log('[seed] NOTE: file is gitignored; do not share it.')
    } else {
      console.log('\n[seed] Dry run only. Re-run with --apply to write to MongoDB.')
    }
  } finally {
    await mongoose.disconnect()
  }
}

main().catch((err) => {
  console.error('[seed] failed:', err)
  process.exit(1)
})

