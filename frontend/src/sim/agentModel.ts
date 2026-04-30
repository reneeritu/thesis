/** Pure agent simulation — paired ticks share one RNG stream so worlds stay aligned. */

export type CategoryKey = 'craft' | 'research' | 'collaboration' | 'community'

export type LinkData = { weight: number; attestationCount: number }

export type AgentNode = {
  id: string
  alias: string
  reputation: number
  categories: Record<CategoryKey, number>
  tracesLogged: number
  /** Synced labor units (same RNG) — used for work-share vs credit-share UI. */
  cumulativeWork: number
  projectsCompleted: number
  creditReceived: number
  links: Map<string, LinkData>
  isActive: boolean
}

export type SimParams = {
  numNodes: number
  activityRate: number
  attestationRate: number
  traceGain: number
  collaborationBias: number
  projectFrequency: number
  projectCreditPool: number
  equalSplit: boolean
  documentationOn: boolean
}

export type CoreParams = Omit<SimParams, 'documentationOn'>

export type SimSnapshot = {
  tick: number
  nodes: AgentNode[]
  gini: number
  totalTraces: number
  totalProjects: number
  topNodeShare: number
}

export type SimState = {
  tick: number
  seed: number
  nodes: AgentNode[]
  lifetimeTraces: number
}

export type TickMeta = {
  tick: number
  flashNodeIds: string[]
  settlementContributorIds: string[]
  undocUndercreditedAlias: string | null
  docIndependentAttestation: boolean
  giniLeft: number
  giniRight: number
}

const REP_MIN = 50
const REP_MAX = 1000

const CAT_KEYS: CategoryKey[] = ['craft', 'research', 'collaboration', 'community']

export function clampRep(n: number): number {
  return Math.min(REP_MAX, Math.max(REP_MIN, n))
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashSeed(seed: number, tick: number): number {
  return (seed ^ Math.imul(tick + 1, 0x9e3779b1)) >>> 0
}

function cloneLinkMap(m: Map<string, LinkData>): Map<string, LinkData> {
  return new Map(Array.from(m.entries(), ([k, v]) => [k, { ...v }]))
}

export function cloneAgentNode(n: AgentNode): AgentNode {
  return {
    ...n,
    categories: { ...n.categories },
    links: cloneLinkMap(n.links),
  }
}

export function cloneState(s: SimState): SimState {
  return {
    ...s,
    nodes: s.nodes.map(cloneAgentNode),
  }
}

export function calculateGini(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  if (n <= 1) return 0
  let sum = 0
  for (let i = 0; i < n; i++) sum += sorted[i]!
  if (sum <= 0) return 0
  let weighted = 0
  for (let i = 0; i < n; i++) weighted += (i + 1) * sorted[i]!
  return (2 * weighted) / (n * sum) - (n + 1) / n
}

function sumRep(nodes: AgentNode[]): number {
  return nodes.reduce((a, n) => a + n.reputation, 0)
}

function topShare(nodes: AgentNode[]): number {
  const s = sumRep(nodes)
  if (s <= 0) return 0
  let mx = 0
  for (const n of nodes) mx = Math.max(mx, n.reputation)
  return mx / s
}

/** Top-k nodes' share of total credit (0–100, one decimal). */
export function topKCreditSharePct(nodes: AgentNode[], k = 3): number {
  const credits = nodes.map((n) => n.creditReceived)
  const total = credits.reduce((a, b) => a + b, 0)
  if (total <= 0) return 0
  const sorted = [...credits].sort((a, b) => b - a)
  let top = 0
  for (let i = 0; i < Math.min(k, sorted.length); i++) top += sorted[i]!
  return Math.round((top / total) * 1000) / 10
}

export function buildSnapshot(state: SimState): SimSnapshot {
  const reps = state.nodes.map((n) => n.reputation)
  return {
    tick: state.tick,
    nodes: state.nodes.map(cloneAgentNode),
    gini: calculateGini(reps),
    totalTraces: state.lifetimeTraces,
    totalProjects: state.nodes.reduce((a, n) => a + n.projectsCompleted, 0),
    topNodeShare: topShare(state.nodes),
  }
}

function emptyCategories(): Record<CategoryKey, number> {
  return { craft: 25, research: 25, collaboration: 25, community: 25 }
}

export function initState(params: SimParams, seed = Date.now() >>> 0): SimState {
  const nodes: AgentNode[] = []
  for (let i = 0; i < params.numNodes; i++) {
    const id = `n${i}`
    nodes.push({
      id,
      alias: `node_${String(i + 1).padStart(2, '0')}`,
      reputation: 100,
      categories: emptyCategories(),
      tracesLogged: 0,
      cumulativeWork: 0,
      projectsCompleted: 0,
      creditReceived: 0,
      links: new Map(),
      isActive: false,
    })
  }
  return { tick: 0, seed, nodes, lifetimeTraces: 0 }
}

export function initPairedStates(core: CoreParams, seed = Date.now() >>> 0): {
  left: SimState
  right: SimState
} {
  const dummy: SimParams = { ...core, documentationOn: false }
  const base = initState(dummy, seed)
  return { left: cloneState(base), right: cloneState(base) }
}

function pickCategory(rng: () => number): CategoryKey {
  return CAT_KEYS[Math.floor(rng() * CAT_KEYS.length)]!
}

function pickAttestationTarget(
  selfIdx: number,
  nodes: AgentNode[],
  rng: () => number,
  collaborationBias: number,
): number {
  const n = nodes.length
  const others: number[] = []
  for (let j = 0; j < n; j++) {
    if (j !== selfIdx) others.push(j)
  }
  const collaborators = others.filter(
    (j) => (nodes[selfIdx]!.links.get(nodes[j]!.id)?.weight ?? 0) > 0,
  )
  if (collaborators.length > 0 && rng() < collaborationBias) {
    return collaborators[Math.floor(rng() * collaborators.length)]!
  }
  return others[Math.floor(rng() * others.length)]!
}

function addBidirectionalLink(a: AgentNode, b: AgentNode): void {
  const la = a.links.get(b.id) ?? { weight: 0, attestationCount: 0 }
  la.weight += 1
  la.attestationCount += 1
  a.links.set(b.id, la)
  const lb = b.links.get(a.id) ?? { weight: 0, attestationCount: 0 }
  lb.weight += 1
  lb.attestationCount += 1
  b.links.set(a.id, lb)
}

function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
}

export function runTick(state: SimState, params: SimParams): SimState {
  const { documentationOn, ...core } = params
  const rng = rngForTick(state.seed, state.tick)
  const out = advanceSynchronizedPair(cloneState(state), cloneState(state), core, rng)
  return documentationOn ? out.right : out.left
}

export type PairedAdvanceResult = {
  left: SimState
  right: SimState
  meta: TickMeta
  eventsLeft: string[]
  eventsRight: string[]
  settlementArcs: { a: string; b: string }[]
}

/** Documented settlement: weight ∝ tracesLogged^1.2 */
function allocateByTracePower(ids: number[], nodes: AgentNode[], pool: number): Map<number, number> {
  const m = new Map<number, number>()
  const eps = 0.25
  const weights = ids.map((i) => Math.pow(Math.max(eps, nodes[i]!.tracesLogged), 1.2))
  const wsum = weights.reduce((a, b) => a + b, 0)
  if (wsum <= 0 || ids.length === 0) return m
  let allocated = 0
  for (let k = 0; k < ids.length; k++) {
    const i = ids[k]!
    const portion =
      k === ids.length - 1 ? pool - allocated : Math.floor((pool * weights[k]!) / wsum)
    m.set(i, portion)
    allocated += portion
  }
  return m
}

function allocateEqual(ids: number[], pool: number): Map<number, number> {
  const m = new Map<number, number>()
  const base = Math.floor(pool / ids.length)
  let rem = pool - base * ids.length
  for (let k = 0; k < ids.length; k++) {
    m.set(ids[k]!, base + (rem > 0 ? 1 : 0))
    if (rem > 0) rem--
  }
  return m
}

/** Undocumented settlement: units allocated by roulette weighted reputation^1.8 */
function allocateReputationPower(
  ids: number[],
  nodes: AgentNode[],
  pool: number,
  rng: () => number,
  pow: number,
): Map<number, number> {
  const m = new Map<number, number>()
  for (const i of ids) m.set(i, 0)
  for (let c = 0; c < pool; c++) {
    const weights = ids.map((i) => Math.pow(nodes[i]!.reputation, pow))
    const sum = weights.reduce((a, b) => a + b, 0)
    if (sum <= 0) continue
    let r = rng() * sum
    for (let k = 0; k < ids.length; k++) {
      r -= weights[k]!
      if (r <= 0) {
        const i = ids[k]!
        m.set(i, (m.get(i) ?? 0) + 1)
        break
      }
    }
  }
  return m
}

export function advanceSynchronizedPair(
  leftIn: SimState,
  rightIn: SimState,
  core: CoreParams,
  rng: () => number,
): PairedAdvanceResult {
  const left = cloneState(leftIn)
  const right = cloneState(rightIn)
  const nextTick = left.tick + 1
  left.tick = nextTick
  right.tick = nextTick

  const flashNodeIds: string[] = []
  const eventsLeft: string[] = []
  const eventsRight: string[] = []
  let docIndependentAttestation = false
  let undocUndercreditedAlias: string | null = null
  const settlementArcs: { a: string; b: string }[] = []

  for (const n of left.nodes) n.isActive = false
  for (const n of right.nodes) n.isActive = false

  const activeIdx: number[] = []
  for (let i = 0; i < left.nodes.length; i++) {
    if (rng() < core.activityRate) {
      left.nodes[i]!.isActive = true
      right.nodes[i]!.isActive = true
      activeIdx.push(i)
    }
  }

  for (const i of activeIdx) {
    const traceCount = 1 + Math.floor(rng() * 4)
    const cat = pickCategory(rng)

    left.nodes[i]!.cumulativeWork += traceCount
    right.nodes[i]!.cumulativeWork += traceCount

    left.nodes[i]!.reputation = clampRep(left.nodes[i]!.reputation + 1)
    left.nodes[i]!.categories[cat]++
    eventsLeft.push(`${left.nodes[i]!.alias} worked (${traceCount} unlogged traces)`)

    right.nodes[i]!.tracesLogged += traceCount
    right.nodes[i]!.reputation = clampRep(
      right.nodes[i]!.reputation + traceCount * core.traceGain,
    )
    right.nodes[i]!.categories[cat]++
    right.lifetimeTraces += traceCount
    flashNodeIds.push(left.nodes[i]!.id)

    const traceVerb = ['fabrication', 'analysis', 'documentation', 'field'][traceCount % 4]
    eventsRight.push(`${right.nodes[i]!.alias} logged ${traceVerb} trace`)
  }

  for (const i of activeIdx) {
    if (rng() >= core.attestationRate) continue
    const j = pickAttestationTarget(i, right.nodes, rng, core.collaborationBias)
    const aR = right.nodes[i]!
    const bR = right.nodes[j]!
    const hadPrior = (aR.links.get(bR.id)?.weight ?? 0) > 0

    const attestGain = 3 + Math.floor(rng() * 5)
    addBidirectionalLink(aR, bR)
    aR.reputation = clampRep(aR.reputation + attestGain)
    bR.reputation = clampRep(bR.reputation + attestGain)

    if (!hadPrior) docIndependentAttestation = true

    const mode = hadPrior ? 'collaborator' : 'independent'
    eventsRight.push(`${aR.alias} attested ${bR.alias} (${mode})`)

    const aL = left.nodes[i]!
    const bL = left.nodes[j]!
    eventsLeft.push(`${aL.alias} ↔ ${bL.alias}: social attestation (no record)`)
  }

  let settlementContributorIds: string[] = []

  const doSettlement = nextTick % core.projectFrequency === 0 && nextTick > 0

  if (doSettlement) {
    let poolIdx = [...activeIdx]
    if (poolIdx.length < 2) {
      poolIdx = left.nodes.map((_, idx) => idx)
      shuffleInPlace(poolIdx, rng)
    } else {
      shuffleInPlace(poolIdx, rng)
    }
    const k = Math.min(poolIdx.length, 2 + Math.floor(rng() * 4))
    const contributors = poolIdx.slice(0, Math.max(2, k))

    let creditMapR: Map<number, number>
    let creditMapL: Map<number, number>

    if (core.equalSplit) {
      creditMapR = allocateEqual(contributors, core.projectCreditPool)
      creditMapL = allocateEqual(contributors, core.projectCreditPool)
    } else {
      creditMapR = allocateByTracePower(contributors, right.nodes, core.projectCreditPool)
      creditMapL = allocateReputationPower(
        contributors,
        left.nodes,
        core.projectCreditPool,
        rng,
        1.8,
      )
    }

    const sharesR: string[] = []
    const poolTotal = core.projectCreditPool

    const efforts = contributors.map((idx) => ({
      idx,
      traces: right.nodes[idx]!.tracesLogged,
      undocCredit: creditMapL.get(idx) ?? 0,
      alias: left.nodes[idx]!.alias,
    }))
    const maxTraces = efforts.reduce((m, e) => Math.max(m, e.traces), 0)
    const maxUndocCredit = efforts.reduce((m, e) => Math.max(m, e.undocCredit), 0)

    for (const idx of contributors) {
      const cr = creditMapR.get(idx) ?? 0
      const cl = creditMapL.get(idx) ?? 0
      right.nodes[idx]!.creditReceived += cr
      left.nodes[idx]!.creditReceived += cl
      sharesR.push(`${left.nodes[idx]!.alias} ${Math.round((cr / poolTotal) * 100)}%`)
    }

    const victim = efforts.find(
      (e) =>
        e.traces >= maxTraces - 1 &&
        maxTraces >= 3 &&
        e.undocCredit + 1 < maxUndocCredit * 0.35 &&
        maxUndocCredit > 2,
    )
    if (victim) undocUndercreditedAlias = victim.alias

    for (const n of right.nodes) n.tracesLogged = 0

    for (const idx of contributors) {
      left.nodes[idx]!.projectsCompleted++
      right.nodes[idx]!.projectsCompleted++
    }

    eventsLeft.push('MATERIAL MEMORY: credit settled — unverified allocation')
    eventsRight.push(`MATERIAL MEMORY: credit settled — ${sharesR.join(', ')}`)

    for (let a = 0; a < contributors.length; a++) {
      for (let b = a + 1; b < contributors.length; b++) {
        settlementArcs.push({
          a: left.nodes[contributors[a]!]!.id,
          b: left.nodes[contributors[b]!]!.id,
        })
      }
    }
    settlementContributorIds = contributors.map((i) => left.nodes[i]!.id)
  }

  const giniLeft = calculateGini(left.nodes.map((n) => n.reputation))
  const giniRight = calculateGini(right.nodes.map((n) => n.reputation))

  const meta: TickMeta = {
    tick: nextTick,
    flashNodeIds,
    settlementContributorIds,
    undocUndercreditedAlias,
    docIndependentAttestation,
    giniLeft,
    giniRight,
  }

  return { left, right, meta, eventsLeft, eventsRight, settlementArcs }
}

export function rngForTick(seed: number, tickBeforeAdvance: number): () => number {
  return mulberry32(hashSeed(seed, tickBeforeAdvance))
}
