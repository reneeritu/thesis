import { useState } from 'react'

type TimelineEntry = {
  kind: 'trace' | 'reference' | 'pivot' | 'veto'
  timestamp: number
  data: Record<string, unknown>
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

function TraceCard({ data }: { data: Record<string, unknown> }) {
  const [showRaw, setShowRaw] = useState(false)
  const mediaId = String(data.mediaId ?? '')
  const mediaHash = String(data.mediaHash ?? '')
  const hasProof = mediaId.length === 24 || mediaHash.length > 0

  function apiBase() {
    const m = document.querySelector('meta[name="aura-api-base"]')
    const b = m?.getAttribute('content')
    if (b?.trim()) return b.replace(/\/$/, '')
    return window.location.origin.replace(/\/$/, '')
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] font-sans">
        <span className="text-grey-400">Activity</span>
        <span className="font-mono uppercase tracking-[0.12em]">
          {String(data.activityType || '—').replace(/_/g, ' ')}
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

      {/* Proof section */}
      {hasProof ? (
        <div className="border border-black bg-white p-3 space-y-1.5 mt-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-grey-400">
            ✓ Proof attached
          </p>
          {mediaId.length === 24 && (
            <div className="space-y-1">
              <p className="font-mono text-[11px]">
                <span className="text-grey-400">Media ID: </span>
                <span className="tracking-wider">{mediaId}</span>
              </p>
              <a
                href={`${apiBase()}/media/${mediaId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block border border-black bg-black text-yellow-400 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] hover:bg-yellow-400 hover:text-black transition"
              >
                View / Download Proof →
              </a>
            </div>
          )}
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

      <button
        type="button"
        onClick={() => setShowRaw((v) => !v)}
        className="font-mono text-[10px] text-grey-400 underline hover:text-black"
      >
        {showRaw ? 'Hide raw data' : 'Show raw chain data'}
      </button>
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

type Props = { entries: TimelineEntry[] }

export type { TimelineEntry }

export function ProjectTimeline({ entries }: Props) {
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
      {entries.map((item, idx) => (
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
          </summary>
          <div className="px-3 py-3 border-t border-grey-100 text-small">
            {item.kind === 'trace' && <TraceCard data={item.data} />}
            {item.kind === 'reference' && <ReferenceCard data={item.data} />}
            {item.kind === 'pivot' && <PivotCard data={item.data} />}
            {item.kind === 'veto' && <VetoCard data={item.data} />}
          </div>
        </details>
      ))}
    </div>
  )
}
