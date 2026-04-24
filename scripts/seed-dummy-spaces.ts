/**
 * Seed dummy spaces (S1–S4), projects, ~90 traces, references, pivots, a veto, and
 * align dummy_001–010 reputationCategories + spaces membership.
 *
 * Usage (repo root):
 *   npx tsx scripts/seed-dummy-spaces.ts           # dry-run
 *   npx tsx scripts/seed-dummy-spaces.ts --apply    # writes DB + chain
 *   npx tsx scripts/seed-dummy-spaces.ts --apply --reset
 *
 * Requires dummy nodes (see seed-dummy-nodes.ts --apply) and MONGO_URI / chain.
 */

import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDatabase } from '../src/config/database'
import { ensureGenesis, addBlock } from '../src/services/chain'
import { Space } from '../src/models/Space'
import { Project, type IContributor } from '../src/models/Project'
import { Trace, type ActivityType, type LogMode } from '../src/models/Trace'
import { Reference } from '../src/models/Reference'
import { Pivot } from '../src/models/Pivot'
import { Veto } from '../src/models/Veto'
import { ChainNode, type IReputationCategories } from '../src/models/Node'
import { sha256 } from '../src/utils/hash'
import { reputationScoreFromCategories } from '../src/utils/reputationAggregate'

const DUMMY_ALIASES = Array.from({ length: 10 }, (_, i) => `dummy_${String(i + 1).padStart(3, '0')}`)

const SPACE_SPECS = [
  {
    key: 's1',
    name: 'Open Materials Lab',
    description: 'Hands-on material research and fabrication.',
    creatorAlias: 'dummy_001',
    admins: ['dummy_001'],
    members: ['dummy_001', 'dummy_002', 'dummy_003', 'dummy_004', 'dummy_005'],
  },
  {
    key: 's2',
    name: 'Research Commons',
    description: 'Literature, sensing, and open hardware pedagogy.',
    creatorAlias: 'dummy_006',
    admins: ['dummy_006'],
    members: ['dummy_003', 'dummy_004', 'dummy_005', 'dummy_006', 'dummy_007', 'dummy_008'],
  },
  {
    key: 's3',
    name: 'Craft Collective',
    description: 'Sculptural computation and ceramic process.',
    creatorAlias: 'dummy_002',
    admins: ['dummy_002'],
    members: ['dummy_001', 'dummy_002', 'dummy_007', 'dummy_008', 'dummy_009'],
  },
  {
    key: 's4',
    name: 'Community Hub',
    description: 'Governance experiments and cross-space coordination.',
    creatorAlias: 'dummy_010',
    admins: ['dummy_010'],
    members: ['dummy_006', 'dummy_007', 'dummy_008', 'dummy_009', 'dummy_010'],
  },
]

type ProjectDocStatus = 'active' | 'halted' | 'completed' | 'disputed' | 'archived'

/** Populated during `main()` after spaces are resolved */
const spaceIdByKey = new Map<string, mongoose.Types.ObjectId>()

const REPUTATION: Record<string, IReputationCategories> = {
  dummy_001: { craft: 850, research: 320, collaboration: 680, pedagogy: 180, consistency: 310, community: 760 },
  dummy_002: { craft: 780, research: 290, collaboration: 540, pedagogy: 250, consistency: 400, community: 520 },
  dummy_003: { craft: 340, research: 820, collaboration: 590, pedagogy: 310, consistency: 470, community: 340 },
  dummy_004: { craft: 520, research: 640, collaboration: 570, pedagogy: 290, consistency: 560, community: 380 },
  dummy_005: { craft: 280, research: 540, collaboration: 480, pedagogy: 790, consistency: 420, community: 450 },
  dummy_006: { craft: 180, research: 340, collaboration: 450, pedagogy: 310, consistency: 810, community: 580 },
  dummy_007: { craft: 390, research: 680, collaboration: 620, pedagogy: 350, consistency: 480, community: 640 },
  dummy_008: { craft: 660, research: 310, collaboration: 500, pedagogy: 180, consistency: 650, community: 420 },
  dummy_009: { craft: 310, research: 280, collaboration: 720, pedagogy: 220, consistency: 430, community: 750 },
  dummy_010: { craft: 280, research: 300, collaboration: 340, pedagogy: 210, consistency: 380, community: 460 },
}

type TraceRow = {
  alias: string
  activityType: ActivityType
  description: string
  toolSoftware: string
  duration: number
  mode: LogMode
  /** Days before now */
  dayAgo: number
}

function parseArg(key: string): string | null {
  const prefix = `--${key}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  if (!hit) return null
  return hit.slice(prefix.length)
}

function nowContributor(alias: string, role: string, isPrimary: boolean): IContributor {
  const t = new Date()
  return {
    alias,
    role,
    isPrimary,
    signedAt: t,
    accepted: true,
    invitedAt: t,
  }
}

async function resetDummyWorld(): Promise<void> {
  const names = SPACE_SPECS.map((s) => s.name)
  const spaces = await Space.find({ name: { $in: names } })
    .select('_id')
    .lean()
  if (spaces.length === 0) {
    console.log('[seed-spaces] reset: no matching spaces')
    return
  }
  const spaceIds = spaces.map((s) => s._id)
  const projects = await Project.find({ spaceId: { $in: spaceIds } })
    .select('_id')
    .lean()
  const projectIds = projects.map((p) => p._id)

  await Veto.deleteMany({ projectId: { $in: projectIds } })
  await Pivot.deleteMany({ projectId: { $in: projectIds } })
  await Reference.deleteMany({ projectId: { $in: projectIds } })
  await Trace.deleteMany({ projectId: { $in: projectIds } })
  await Project.deleteMany({ _id: { $in: projectIds } })
  await Space.deleteMany({ _id: { $in: spaceIds } })

  await ChainNode.updateMany({ alias: { $in: DUMMY_ALIASES } }, { $pullAll: { spaces: spaceIds } })
  console.log(`[seed-spaces] reset: removed ${spaces.length} spaces, ${projects.length} projects, chain docs untouched`)
}

async function seedTrace(
  projectId: mongoose.Types.ObjectId,
  row: TraceRow,
): Promise<mongoose.Types.ObjectId> {
  const ts = new Date()
  ts.setDate(ts.getDate() - row.dayAgo)
  ts.setHours(10 + (row.dayAgo % 7), (row.duration % 50) + 10, 0, 0)

  const block = await addBlock('trace', row.alias, {
    projectId: String(projectId),
    nodeAlias: row.alias,
    activityType: row.activityType,
    timestamp: ts.toISOString(),
    isProxy: false,
    proxyForAlias: null,
    mediaHash: null,
  })

  const doc = await Trace.create({
    projectId,
    nodeAlias: row.alias,
    activityType: row.activityType,
    otherDescription: '',
    timestamp: ts,
    mediaHash: '',
    mediaId: null,
    description: row.description,
    duration: row.duration,
    toolSoftware: row.toolSoftware,
    isProxy: false,
    proxyForAlias: '',
    proxyConfirmed: true,
    proxyConfirmDeadline: null,
    mode: row.mode,
    blockIndex: block.index,
  })
  return doc._id as mongoose.Types.ObjectId
}

async function startProject(opts: {
  title: string
  spaceId: mongoose.Types.ObjectId
  creatorAlias: string
  otherMembers: string[]
  context: string
  pedagogicalId?: string
  mentorAlias?: string
  visibility?: 'space_only' | 'process_visible' | 'fully_public'
  status: ProjectDocStatus
}): Promise<mongoose.Types.ObjectId> {
  const {
    title,
    spaceId,
    creatorAlias,
    otherMembers,
    context,
    pedagogicalId = '',
    mentorAlias = '',
    visibility = 'space_only',
    status,
  } = opts

  const contributors: IContributor[] = [
    nowContributor(creatorAlias, 'creator', true),
    ...otherMembers.map((a) => nowContributor(a, 'contributor', false)),
  ]

  const block = await addBlock('start', creatorAlias, {
    title,
    spaceId: String(spaceId),
    creatorAlias,
    contributors: contributors.map((c) => c.alias),
  })

  const project = await Project.create({
    title,
    spaceId,
    parentProjectId: null,
    creatorAlias,
    contributors,
    context,
    pedagogicalId,
    mentorAlias,
    status,
    visibility,
    startBlockIndex: block.index,
  })

  return project._id as mongoose.Types.ObjectId
}

/** Trace rows across 15 projects (original 8 + 7 more) */
function allTraceRows(): { key: string; rows: TraceRow[] }[] {
  return [
    {
      key: 'p1',
      rows: [
        { alias: 'dummy_001', activityType: 'skillwork', description: 'Warp sampling for conductive weft trials.', toolSoftware: 'loomCAD', duration: 40, mode: 'micro', dayAgo: 4 },
        { alias: 'dummy_001', activityType: 'fabrication', description: 'Laser-cut jig for tension tests on bio-yarn.', toolSoftware: 'LightBurn', duration: 95, mode: 'memo', dayAgo: 7 },
        { alias: 'dummy_001', activityType: 'brainstorm', description: 'Session: thermal comfort vs. conductivity trade-offs.', toolSoftware: 'Miro', duration: 55, mode: 'memo', dayAgo: 11 },
        { alias: 'dummy_002', activityType: 'fabrication', description: 'Small-batch dye baths — pH curves logged.', toolSoftware: 'BenchNotes', duration: 120, mode: 'reflection', dayAgo: 5 },
        { alias: 'dummy_002', activityType: 'skillwork', description: 'Hand-stitch reinforcement along bias.', toolSoftware: 'needle', duration: 35, mode: 'micro', dayAgo: 9 },
        { alias: 'dummy_002', activityType: 'review', description: 'Peer review of tensile fixture drawings.', toolSoftware: 'PDF', duration: 50, mode: 'memo', dayAgo: 12 },
        { alias: 'dummy_003', activityType: 'primary_research', description: 'Literature pass on mycelium-composite tensiles.', toolSoftware: 'Zotero', duration: 140, mode: 'reflection', dayAgo: 3 },
        { alias: 'dummy_003', activityType: 'secondary_research', description: 'Compiled ASTM-adjacent test heuristics.', toolSoftware: 'Sheets', duration: 90, mode: 'memo', dayAgo: 8 },
        { alias: 'dummy_003', activityType: 'brainstorm', description: 'Mapped unknowns for humidity cycling.', toolSoftware: 'FigJam', duration: 60, mode: 'memo', dayAgo: 14 },
        { alias: 'dummy_003', activityType: 'ai_tool', description: 'Summarised 12 papers into risk register.', toolSoftware: 'Claude', duration: 45, mode: 'micro', dayAgo: 16 },
        { alias: 'dummy_004', activityType: 'iterate', description: 'Revised test matrix after first failure mode.', toolSoftware: 'Notion', duration: 70, mode: 'memo', dayAgo: 6 },
        { alias: 'dummy_004', activityType: 'admin', description: 'Equipment booking + safety checklist for lab week.', toolSoftware: 'email', duration: 30, mode: 'micro', dayAgo: 10 },
      ],
    },
    {
      key: 'p2',
      rows: [
        { alias: 'dummy_002', activityType: 'fabrication', description: 'Silicone mold v1 for branching form.', toolSoftware: 'Rhino', duration: 110, mode: 'reflection', dayAgo: 2 },
        { alias: 'dummy_002', activityType: 'skillwork', description: 'Surface finish tests — release agent grid.', toolSoftware: 'bench', duration: 55, mode: 'memo', dayAgo: 5 },
        { alias: 'dummy_001', activityType: 'fabrication', description: 'CNC wasteboard alignment for cast table.', toolSoftware: 'bCNC', duration: 85, mode: 'memo', dayAgo: 6 },
        { alias: 'dummy_001', activityType: 'brainstorm', description: 'Cooling strategy for exothermic pour.', toolSoftware: 'whiteboard', duration: 40, mode: 'micro', dayAgo: 8 },
        { alias: 'dummy_005', activityType: 'pedagogy', description: 'Drafted apprentice briefing for pour day.', toolSoftware: 'Docs', duration: 65, mode: 'memo', dayAgo: 9 },
        { alias: 'dummy_005', activityType: 'primary_research', description: 'Compared mineral vs. organic pigment UV stability.', toolSoftware: 'lab journal', duration: 130, mode: 'reflection', dayAgo: 11 },
        { alias: 'dummy_001', activityType: 'skillwork', description: 'Post-cure sanding protocol notes.', toolSoftware: 'camera', duration: 25, mode: 'micro', dayAgo: 13 },
        { alias: 'dummy_002', activityType: 'review', description: 'Checked 005’s pigment notes against MSDS bundle.', toolSoftware: 'PDF', duration: 45, mode: 'memo', dayAgo: 15 },
        { alias: 'dummy_005', activityType: 'brainstorm', description: 'Risk huddle: ventilation + timing.', toolSoftware: 'Meet', duration: 50, mode: 'memo', dayAgo: 17 },
        { alias: 'dummy_001', activityType: 'fabrication', description: 'Bracket prototypes for mold registration pins.', toolSoftware: 'Fusion', duration: 100, mode: 'memo', dayAgo: 19 },
        { alias: 'dummy_002', activityType: 'iterate', description: 'Tweaked rib thickness after first demold.', toolSoftware: 'calipers', duration: 35, mode: 'micro', dayAgo: 21 },
      ],
    },
    {
      key: 'p3',
      rows: [
        { alias: 'dummy_004', activityType: 'admin', description: 'Indexed tool loan history for S1.', toolSoftware: 'Airtable', duration: 55, mode: 'memo', dayAgo: 3 },
        { alias: 'dummy_004', activityType: 'skillwork', description: 'Photographed edge conditions on shared blades.', toolSoftware: 'Darktable', duration: 40, mode: 'micro', dayAgo: 5 },
        { alias: 'dummy_003', activityType: 'secondary_research', description: 'Translated vendor torque specs to our checklist.', toolSoftware: 'Sheets', duration: 70, mode: 'memo', dayAgo: 7 },
        { alias: 'dummy_003', activityType: 'iterate', description: 'Merged duplicate entries in tool registry.', toolSoftware: 'SQLite', duration: 90, mode: 'reflection', dayAgo: 9 },
        { alias: 'dummy_004', activityType: 'review', description: 'Spot-audit: calibration stickers on drills.', toolSoftware: 'camera', duration: 30, mode: 'micro', dayAgo: 12 },
        { alias: 'dummy_003', activityType: 'ai_tool', description: 'Generated plain-language summaries of warranty PDFs.', toolSoftware: 'GPT', duration: 50, mode: 'memo', dayAgo: 14 },
        { alias: 'dummy_004', activityType: 'admin', description: 'Posted “return clean” reminder to space board.', toolSoftware: 'Slack', duration: 20, mode: 'micro', dayAgo: 16 },
        { alias: 'dummy_003', activityType: 'primary_research', description: 'Compared three suppliers on noise + duty cycle.', toolSoftware: 'browser', duration: 120, mode: 'reflection', dayAgo: 18 },
        { alias: 'dummy_004', activityType: 'skillwork', description: 'Labeled shelves after inventory sweep.', toolSoftware: 'labeler', duration: 45, mode: 'memo', dayAgo: 20 },
        { alias: 'dummy_003', activityType: 'brainstorm', description: 'What to open-source vs. keep local-only.', toolSoftware: 'Miro', duration: 60, mode: 'memo', dayAgo: 22 },
      ],
    },
    {
      key: 'p4',
      rows: [
        { alias: 'dummy_006', activityType: 'admin', description: 'Stakeholder sync on deployment windows.', toolSoftware: 'Calendar', duration: 35, mode: 'micro', dayAgo: 2 },
        { alias: 'dummy_006', activityType: 'review', description: 'Reviewed firmware release notes for sensor board.', toolSoftware: 'GitHub', duration: 55, mode: 'memo', dayAgo: 4 },
        { alias: 'dummy_003', activityType: 'primary_research', description: 'Field notes: multipath in courtyard.', toolSoftware: 'FieldKit', duration: 150, mode: 'reflection', dayAgo: 5 },
        { alias: 'dummy_007', activityType: 'secondary_research', description: 'LoRa vs. Wi-Fi mesh range tables.', toolSoftware: 'Sheets', duration: 110, mode: 'reflection', dayAgo: 6 },
        { alias: 'dummy_007', activityType: 'brainstorm', description: 'Power budget scenarios for winter.', toolSoftware: 'FigJam', duration: 50, mode: 'memo', dayAgo: 8 },
        { alias: 'dummy_008', activityType: 'fabrication', description: 'Weatherproof enclosures — first article.', toolSoftware: 'SolidWorks', duration: 95, mode: 'memo', dayAgo: 9 },
        { alias: 'dummy_008', activityType: 'skillwork', description: 'Hand-fit gaskets + strain relief.', toolSoftware: 'bench', duration: 40, mode: 'micro', dayAgo: 11 },
        { alias: 'dummy_007', activityType: 'iterate', description: 'Updated BOM after connector swap.', toolSoftware: 'KiCad', duration: 75, mode: 'memo', dayAgo: 13 },
        { alias: 'dummy_003', activityType: 'ai_tool', description: 'Generated deployment checklist from prior logs.', toolSoftware: 'Claude', duration: 35, mode: 'micro', dayAgo: 15 },
        { alias: 'dummy_006', activityType: 'other', description: 'Incident log: gateway reboot procedure.', toolSoftware: 'wiki', duration: 25, mode: 'micro', dayAgo: 17 },
        { alias: 'dummy_008', activityType: 'review', description: 'Thermal photos review with 007.', toolSoftware: 'FLIR Tools', duration: 60, mode: 'memo', dayAgo: 19 },
        { alias: 'dummy_007', activityType: 'admin', description: 'Permissions audit on shared dashboard.', toolSoftware: 'admin UI', duration: 45, mode: 'memo', dayAgo: 21 },
      ],
    },
    {
      key: 'p5',
      rows: [
        { alias: 'dummy_005', activityType: 'pedagogy', description: 'Lesson outline: power paths in dev boards.', toolSoftware: 'Slides', duration: 130, mode: 'reflection', dayAgo: 3 },
        { alias: 'dummy_005', activityType: 'brainstorm', description: 'Assessment rubric for “explain your BOM”.', toolSoftware: 'Docs', duration: 55, mode: 'memo', dayAgo: 6 },
        { alias: 'dummy_006', activityType: 'admin', description: 'Scheduled office hours + room booking.', toolSoftware: 'Calendar', duration: 25, mode: 'micro', dayAgo: 8 },
        { alias: 'dummy_006', activityType: 'review', description: 'Reviewed 005’s slide deck for clarity.', toolSoftware: 'PDF', duration: 50, mode: 'memo', dayAgo: 10 },
        { alias: 'dummy_007', activityType: 'pedagogy', description: 'Recorded walkthrough: flashing firmware safely.', toolSoftware: 'OBS', duration: 95, mode: 'memo', dayAgo: 11 },
        { alias: 'dummy_005', activityType: 'primary_research', description: 'Surveyed prior OSHW syllabi for gaps.', toolSoftware: 'Zotero', duration: 100, mode: 'reflection', dayAgo: 14 },
        { alias: 'dummy_007', activityType: 'iterate', description: 'Tightened captions on demo clips.', toolSoftware: 'DaVinci', duration: 70, mode: 'memo', dayAgo: 16 },
        { alias: 'dummy_006', activityType: 'other', description: 'Accessibility pass: transcript stubs.', toolSoftware: 'a11y checker', duration: 40, mode: 'micro', dayAgo: 18 },
        { alias: 'dummy_005', activityType: 'admin', description: 'Published module revision changelog.', toolSoftware: 'Git', duration: 30, mode: 'micro', dayAgo: 20 },
        { alias: 'dummy_007', activityType: 'brainstorm', description: 'Student confusion themes from pilot cohort.', toolSoftware: 'whiteboard', duration: 55, mode: 'memo', dayAgo: 22 },
      ],
    },
    {
      key: 'p6',
      rows: [
        { alias: 'dummy_007', activityType: 'secondary_research', description: 'Catalogued prior art in kinetic sculpture.', toolSoftware: 'Are.na', duration: 125, mode: 'reflection', dayAgo: 4 },
        { alias: 'dummy_007', activityType: 'brainstorm', description: 'Motion grammar for stepper choreography.', toolSoftware: 'Miro', duration: 60, mode: 'memo', dayAgo: 6 },
        { alias: 'dummy_001', activityType: 'fabrication', description: 'Frame welding fixtures — tack sequence.', toolSoftware: 'welder', duration: 140, mode: 'reflection', dayAgo: 7 },
        { alias: 'dummy_001', activityType: 'skillwork', description: 'Cable dress rehearsal before gallery install.', toolSoftware: 'zip ties', duration: 35, mode: 'micro', dayAgo: 9 },
        { alias: 'dummy_008', activityType: 'fabrication', description: 'Brackets for encoder mounts.', toolSoftware: 'mill', duration: 90, mode: 'memo', dayAgo: 10 },
        { alias: 'dummy_008', activityType: 'review', description: 'Code review: acceleration limits in firmware.', toolSoftware: 'GitHub', duration: 55, mode: 'memo', dayAgo: 12 },
        { alias: 'dummy_009', activityType: 'brainstorm', description: 'Narrative beats for audience pacing.', toolSoftware: 'Notion', duration: 50, mode: 'memo', dayAgo: 13 },
        { alias: 'dummy_009', activityType: 'iterate', description: 'Lighting cues v2 after dry run.', toolSoftware: 'QLC+', duration: 80, mode: 'memo', dayAgo: 15 },
        { alias: 'dummy_007', activityType: 'admin', description: 'Insurance walkthrough for public show.', toolSoftware: 'email', duration: 40, mode: 'micro', dayAgo: 17 },
        { alias: 'dummy_008', activityType: 'skillwork', description: 'Manual homing procedure documentation.', toolSoftware: 'camera', duration: 30, mode: 'micro', dayAgo: 19 },
        { alias: 'dummy_009', activityType: 'other', description: 'Strike plan + crate dimensions.', toolSoftware: 'Sheets', duration: 45, mode: 'memo', dayAgo: 21 },
      ],
    },
    {
      key: 'p7',
      rows: [
        { alias: 'dummy_008', activityType: 'fabrication', description: 'Test tiles — cone 6 oxidation.', toolSoftware: 'kiln log', duration: 100, mode: 'memo', dayAgo: 5 },
        { alias: 'dummy_008', activityType: 'skillwork', description: 'Trimming leather-hard series B.', toolSoftware: 'wheel', duration: 55, mode: 'memo', dayAgo: 7 },
        { alias: 'dummy_002', activityType: 'fabrication', description: 'Slip casting trials — wall thickness map.', toolSoftware: 'notebook', duration: 120, mode: 'reflection', dayAgo: 8 },
        { alias: 'dummy_002', activityType: 'review', description: 'Checked 008’s firing schedule against studio rules.', toolSoftware: 'PDF', duration: 35, mode: 'micro', dayAgo: 10 },
        { alias: 'dummy_009', activityType: 'brainstorm', description: 'Glaze chemistry “safe experiments” list.', toolSoftware: 'Miro', duration: 50, mode: 'memo', dayAgo: 11 },
        { alias: 'dummy_009', activityType: 'iterate', description: 'Photo doc: crack patterns after quench test.', toolSoftware: 'Lightroom', duration: 70, mode: 'memo', dayAgo: 13 },
        { alias: 'dummy_008', activityType: 'admin', description: 'Studio cleanup roster + chemical inventory.', toolSoftware: 'Slack', duration: 30, mode: 'micro', dayAgo: 15 },
        { alias: 'dummy_002', activityType: 'skillwork', description: 'Sprigging decorative relief samples.', toolSoftware: 'clay', duration: 85, mode: 'memo', dayAgo: 17 },
        { alias: 'dummy_009', activityType: 'other', description: 'Archived failed batch with root-cause note.', toolSoftware: 'wiki', duration: 40, mode: 'micro', dayAgo: 19 },
        { alias: 'dummy_008', activityType: 'review', description: 'Cross-check 002’s thickness claims with calipers.', toolSoftware: 'caliper', duration: 25, mode: 'micro', dayAgo: 21 },
      ],
    },
    {
      key: 'p8',
      rows: [
        { alias: 'dummy_010', activityType: 'admin', description: 'Drafted decision log template for stewards.', toolSoftware: 'Notion', duration: 55, mode: 'memo', dayAgo: 2 },
        { alias: 'dummy_010', activityType: 'brainstorm', description: 'Facilitated tension: open vs. invite-only projects.', toolSoftware: 'FigJam', duration: 65, mode: 'memo', dayAgo: 3 },
        { alias: 'dummy_006', activityType: 'review', description: 'Commented on 010’s draft policy.', toolSoftware: 'Docs', duration: 45, mode: 'memo', dayAgo: 4 },
        { alias: 'dummy_009', activityType: 'iterate', description: 'Merged feedback into escalation ladder v0.3.', toolSoftware: 'Git', duration: 50, mode: 'memo', dayAgo: 5 },
        { alias: 'dummy_010', activityType: 'pedagogy', description: 'Plain-language explainer for veto flow.', toolSoftware: 'Slides', duration: 90, mode: 'reflection', dayAgo: 6 },
        { alias: 'dummy_007', activityType: 'admin', description: 'Mapped RACI for moderation incidents.', toolSoftware: 'Sheets', duration: 70, mode: 'memo', dayAgo: 7 },
        { alias: 'dummy_008', activityType: 'review', description: 'Security pass on shared governance doc.', toolSoftware: 'PDF', duration: 40, mode: 'micro', dayAgo: 8 },
        { alias: 'dummy_010', activityType: 'other', description: 'Office hours: conflict of interest scenarios.', toolSoftware: 'Meet', duration: 60, mode: 'memo', dayAgo: 9 },
        { alias: 'dummy_006', activityType: 'primary_research', description: 'Compared three OSS governance playbooks.', toolSoftware: 'browser', duration: 110, mode: 'reflection', dayAgo: 11 },
        { alias: 'dummy_009', activityType: 'brainstorm', description: 'Async thread: term limits for admins.', toolSoftware: 'Discourse', duration: 35, mode: 'micro', dayAgo: 12 },
        { alias: 'dummy_010', activityType: 'skillwork', description: 'Poster session handout for hub night.', toolSoftware: 'InDesign', duration: 75, mode: 'memo', dayAgo: 14 },
        { alias: 'dummy_007', activityType: 'iterate', description: 'Timeline graphic for annual review cycle.', toolSoftware: 'Figma', duration: 55, mode: 'memo', dayAgo: 15 },
        { alias: 'dummy_009', activityType: 'admin', description: 'Newsletter blurb: how to file a concern.', toolSoftware: 'email', duration: 25, mode: 'micro', dayAgo: 17 },
        { alias: 'dummy_010', activityType: 'review', description: 'Final read-through before publishing v1.', toolSoftware: 'Docs', duration: 50, mode: 'memo', dayAgo: 19 },
      ],
    },
    {
      key: 'p9',
      rows: [
        { alias: 'dummy_003', activityType: 'primary_research', description: 'Fiber provenance chain-of-custody template.', toolSoftware: 'Sheets', duration: 95, mode: 'memo', dayAgo: 3 },
        { alias: 'dummy_003', activityType: 'iterate', description: 'SKU merge rules for reclaimed lots.', toolSoftware: 'SQLite', duration: 70, mode: 'memo', dayAgo: 5 },
        { alias: 'dummy_004', activityType: 'admin', description: 'Barcode label rollout for bins A–F.', toolSoftware: 'printer', duration: 40, mode: 'micro', dayAgo: 6 },
        { alias: 'dummy_005', activityType: 'review', description: 'Audit sample against intake photos.', toolSoftware: 'camera', duration: 55, mode: 'memo', dayAgo: 8 },
        { alias: 'dummy_004', activityType: 'skillwork', description: 'Weight checks on mixed fiber bales.', toolSoftware: 'scale', duration: 30, mode: 'micro', dayAgo: 10 },
        { alias: 'dummy_003', activityType: 'brainstorm', description: 'What to expose on public manifest vs. internal.', toolSoftware: 'Miro', duration: 60, mode: 'memo', dayAgo: 12 },
        { alias: 'dummy_005', activityType: 'ai_tool', description: 'Drafted supplier letter from prior season notes.', toolSoftware: 'GPT', duration: 45, mode: 'micro', dayAgo: 14 },
        { alias: 'dummy_004', activityType: 'secondary_research', description: 'Compared grading standards across two mills.', toolSoftware: 'browser', duration: 100, mode: 'reflection', dayAgo: 16 },
      ],
    },
    {
      key: 'p10',
      rows: [
        { alias: 'dummy_005', activityType: 'pedagogy', description: 'Pictograms for chemical storage zones.', toolSoftware: 'Illustrator', duration: 90, mode: 'memo', dayAgo: 2 },
        { alias: 'dummy_005', activityType: 'admin', description: 'Print queue + laminate schedule.', toolSoftware: 'Calendar', duration: 35, mode: 'micro', dayAgo: 4 },
        { alias: 'dummy_001', activityType: 'fabrication', description: 'Router-cut acrylic backers for wall mounts.', toolSoftware: 'VCarve', duration: 85, mode: 'memo', dayAgo: 5 },
        { alias: 'dummy_001', activityType: 'skillwork', description: 'Drill template alignment for repeatability.', toolSoftware: 'jig', duration: 40, mode: 'micro', dayAgo: 7 },
        { alias: 'dummy_005', activityType: 'brainstorm', description: 'Icon set: emergency vs. caution hierarchy.', toolSoftware: 'FigJam', duration: 50, mode: 'memo', dayAgo: 9 },
        { alias: 'dummy_001', activityType: 'review', description: 'Contrast check for color-blind legibility.', toolSoftware: 'Figma', duration: 55, mode: 'memo', dayAgo: 11 },
        { alias: 'dummy_005', activityType: 'iterate', description: 'V2 copy after studio lead feedback.', toolSoftware: 'Docs', duration: 45, mode: 'memo', dayAgo: 13 },
        { alias: 'dummy_001', activityType: 'admin', description: 'Mounting hardware BOM for install day.', toolSoftware: 'Sheets', duration: 30, mode: 'micro', dayAgo: 15 },
      ],
    },
    {
      key: 'p11',
      rows: [
        { alias: 'dummy_007', activityType: 'secondary_research', description: 'Gap-fill imputation for missing PM2.5 hours.', toolSoftware: 'Python', duration: 130, mode: 'reflection', dayAgo: 4 },
        { alias: 'dummy_006', activityType: 'admin', description: 'Data-use agreement draft for collaborators.', toolSoftware: 'Docs', duration: 50, mode: 'memo', dayAgo: 5 },
        { alias: 'dummy_008', activityType: 'review', description: 'Sensor drift checks on control node.', toolSoftware: 'Grafana', duration: 60, mode: 'memo', dayAgo: 7 },
        { alias: 'dummy_007', activityType: 'iterate', description: 'Re-export yearly aggregates with new timezone rules.', toolSoftware: 'pandas', duration: 75, mode: 'memo', dayAgo: 9 },
        { alias: 'dummy_006', activityType: 'other', description: 'Retention policy note for raw vs. derived.', toolSoftware: 'wiki', duration: 35, mode: 'micro', dayAgo: 11 },
        { alias: 'dummy_008', activityType: 'skillwork', description: 'Field swap of faulty humidity sensor.', toolSoftware: 'kit', duration: 45, mode: 'memo', dayAgo: 13 },
        { alias: 'dummy_007', activityType: 'brainstorm', description: 'Publication figure list for civic partners.', toolSoftware: 'Notion', duration: 55, mode: 'memo', dayAgo: 15 },
        { alias: 'dummy_006', activityType: 'review', description: 'Sign-off on methodology appendix.', toolSoftware: 'PDF', duration: 40, mode: 'micro', dayAgo: 17 },
      ],
    },
    {
      key: 'p12',
      rows: [
        { alias: 'dummy_005', activityType: 'pedagogy', description: 'Exercise: trace a net from schematic to copper.', toolSoftware: 'KiCad', duration: 120, mode: 'reflection', dayAgo: 3 },
        { alias: 'dummy_008', activityType: 'fabrication', description: 'Demo boards: USB-serial + reset circuit.', toolSoftware: 'solder', duration: 95, mode: 'memo', dayAgo: 5 },
        { alias: 'dummy_005', activityType: 'brainstorm', description: 'Pacing: one evening vs. two short sessions.', toolSoftware: 'whiteboard', duration: 45, mode: 'memo', dayAgo: 7 },
        { alias: 'dummy_008', activityType: 'review', description: 'BOM cost sanity for workshop kits.', toolSoftware: 'Sheets', duration: 50, mode: 'memo', dayAgo: 9 },
        { alias: 'dummy_005', activityType: 'admin', description: 'Participant signup + waiver links.', toolSoftware: 'Forms', duration: 30, mode: 'micro', dayAgo: 11 },
        { alias: 'dummy_008', activityType: 'iterate', description: 'Silkscreen tweaks for pinout clarity.', toolSoftware: 'KiCad', duration: 65, mode: 'memo', dayAgo: 13 },
        { alias: 'dummy_005', activityType: 'primary_research', description: 'Surveyed beginner failure modes from last cohort.', toolSoftware: 'Forms', duration: 80, mode: 'memo', dayAgo: 15 },
        { alias: 'dummy_008', activityType: 'admin', description: 'Parts bin prep + ESD station check.', toolSoftware: 'checklist', duration: 25, mode: 'micro', dayAgo: 17 },
      ],
    },
    {
      key: 'p13',
      rows: [
        { alias: 'dummy_009', activityType: 'brainstorm', description: 'Plinth heights for sightlines in narrow room.', toolSoftware: 'SketchUp', duration: 55, mode: 'memo', dayAgo: 2 },
        { alias: 'dummy_007', activityType: 'secondary_research', description: 'Load ratings for temporary floor overlays.', toolSoftware: 'PDF', duration: 90, mode: 'memo', dayAgo: 4 },
        { alias: 'dummy_008', activityType: 'fabrication', description: 'Plywood lamination mockup v1.', toolSoftware: 'clamps', duration: 110, mode: 'reflection', dayAgo: 6 },
        { alias: 'dummy_009', activityType: 'iterate', description: 'Edge trim detail after curator walkthrough.', toolSoftware: 'notebook', duration: 40, mode: 'micro', dayAgo: 8 },
        { alias: 'dummy_007', activityType: 'admin', description: 'Venue contact + load-in window.', toolSoftware: 'email', duration: 35, mode: 'micro', dayAgo: 10 },
        { alias: 'dummy_008', activityType: 'review', description: 'Stability check with weighted dummy.', toolSoftware: 'camera', duration: 50, mode: 'memo', dayAgo: 12 },
        { alias: 'dummy_009', activityType: 'skillwork', description: 'Sanding pass + edge seal test.', toolSoftware: 'orbital', duration: 70, mode: 'memo', dayAgo: 14 },
        { alias: 'dummy_007', activityType: 'other', description: 'Strike + storage sketch for crates.', toolSoftware: 'pen', duration: 30, mode: 'micro', dayAgo: 16 },
      ],
    },
    {
      key: 'p14',
      rows: [
        { alias: 'dummy_007', activityType: 'admin', description: 'Unified CSV columns across three studio kilns.', toolSoftware: 'Sheets', duration: 55, mode: 'memo', dayAgo: 3 },
        { alias: 'dummy_002', activityType: 'fabrication', description: 'Thermocouple placement diagram for top loader.', toolSoftware: 'CAD', duration: 85, mode: 'memo', dayAgo: 5 },
        { alias: 'dummy_007', activityType: 'iterate', description: 'Version field + hash for log immutability.', toolSoftware: 'Git', duration: 45, mode: 'memo', dayAgo: 7 },
        { alias: 'dummy_002', activityType: 'review', description: 'Spot-check 007’s cone notation vs. studio chart.', toolSoftware: 'PDF', duration: 35, mode: 'micro', dayAgo: 9 },
        { alias: 'dummy_007', activityType: 'brainstorm', description: 'What to auto-validate vs. human sign-off.', toolSoftware: 'Miro', duration: 60, mode: 'memo', dayAgo: 11 },
        { alias: 'dummy_002', activityType: 'skillwork', description: 'Photographed thermocouple routing best practice.', toolSoftware: 'phone', duration: 25, mode: 'micro', dayAgo: 13 },
        { alias: 'dummy_007', activityType: 'secondary_research', description: 'Compared open kiln logger firmware options.', toolSoftware: 'GitHub', duration: 100, mode: 'reflection', dayAgo: 15 },
        { alias: 'dummy_002', activityType: 'admin', description: 'Posted migration deadline to collective channel.', toolSoftware: 'Slack', duration: 20, mode: 'micro', dayAgo: 17 },
      ],
    },
    {
      key: 'p15',
      rows: [
        { alias: 'dummy_006', activityType: 'primary_research', description: 'Case file anonymisation checklist.', toolSoftware: 'Docs', duration: 75, mode: 'memo', dayAgo: 2 },
        { alias: 'dummy_010', activityType: 'brainstorm', description: 'Escalation tiers when two spaces disagree.', toolSoftware: 'FigJam', duration: 65, mode: 'memo', dayAgo: 3 },
        { alias: 'dummy_009', activityType: 'iterate', description: 'Merged 006’s checklist into master doc.', toolSoftware: 'Git', duration: 50, mode: 'memo', dayAgo: 5 },
        { alias: 'dummy_006', activityType: 'admin', description: 'Moderator rotation draft schedule.', toolSoftware: 'Calendar', duration: 40, mode: 'micro', dayAgo: 7 },
        { alias: 'dummy_010', activityType: 'pedagogy', description: 'One-pager: what “mediation” means here.', toolSoftware: 'Slides', duration: 85, mode: 'memo', dayAgo: 8 },
        { alias: 'dummy_009', activityType: 'review', description: 'Readability pass for non-native English.', toolSoftware: 'Grammarly', duration: 45, mode: 'memo', dayAgo: 10 },
        { alias: 'dummy_006', activityType: 'review', description: 'Legal-ish disclaimer block — not advice.', toolSoftware: 'Docs', duration: 35, mode: 'micro', dayAgo: 12 },
        { alias: 'dummy_010', activityType: 'other', description: 'Pilot sim: two-room dispute scenario.', toolSoftware: 'Meet', duration: 90, mode: 'reflection', dayAgo: 14 },
      ],
    },
  ]
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const reset = process.argv.includes('--reset')

  console.log(`[seed-spaces] apply=${apply} reset=${reset}`)

  await connectDatabase()
  await ensureGenesis()

  if (reset && apply) {
    await resetDummyWorld()
  }

  const missing: string[] = []
  for (const a of DUMMY_ALIASES) {
    const ex = await ChainNode.exists({ alias: a, status: 'active' })
    if (!ex) missing.push(a)
  }
  if (missing.length) {
    console.error('[seed-spaces] Missing nodes:', missing.join(', '))
    console.error('[seed-spaces] Run: npx tsx scripts/seed-dummy-nodes.ts --apply')
    process.exit(1)
  }

  if (!apply) {
    const traceGroups = allTraceRows()
    const n = traceGroups.reduce((s, g) => s + g.rows.length, 0)
    console.log(
      `[seed-spaces] dry-run: would create ${SPACE_SPECS.length} spaces, 15 projects, ${n} traces, 2 refs, 2 pivots, 1 veto`,
    )
    console.log('[seed-spaces] Re-run with --apply to write.')
    await mongoose.disconnect()
    return
  }

  for (const spec of SPACE_SPECS) {
    const exists = await Space.findOne({ name: spec.name })
    if (exists) {
      console.log(`[seed-spaces] skip space (exists): ${spec.name}`)
      spaceIdByKey.set(spec.key, exists._id as mongoose.Types.ObjectId)
      continue
    }
    const space = await Space.create({
      name: spec.name,
      description: spec.description,
      creatorAlias: spec.creatorAlias,
      admins: [...spec.admins],
      members: [...spec.members],
      settings: {
        projectAccess: 'open',
        vetoAuthority: [],
        votingThreshold: 0.5,
        privacyDefault: 'space_specific',
        customContractsAllowed: true,
        contentRestrictions: [],
        minDocRequirements: [],
      },
      pendingVeto: [],
      inviteCodes: [],
      status: 'active',
      parentSpaceId: null,
    })
    spaceIdByKey.set(spec.key, space._id as mongoose.Types.ObjectId)
    for (const alias of spec.members) {
      await ChainNode.findOneAndUpdate({ alias }, { $addToSet: { spaces: space._id } })
    }
    console.log(`[seed-spaces] created space ${spec.name} (${spec.key})`)
  }

  for (const spec of SPACE_SPECS) {
    if (!spaceIdByKey.has(spec.key)) {
      const s = await Space.findOne({ name: spec.name })
      if (s) spaceIdByKey.set(spec.key, s._id as mongoose.Types.ObjectId)
    }
  }

  const s1 = spaceIdByKey.get('s1')!
  const s2 = spaceIdByKey.get('s2')!
  const s3 = spaceIdByKey.get('s3')!
  const s4 = spaceIdByKey.get('s4')!

  const projectIdByKey = new Map<string, mongoose.Types.ObjectId>()

  async function ensureProject(
    key: string,
    opts: Parameters<typeof startProject>[0] & { spaceId: mongoose.Types.ObjectId },
  ): Promise<mongoose.Types.ObjectId> {
    const existing = await Project.findOne({ title: opts.title, spaceId: opts.spaceId })
    if (existing) {
      projectIdByKey.set(key, existing._id as mongoose.Types.ObjectId)
      return existing._id as mongoose.Types.ObjectId
    }
    const id = await startProject(opts)
    projectIdByKey.set(key, id)
    console.log(`[seed-spaces] created project ${key}: ${opts.title}`)
    return id
  }

  const p1 = await ensureProject('p1', {
    title: 'Material Futures: Speculative Textile',
    spaceId: s1,
    creatorAlias: 'dummy_001',
    otherMembers: ['dummy_002', 'dummy_003', 'dummy_004'],
    context: 'Conductive textiles + environmental stress testing.',
    status: 'completed',
  })

  const p2 = await ensureProject('p2', {
    title: 'Biomorphic Casting Study',
    spaceId: s1,
    creatorAlias: 'dummy_002',
    otherMembers: ['dummy_001', 'dummy_005'],
    context: 'Casting organic forms; pigment and binder experiments.',
    status: 'active',
  })

  const p3 = await ensureProject('p3', {
    title: 'Tool Archive & Documentation',
    spaceId: s1,
    creatorAlias: 'dummy_004',
    otherMembers: ['dummy_003'],
    context: 'Shared tooling knowledge base for Open Materials Lab.',
    status: 'completed',
  })

  const p4 = await ensureProject('p4', {
    title: 'Environmental Sensing Network',
    spaceId: s2,
    creatorAlias: 'dummy_006',
    otherMembers: ['dummy_003', 'dummy_007', 'dummy_008'],
    context: 'Field deployment of low-power environmental sensors.',
    status: 'active',
  })

  const p5 = await ensureProject('p5', {
    title: 'Pedagogy Module: Open Source Hardware',
    spaceId: s2,
    creatorAlias: 'dummy_005',
    otherMembers: ['dummy_006', 'dummy_007'],
    context: 'Teachable module for firmware flashing and BOM literacy.',
    pedagogicalId: 'oshw-mod-01',
    status: 'completed',
  })

  const p6 = await ensureProject('p6', {
    title: 'Sculptural Computation Series',
    spaceId: s3,
    creatorAlias: 'dummy_007',
    otherMembers: ['dummy_001', 'dummy_008', 'dummy_009'],
    context: 'Kinetic works for winter gallery.',
    status: 'active',
  })

  const p7 = await ensureProject('p7', {
    title: 'Ceramic Process Documentation',
    spaceId: s3,
    creatorAlias: 'dummy_008',
    otherMembers: ['dummy_002', 'dummy_009'],
    context: 'Documenting studio ceramic trials and failures.',
    status: 'active',
  })

  const p8 = await ensureProject('p8', {
    title: 'Space Governance Framework',
    spaceId: s4,
    creatorAlias: 'dummy_010',
    otherMembers: ['dummy_006', 'dummy_009'],
    context: 'Lightweight governance patterns for multi-space collaboration.',
    status: 'active',
  })

  const p9 = await ensureProject('p9', {
    title: 'Reclaimed Fiber Inventory',
    spaceId: s1,
    creatorAlias: 'dummy_003',
    otherMembers: ['dummy_004', 'dummy_005'],
    context: 'Tracking provenance and grading for reclaimed textile lots.',
    status: 'active',
  })

  const p10 = await ensureProject('p10', {
    title: 'Safety Signage Redesign',
    spaceId: s1,
    creatorAlias: 'dummy_005',
    otherMembers: ['dummy_001'],
    context: 'Clear chemical-storage and PPE signage for the lab.',
    status: 'active',
  })

  const p11 = await ensureProject('p11', {
    title: 'Longitudinal Air Quality Dataset',
    spaceId: s2,
    creatorAlias: 'dummy_007',
    otherMembers: ['dummy_006', 'dummy_008'],
    context: 'Year-over-year particulate and humidity series with QA notes.',
    status: 'active',
  })

  const p12 = await ensureProject('p12', {
    title: 'Workshop: KiCad for Artists',
    spaceId: s2,
    creatorAlias: 'dummy_005',
    otherMembers: ['dummy_008'],
    context: 'Hands-on PCB layout workshop for non-EE contributors.',
    status: 'completed',
  })

  const p13 = await ensureProject('p13', {
    title: 'Public Plinth Prototypes',
    spaceId: s3,
    creatorAlias: 'dummy_009',
    otherMembers: ['dummy_007', 'dummy_008'],
    context: 'Modular plinths for a narrow gallery footprint.',
    status: 'active',
  })

  const p14 = await ensureProject('p14', {
    title: 'Kiln Log Standardisation',
    spaceId: s3,
    creatorAlias: 'dummy_007',
    otherMembers: ['dummy_002'],
    context: 'Shared CSV schema and signing practice for firing logs.',
    status: 'active',
  })

  const p15 = await ensureProject('p15', {
    title: 'Cross-Space Mediation Playbook',
    spaceId: s4,
    creatorAlias: 'dummy_006',
    otherMembers: ['dummy_010', 'dummy_009'],
    context: 'Templates for cross-space disputes and neutral facilitation.',
    status: 'active',
  })

  const traceCountByProject: Record<string, number> = {}
  for (const group of allTraceRows()) {
    const pid = projectIdByKey.get(group.key)
    if (!pid) continue
    const existingN = await Trace.countDocuments({ projectId: pid })
    if (existingN > 0) {
      traceCountByProject[group.key] = existingN
      console.log(`[seed-spaces] skip traces for ${group.key} (${existingN} exist)`)
      continue
    }
    for (const row of group.rows) {
      await seedTrace(pid, row)
    }
    traceCountByProject[group.key] = group.rows.length
  }

  const ref1 = await Reference.findOne({ projectId: p1, relationshipType: 'inspired_by' })
  if (!ref1) {
    const b = await addBlock('reference', 'dummy_001', {
      projectId: String(p1),
      sourceProjectId: null,
      externalUrl: 'https://example.org/material-archive/speculative-textiles',
      citation: 'Open Materials Archive, 2024 cohort notes.',
      relationshipType: 'inspired_by',
    })
    await Reference.create({
      projectId: p1,
      nodeAlias: 'dummy_001',
      sourceProjectId: '',
      externalUrl: 'https://example.org/material-archive/speculative-textiles',
      citation: 'Open Materials Archive, 2024 cohort notes.',
      relationshipType: 'inspired_by',
      otherExplanation: '',
      blockIndex: b.index,
    })
    console.log('[seed-spaces] reference: P1 inspired_by external')
  }

  const ref2 = await Reference.findOne({ projectId: p3, relationshipType: 'built_on' })
  if (!ref2) {
    const b = await addBlock('reference', 'dummy_004', {
      projectId: String(p3),
      sourceProjectId: String(p1),
      externalUrl: null,
      citation: 'Builds on Material Futures project methodology.',
      relationshipType: 'built_on',
    })
    await Reference.create({
      projectId: p3,
      nodeAlias: 'dummy_004',
      sourceProjectId: String(p1),
      externalUrl: '',
      citation: 'Builds on Material Futures project methodology.',
      relationshipType: 'built_on',
      otherExplanation: '',
      blockIndex: b.index,
    })
    console.log('[seed-spaces] reference: P3 built_on P1')
  }

  const piv2 = await Pivot.findOne({ projectId: p2 })
  if (!piv2) {
    const b = await addBlock('pivot', 'dummy_002', {
      projectId: String(p2),
      reason: 'Shifted from natural pigment binders to synthetic resin for structural stability.',
    })
    await Pivot.create({
      projectId: p2,
      nodeAlias: 'dummy_002',
      reason: 'Shifted from natural pigment binders to synthetic resin for structural stability.',
      blockIndex: b.index,
    })
    console.log('[seed-spaces] pivot: P2')
  }

  const piv4 = await Pivot.findOne({ projectId: p4 })
  if (!piv4) {
    const b = await addBlock('pivot', 'dummy_006', {
      projectId: String(p4),
      reason: 'Sensor protocol moved from Wi-Fi mesh to LoRa after range testing.',
    })
    await Pivot.create({
      projectId: p4,
      nodeAlias: 'dummy_006',
      reason: 'Sensor protocol moved from Wi-Fi mesh to LoRa after range testing.',
      blockIndex: b.index,
    })
    console.log('[seed-spaces] pivot: P4')
  }

  const tracesP7 = await Trace.find({ projectId: p7 }).sort({ createdAt: 1 }).limit(2).select('_id')
  const vetoEx = await Veto.findOne({ projectId: p7, nodeAlias: 'dummy_008' })
  if (!vetoEx && tracesP7.length >= 2) {
    const reason =
      'Limit public detail on glaze chemistry traces pending studio policy review.'
    const reasonHash = sha256(reason)
    const targetTraceIds = tracesP7.map((t) => t._id as mongoose.Types.ObjectId)
    const b = await addBlock('veto', 'dummy_008', {
      projectId: String(p7),
      vetoType: 'scope_limit',
      reasonHash,
      targetTraceIds: targetTraceIds.map(String),
    })
    await Veto.create({
      projectId: p7,
      nodeAlias: 'dummy_008',
      vetoType: 'scope_limit',
      reasonHash,
      targetTraceIds,
      signatures: [{ alias: 'dummy_008', signedAt: new Date() }],
      status: 'active',
      blockIndex: b.index,
    })
    await Trace.collection.updateMany(
      { _id: { $in: targetTraceIds } },
      { $set: { scopeLimited: true } },
    )
    console.log('[seed-spaces] veto: P7 scope_limit on 2 traces')
  }

  await Project.findByIdAndUpdate(p7, { status: 'archived' })

  for (const alias of DUMMY_ALIASES) {
    const ids = SPACE_SPECS.filter((s) => s.members.includes(alias)).map((s) => {
      const sid = spaceIdByKey.get(s.key)
      if (!sid) throw new Error(`missing space ${s.key}`)
      return sid
    })
    const cats = REPUTATION[alias]
    const score = reputationScoreFromCategories(cats)
    await ChainNode.findOneAndUpdate(
      { alias },
      { $set: { spaces: ids, reputationCategories: cats, reputationScore: score } },
    )
  }

  const totalTraces = await Trace.countDocuments({
    projectId: { $in: [...projectIdByKey.values()] },
  })
  console.log(`[seed-spaces] done. Projects: ${projectIdByKey.size}, traces in seeded projects: ${totalTraces}`)
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error('[seed-spaces] failed', e)
  process.exit(1)
})
