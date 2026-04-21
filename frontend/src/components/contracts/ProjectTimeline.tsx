import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MediaPreview } from '../MediaPreview'
import { api } from '../../lib/api'
import {
  CATEGORY_LABELS,
  categoryForActivity,
  colourForActivity,
} from '../../lib/reputationColours'
import { getAlias } from '../../lib/session'

type TimelineEntry = {
  kind: 'trace' | 'reference' | 'pivot' | 'veto'
  timestamp: number
  data: Record<string, unknown>
}

type Endorsement = {
  _id: string
  traceId: string
  projectId: string
  endorserAlias: string
  kind: string
  note: string
  createdAt: string
}

const KIND_LABEL: Record<string, string> = {
  trace: 'Work logged',
  reference: 'Reference',
  pivot: 'Pivot',
  veto: 'Veto raised',
}

const KIND_COLOR: Record<string, string> = {
  trace: 'bg-black text-yellow-400',
  reference: 'bg-grey-200 text-black',
  pivot: 'bg-yellow-400 text-black',
  veto: 'bg-red-700 text-white',
}

const ENDORSEMENT_KINDS = [
  { id: 'verified_presence', label: 'I was there' },
  { id: 'co_authored', label: 'Co-authored' },
  { id: 'mentored', label: 'Mentored' },
  { id: 'reviewed', label: 'Reviewed' },
] as const

const ENDORSEMENT_LABEL: Record<string, string> = Object.fromEntries(
  ENDORSEMENT_KINDS.map((k) => [k.id, k.label]),
)

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtDuration(mins: unknown): string | null {
  const n = Number(mins)
  if (!n || !Number.isFinite(n)) return null
  if (n < 60) return `${n} min`
  const h = Math.floor(n / 60)
  const m = n % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

/** Governance shortcut URL for flagging this entry from the timeline. */
function flagLink(targetType: 'trace' | 'project', targetId: string): string {
  const params = new URLSearchParams({
    category: 'dispute',
    type: 'credit_dispute',
    targetType,
    targetId,
  })
  return `/governance?${params.toString()}`
}

type TraceCardProps = {
  data: Record<string, unknown>
  endorsements: Endorsement[]
  onEndorse: (traceId: string, kind: string) => Promise<void>
  onUnendorse: (endorsementId: string) => Promise<void>
  busy: boolean
}

function TraceCard({ data, endorsements, onEndorse, onUnendorse, busy }: TraceCardProps) {
  const [showRaw, setShowRaw] = useState(false)
  const [pickingKind, setPickingKind] = useState(false)
  const mediaId = String(data.mediaId ?? '')
  const mediaHash = String(data.mediaHash ?? '')
  const mediaMime = String(data.mediaMimeType ?? data.mediaType ?? '')
  const hasProof = mediaId.length === 24 || mediaHash.length > 0
  const traceId = String(data._id ?? '')
  const authorAlias = String(data.nodeAlias ?? '')
  const me = getAlias()
  const isAuthor = !!me && me === authorAlias
  const myEndorsement = endorsements.find((e) => e.endorserAlias === me)
  const ndaSealed = Boolean(data.ndaSealed)
  const activityType = String(data.activityType || '')
  const activityCategory = categoryForActivity(activityType)
  const activityColour = colourForActivity(activityType)

  return (
    <div className="space-y-2 border-l-4 pl-3" style={{ borderColor: activityColour }}>
      {ndaSealed ? (
        <div className="border-l-2 border-black bg-grey-50 px-3 py-2 font-mono text-[11px] text-grey-600">
          Trace sealed under NDA — hidden from contributors who were not parties.
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] font-sans">
        <span className="text-grey-400">Activity</span>
        <span className="flex items-center gap-2 font-mono uppercase tracking-[0.12em]">
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full border border-black"
            style={{ backgroundColor: activityColour }}
          />
          {activityType ? activityType.replace(/_/g, ' ') : '—'}
          {activityCategory ? (
            <span className="ml-1 border border-black px-1 py-[1px] text-[9px] tracking-[0.14em] text-grey-600">
              {CATEGORY_LABELS[activityCategory]}
            </span>
          ) : null}
        </span>
        {data.description ? (
          <>
            <span className="text-grey-400">Description</span>
            <span>{String(data.description)}</span>
          </>
        ) : null}
        {data.toolSoftware ? (
          <>
            <span className="text-grey-400">Tool / software</span>
            <span>{String(data.toolSoftware)}</span>
          </>
        ) : null}
        {fmtDuration(data.duration) ? (
          <>
            <span className="text-grey-400">Duration</span>
            <span>{fmtDuration(data.duration)}</span>
          </>
        ) : null}
        {data.isProxy ? (
          <>
            <span className="text-grey-400">Proxy for</span>
            <span className="font-mono">{String(data.proxyForAlias || '—')}</span>
          </>
        ) : null}
        {data.mode ? (
          <>
            <span className="text-grey-400">Log mode</span>
            <span className="font-mono uppercase">{String(data.mode)}</span>
          </>
        ) : null}
      </div>

      {hasProof ? (
        <div className="border border-black bg-white p-3 space-y-2 mt-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-grey-400">
            ✓ Proof attached
          </p>
          {mediaId.length === 24 ? (
            <MediaPreview mediaId={mediaId} mimeType={mediaMime} hash={mediaHash || undefined} />
          ) : null}
          {mediaHash ? (
            <div className="space-y-0.5">
              <p className="font-mono text-[10px] text-grey-400 uppercase tracking-[0.12em]">
                SHA-256 fingerprint
              </p>
              <p className="font-mono text-[10px] break-all text-grey-600">{mediaHash}</p>
              <p className="font-mono text-[10px] text-grey-400">
                Compute the SHA-256 of the downloaded file. If it matches this string exactly, the file is unmodified.
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="font-mono text-[10px] text-grey-300 italic">No proof file attached.</p>
      )}

      {/* Endorsements */}
      {traceId && (
        <div className="border border-grey-200 bg-grey-50 p-2 space-y-1">
          <div className="flex items-center flex-wrap gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-grey-400">
              Endorsements
            </span>
            {endorsements.length === 0 ? (
              <span className="font-mono text-[10px] text-grey-400">—</span>
            ) : (
              endorsements.map((e) => (
                <span
                  key={e._id}
                  title={`${e.endorserAlias}: ${ENDORSEMENT_LABEL[e.kind] || e.kind}`}
                  className="inline-flex items-center gap-1 border border-black bg-white px-1.5 py-0.5 font-mono text-[10px]"
                >
                  <span className="uppercase tracking-[0.14em] text-grey-500">
                    {ENDORSEMENT_LABEL[e.kind] || e.kind}
                  </span>
                  <span>· {e.endorserAlias}</span>
                </span>
              ))
            )}
          </div>
          {!isAuthor && me ? (
            myEndorsement ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void onUnendorse(myEndorsement._id)}
                className="font-mono text-[10px] uppercase tracking-[0.14em] underline text-grey-500 hover:text-black disabled:opacity-60"
              >
                Remove my endorsement
              </button>
            ) : pickingKind ? (
              <div className="flex flex-wrap gap-1 pt-1">
                {ENDORSEMENT_KINDS.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      await onEndorse(traceId, k.id)
                      setPickingKind(false)
                    }}
                    className="border border-black px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] hover:bg-black hover:text-yellow-400 transition disabled:opacity-60"
                  >
                    {k.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPickingKind(false)}
                  className="px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-grey-400 hover:text-black"
                >
                  cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPickingKind(true)}
                className="font-mono text-[10px] uppercase tracking-[0.14em] underline hover:text-black"
                title="Vouch for this entry — e.g. 'I was there', 'I reviewed this'"
              >
                + Endorse
              </button>
            )
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-1">
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="font-mono text-[10px] text-grey-400 underline hover:text-black"
        >
          {showRaw ? 'Hide raw data' : 'Show raw chain data'}
        </button>
        {traceId ? (
          <Link
            to={flagLink('trace', traceId)}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-red-700 underline hover:text-black"
            title="Raise a flag or dispute about this entry in Governance"
          >
            Flag / dispute
          </Link>
        ) : null}
      </div>
      {showRaw && (
        <pre className="bg-grey-100 px-3 py-2 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap break-all">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}

function ReferenceCard({ data }: { data: Record<string, unknown> }) {
  const [showRaw, setShowRaw] = useState(false)
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
        <span className="text-grey-400">Relationship</span>
        <span className="font-mono">{String(data.relationshipType || '—')}</span>
        {data.targetTitle ? (
          <>
            <span className="text-grey-400">References</span>
            <span>{String(data.targetTitle)}</span>
          </>
        ) : null}
        {data.notes ? (
          <>
            <span className="text-grey-400">Notes</span>
            <span>{String(data.notes)}</span>
          </>
        ) : null}
      </div>
      <button type="button" onClick={() => setShowRaw((v) => !v)} className="font-mono text-[10px] text-grey-400 underline hover:text-black">
        {showRaw ? 'Hide raw' : 'Show raw'}
      </button>
      {showRaw && <pre className="bg-grey-100 px-3 py-2 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(data, null, 2)}</pre>}
    </div>
  )
}

function PivotCard({ data }: { data: Record<string, unknown> }) {
  const [showRaw, setShowRaw] = useState(false)
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
        <span className="text-grey-400">Reason</span>
        <span>{String(data.reason || '—')}</span>
        {data.newDirection ? (
          <>
            <span className="text-grey-400">New direction</span>
            <span>{String(data.newDirection)}</span>
          </>
        ) : null}
      </div>
      <button type="button" onClick={() => setShowRaw((v) => !v)} className="font-mono text-[10px] text-grey-400 underline hover:text-black">
        {showRaw ? 'Hide raw' : 'Show raw'}
      </button>
      {showRaw && <pre className="bg-grey-100 px-3 py-2 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(data, null, 2)}</pre>}
    </div>
  )
}

function VetoCard({ data }: { data: Record<string, unknown> }) {
  const [showRaw, setShowRaw] = useState(false)
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
        <span className="text-grey-400">Type</span>
        <span className="font-mono">{String(data.vetoType || '—')}</span>
        {data.reason ? (
          <>
            <span className="text-grey-400">Reason</span>
            <span>{String(data.reason)}</span>
          </>
        ) : null}
      </div>
      <button type="button" onClick={() => setShowRaw((v) => !v)} className="font-mono text-[10px] text-grey-400 underline hover:text-black">
        {showRaw ? 'Hide raw' : 'Show raw'}
      </button>
      {showRaw && <pre className="bg-grey-100 px-3 py-2 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(data, null, 2)}</pre>}
    </div>
  )
}

type Props = {
  entries: TimelineEntry[]
  projectId?: string
}

export type { TimelineEntry }

export function ProjectTimeline({ entries, projectId }: Props) {
  const [endorsements, setEndorsements] = useState<Endorsement[]>([])
  const [endorseBusy, setEndorseBusy] = useState(false)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    void api<Endorsement[]>('/endorsements/project/' + encodeURIComponent(projectId))
      .then((list) => {
        if (!cancelled) setEndorsements(list)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [projectId])

  async function endorse(traceId: string, kind: string) {
    setEndorseBusy(true)
    try {
      const created = await api<Endorsement>('/endorsements', {
        method: 'POST',
        body: { traceId, kind },
      })
      setEndorsements((cur) => [created, ...cur])
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not endorse')
    } finally {
      setEndorseBusy(false)
    }
  }

  async function unendorse(endorsementId: string) {
    setEndorseBusy(true)
    try {
      await api('/endorsements/' + encodeURIComponent(endorsementId), { method: 'DELETE' })
      setEndorsements((cur) => cur.filter((e) => e._id !== endorsementId))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not remove endorsement')
    } finally {
      setEndorseBusy(false)
    }
  }

  if (entries.length === 0) {
    return (
      <div className="border border-dashed border-grey-300 px-4 py-6 text-center space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-grey-400">Nothing logged yet</p>
        <p className="text-small text-grey-400">Use "Log Work" to record activity on this project. Each entry is permanently added to the chain.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {entries.map((item, idx) => {
        const itemId = String(item.data._id ?? '')
        const itemEndorsements =
          item.kind === 'trace' && itemId
            ? endorsements.filter((e) => e.traceId === itemId)
            : []
        return (
          <details
            key={`${item.kind}-${idx}`}
            className="border border-grey-200 bg-white"
            open={idx === 0}
          >
            <summary className="flex flex-wrap items-center gap-2 px-3 py-2 cursor-pointer select-none">
              <span className={`inline-block px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.16em] ${KIND_COLOR[item.kind]}`}>
                {KIND_LABEL[item.kind]}
              </span>
              <span className="font-mono text-[11px] text-grey-600">
                {String(item.data.nodeAlias || '')}
              </span>
              <span className="font-mono text-[10px] text-grey-400 ml-auto">
                {fmtDate(item.timestamp)}
              </span>
              {item.kind === 'trace' && (item.data.mediaId || item.data.mediaHash) ? (
                <span className="inline-block px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.12em] border border-black bg-yellow-400 text-black">
                  proof
                </span>
              ) : null}
              {item.kind === 'trace' && itemEndorsements.length > 0 ? (
                <span className="inline-block px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.12em] border border-grey-400">
                  +{itemEndorsements.length}
                </span>
              ) : null}
            </summary>
            <div className="px-3 py-3 border-t border-grey-100 text-small">
              {item.kind === 'trace' && (
                <TraceCard
                  data={item.data}
                  endorsements={itemEndorsements}
                  onEndorse={endorse}
                  onUnendorse={unendorse}
                  busy={endorseBusy}
                />
              )}
              {item.kind === 'reference' && <ReferenceCard data={item.data} />}
              {item.kind === 'pivot' && <PivotCard data={item.data} />}
              {item.kind === 'veto' && <VetoCard data={item.data} />}
            </div>
          </details>
        )
      })}
    </div>
  )
}
