import { api } from './api'

export type SimStatus = 'idle' | 'seeding' | 'running' | 'paused' | 'complete' | 'failed'

export type SimEvent = {
  tick: number
  type: string
  human: string
  refs?: { kind: string; id: string }[]
}

export type SimCounters = {
  blocksWritten: number
  tracesLogged: number
  flagsFiled: number
  mediationsResolved: number
  nftsMinted: number
  governancePassed: number
}

export type SimSnapshot = {
  simRunId: string
  currentTick: number
  status: SimStatus
  events: SimEvent[]
  counters: SimCounters
  spaceIds: string[]
  projectIds: string[]
  heroNodeAliases: string[]
  startedAt?: string
  updatedAt: string
}

export const simApi = {
  run: (simRunId?: string) =>
    api<{ simRunId: string; status: SimStatus }>('/sim/run', {
      method: 'POST',
      body: simRunId ? { simRunId } : {},
    }),
  status: (simRunId: string) =>
    api<SimSnapshot>(`/sim/status/${encodeURIComponent(simRunId)}`),
  pause: (simRunId: string) =>
    api<SimSnapshot>(`/sim/pause/${encodeURIComponent(simRunId)}`, { method: 'POST' }),
  resume: (simRunId: string) =>
    api<SimSnapshot>(`/sim/resume/${encodeURIComponent(simRunId)}`, { method: 'POST' }),
  reset: (simRunId: string) =>
    api<{ message: string }>(`/sim/reset/${encodeURIComponent(simRunId)}`, { method: 'POST' }),
}

export function isSimMode(): boolean {
  return String(import.meta.env.VITE_SIM_MODE ?? '').toLowerCase() === 'on'
}

export type SimSpaceSummary = {
  _id: string
  name: string
  description?: string
  parentSpaceId?: string | null
  members?: string[]
  admins?: string[]
  settings?: {
    projectAccess?: string
    privacyDefault?: string
    minDocRequirements?: string[]
    enforceStrictMinDoc?: boolean
    customContracts?: Array<{ title: string; body: string; authorAlias: string }>
    vetoAuthority?: string[]
  }
}

export type SimNodeSummary = {
  _id: string
  alias: string
  reputationScore?: number
  reputationCategories?: Record<string, number>
  badges?: string[]
  status?: string
  spaces?: string[]
}

export type SimProjectSummary = {
  _id: string
  title: string
  spaceId: string
  creatorAlias: string
  status: string
  visibility: string
  contributors: Array<{ alias: string; role: string; isPrimary: boolean }>
  parentProjectId?: string | null
}

export const simEntityApi = {
  /** Fetch a single space by id (existing route). */
  getSpace: (id: string) => api<SimSpaceSummary>(`/spaces/${id}`),
  /** Fetch a node by alias (existing route). */
  getNodeByAlias: (alias: string) => api<SimNodeSummary>(`/nodes/${encodeURIComponent(alias)}`),
  /** Fetch a project by id (existing route). */
  getProject: (id: string) => api<SimProjectSummary>(`/projects/${id}`),
  /** Fetch a list of spaces by ids in parallel — used by macro view. */
  getSpacesByIds: async (ids: string[]) => {
    if (!ids.length) return []
    const out = await Promise.all(
      ids.map((id) =>
        api<SimSpaceSummary>(`/spaces/${id}`).catch(() => null),
      ),
    )
    return out.filter((x): x is SimSpaceSummary => x !== null)
  },
  /** Fetch nodes by alias in parallel. */
  getNodesByAliases: async (aliases: string[]) => {
    if (!aliases.length) return []
    const out = await Promise.all(
      aliases.map((a) =>
        api<SimNodeSummary>(`/nodes/${encodeURIComponent(a)}`).catch(() => null),
      ),
    )
    return out.filter((x): x is SimNodeSummary => x !== null)
  },
}
