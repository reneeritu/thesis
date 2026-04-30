/**
 * One-time migration: Add 3 sample interests to all existing accounts.
 * Run: npx ts-node scripts/addInterestsSample.ts
 * 
 * After running this script, do NOT auto-add interests for new users.
 */
import mongoose from 'mongoose'
import { ChainNode } from '../src/models/Node'
import dotenv from 'dotenv'

dotenv.config()

const SAMPLE_INTERESTS = ['Open source', 'Systems design', 'Teaching / pedagogy']

async function migrate() {
  try {
    // Use MONGODB_URI from .env (matches your existing config)
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || ''
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI not set in environment')
    }
    
    await mongoose.connect(mongoUri)
    console.log('✓ Connected to MongoDB')

    // Find all active nodes with empty interests
    const nodes = await ChainNode.find({
      status: 'active',
      $or: [{ interests: { $exists: false } }, { interests: { $eq: [] } }],
    })

    console.log(`Found ${nodes.length} accounts with no interests`)

    let updated = 0
    for (const node of nodes) {
      node.interests = SAMPLE_INTERESTS
      await node.save()
      updated++
      if (updated % 10 === 0) console.log(`...${updated}`)
    }

    console.log(`✓ Updated ${updated} accounts with sample interests`)
    console.log(`  Added: ${SAMPLE_INTERESTS.join(', ')}`)
  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    process.exit(0)
  }
}

migrate()
