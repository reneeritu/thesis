import { useEffect, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { api } from '../lib/api'
import { ProjectTimeline, type TimelineEntry } from '../components/contracts/ProjectTimeline'
import { TraceForm } from '../components/contracts/TraceForm'
import { ReferenceForm } from '../components/contracts/ReferenceForm'
import { PivotForm } from '../components/contracts/PivotForm'
import { VetoForm } from '../components/contracts/VetoForm'
import { ForkForm } from '../components/contracts/ForkForm'
import { CreditForm } from '../components/contracts/CreditForm'

type Contributor = {
  alias: string
  role?: string
  isPrimary?: boolean
}

type Project = {
  _id: string
  title: string
  status: string
  spaceId: string
  contributors?: Contributor[]
}

type TraceRow = { _id: string; activityType?: string; description?: string; nodeAlias?: string; timestamp?: string; createdAt?: string; [k: string]: unknown }
type RefRow = { _id: string; relationshipType?: string; nodeAlias?: string; createdAt?: string; [k: string]: unknown }
type PivotRow = { _id: string; reason?: string; nodeAlias?: string; createdAt?: string; [k: string]: unknown }
type VetoRow = { _id: string; vetoType?: string; nodeAlias?: string; createdAt?: string; [k: string]: unknown }

type NftCredit = { nft: { _id: string } }

type ActiveForm = 'trace' | 'reference' | 'pivot' | 'veto' | 'fork' | 'credit' | null

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [traces, setTraces] = useState<TraceRow[]>([])
  const [nftId, setNftId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeForm, setActiveForm] = useState<ActiveForm>(null)
  const [loadKey, setLoadKey] = useState(0)

  const reload = useCallback(() => setLoadKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      try {
        const p = await api<Project>('/projects/' + encodeURIComponent(id))
        if (cancelled) return
        setProject(p)

        const [traceRes, refRes, pivotRes, vetoRes] = await Promise.all([
          api<TraceRow[]>('/traces/project/' + encodeURIComponent(id)).catch(() => [] as TraceRow[]),
          api<RefRow[]>('/references/project/' + encodeURIComponent(id)).catch(() => [] as RefRow[]),
          api<PivotRow[]>('/pivots/project/' + encodeURIComponent(id)).catch(() => [] as PivotRow[]),
          api<VetoRow[]>('/vetos/project/' + encodeURIComponent(id)).catch(() => [] as VetoRow[]),
        ])
        if (cancelled) return

        setTraces(traceRes)

        const entries: TimelineEntry[] = []
        for (const t of traceRes) {
          entries.push({
            kind: 'trace',
            timestamp: new Date(t.timestamp || t.createdAt || 0).getTime(),
            data: t as unknown as Record<string, unknown>,
          })
        }
        for (const r of refRes) {
          entries.push({
            kind: 'reference',
            timestamp: new Date(r.createdAt || 0).getTime(),
            data: r as unknown as Record<string, unknown>,
          })
        }
        for (const pv of pivotRes) {
          entries.push({
            kind: 'pivot',
            timestamp: new Date(pv.createdAt || 0).getTime(),
            data: pv as unknown as Record<string, unknown>,
          })
        }
        for (const v of vetoRes) {
          entries.push({
            kind: 'veto',
            timestamp: new Date(v.createdAt || 0).getTime(),
            data: v as unknown as Record<string, unknown>,
          })
        }
        entries.sort((a, b) => a.timestamp - b.timestamp)
        setTimeline(entries)

        if (p.status === 'completed') {
          try {
            const cr = await api<NftCredit>('/credits/project/' + encodeURIComponent(id))
            if (!cancelled && cr?.nft?._id) setNftId(cr.nft._id)
          } catch { /* no credit yet */ }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load project')
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, loadKey])

  const isActive = project?.status === 'active'
  const contributors = project?.contributors ?? []

  function toggle(form: ActiveForm) {
    setActiveForm((prev) => (prev === form ? null : form))
  }

  const actionBtn = (label: string, form: ActiveForm, variant: 'secondary' | 'danger' = 'secondary') => (
    <button
      type="button"
      onClick={() => toggle(form)}
      className={`px-3 py-1 text-[11px] font-mono uppercase tracking-[0.16em] border border-black transition ${
        activeForm === form
          ? 'bg-black text-yellow-400'
          : variant === 'danger'
            ? 'bg-grey-100 hover:bg-black hover:text-yellow-400'
            : 'bg-white hover:bg-black hover:text-yellow-400'
      }`}
    >
      {label}
    </button>
  )

  return (
    <AppShell title={project?.title || 'Project'}>
      <div className="space-y-4">
        {error && (
          <p className="border border-black bg-grey-100 px-3 py-2 text-small font-mono text-black" role="alert">
            {error}
          </p>
        )}

        {project ? (
          <>
            <section className="flex flex-wrap items-center gap-3">
              <span className="inline-block border border-black bg-black px-2 py-1 text-[11px] font-mono uppercase tracking-[0.16em] text-yellow-400">
                {project.status}
              </span>
              <span className="text-small text-grey-400 font-mono break-all">
                {project._id}
              </span>
              {nftId && (
                <Link
                  to={`/nfts/${encodeURIComponent(nftId)}`}
                  className="border border-black bg-yellow-400 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.16em] text-black hover:bg-black hover:text-yellow-400 transition"
                >
                  View Provenance Record
                </Link>
              )}
            </section>

            {/* Contributors */}
            <section className="space-y-2">
              <h2 className="text-small font-mono uppercase tracking-[0.18em] text-grey-400">
                Contributors
              </h2>
              {contributors.length ? (
                <ul className="space-y-1 text-small font-mono">
                  {contributors.map((c) => (
                    <li key={c.alias}>
                      {c.alias}{' '}
                      {c.role ? <span className="text-grey-400">({c.role})</span> : null}{' '}
                      {c.isPrimary ? (
                        <span className="inline-block border border-black bg-black px-1 py-0.5 text-[10px] uppercase tracking-[0.16em] text-yellow-400">
                          Primary
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-small text-grey-400">—</p>
              )}
            </section>

            {/* Action bar */}
            {isActive && (
              <section className="flex flex-wrap gap-2">
                {actionBtn('Log Work', 'trace')}
                {actionBtn('Add Reference', 'reference')}
                {actionBtn('Record Pivot', 'pivot')}
                {actionBtn('Raise Veto', 'veto', 'danger')}
                {actionBtn('Fork', 'fork')}
                {actionBtn('End Project', 'credit', 'danger')}
              </section>
            )}
            {!isActive && project.status === 'completed' && (
              <section className="flex flex-wrap gap-2">
                {actionBtn('Credit / Sign', 'credit')}
              </section>
            )}

            {/* Active contract form */}
            {activeForm === 'trace' && <TraceForm projectId={project._id} onDone={reload} />}
            {activeForm === 'reference' && <ReferenceForm projectId={project._id} onDone={reload} />}
            {activeForm === 'pivot' && <PivotForm projectId={project._id} onDone={reload} />}
            {activeForm === 'veto' && <VetoForm projectId={project._id} traces={traces} onDone={reload} />}
            {activeForm === 'fork' && <ForkForm projectId={project._id} onDone={reload} />}
            {activeForm === 'credit' && (
              <CreditForm projectId={project._id} contributors={contributors} onDone={reload} />
            )}

            {/* Timeline */}
            <section className="space-y-2">
              <h2 className="text-small font-mono uppercase tracking-[0.18em] text-grey-400">
                Timeline
              </h2>
              <ProjectTimeline entries={timeline} />
            </section>

            <p className="pt-2">
              <Link
                to={`/archive/new?space=${encodeURIComponent(project.spaceId)}`}
                className="font-mono text-small underline underline-offset-4"
              >
                Archive past work in this space
              </Link>
            </p>
          </>
        ) : !error ? (
          <p className="text-small font-mono text-grey-400">Loading…</p>
        ) : null}
      </div>
    </AppShell>
  )
}
