/**
 * One-off migration endpoint: POST /api/admin/migrate-interests
 * Adds 3 sample interests to all accounts with no interests
 * 
 * Use this to run the migration on production without shell access
 */
import { Router, Response } from 'express'
import { AuthRequest } from '../types'
import { ChainNode } from '../models/Node'

const router = Router()

const SAMPLE_INTERESTS = ['Open source', 'Systems design', 'Teaching / pedagogy']

/**
 * POST /api/admin/migrate-interests
 * Authorization: Bearer token with admin privileges (optional security)
 */
router.post('/migrate-interests', async (req: AuthRequest, res: Response) => {
  try {
    // Optional: Check for a migration key (add to .env: MIGRATION_KEY=your-secret-key)
    const migrationKey = req.headers['x-migration-key']
    const expectedKey = process.env.MIGRATION_KEY
    
    if (expectedKey && migrationKey !== expectedKey) {
      return res.status(401).json({ error: 'Unauthorized: Invalid migration key' })
    }

    console.log('[Migration] Starting interests migration...')

    // Find all active nodes with empty interests
    const nodes = await ChainNode.find({
      status: 'active',
      $or: [{ interests: { $exists: false } }, { interests: { $eq: [] } }],
    })

    console.log(`[Migration] Found ${nodes.length} accounts with no interests`)

    let updated = 0
    for (const node of nodes) {
      node.interests = SAMPLE_INTERESTS
      await node.save()
      updated++
      if (updated % 100 === 0) console.log(`[Migration] ...${updated}`)
    }

    console.log(`[Migration] ✓ Updated ${updated} accounts`)

    res.json({
      success: true,
      message: `Updated ${updated} accounts with sample interests`,
      interestsAdded: SAMPLE_INTERESTS,
    })
  } catch (err) {
    console.error('[Migration] Error:', err)
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Migration failed',
    })
  }
})

export default router
