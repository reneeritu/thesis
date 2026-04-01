type TimelineEntry = {
  kind: 'trace' | 'reference' | 'pivot' | 'veto'
  timestamp: number
  data: Record<string, unknown>
}

const KIND_STYLE: Record<string, string> = {
  trace: 'bg-black text-yellow-400',
  reference: 'bg-grey-200 text-black',
  pivot: 'bg-yellow-400 text-black',
  veto: 'bg-black text-white',
}

function summary(item: TimelineEntry): string {
  const d = item.data
  if (item.kind === 'trace') return String(d.description || d.activityType || '')
  if (item.kind === 'reference') return String(d.relationshipType || '')
  if (item.kind === 'pivot') return String((d.reason as string) || '').slice(0, 120)
  return String(d.vetoType || '')
}

type Props = {
  entries: TimelineEntry[]
}

export type { TimelineEntry }

export function ProjectTimeline({ entries }: Props) {
  if (entries.length === 0) {
    return <p className="text-small text-grey-400 font-mono">Empty.</p>
  }

  return (
    <div className="space-y-1">
      {entries.map((item, idx) => (
        <details
          key={`${item.kind}-${idx}`}
          className="border border-grey-200 bg-white"
          open={idx === 0}
        >
          <summary className="flex flex-wrap items-center gap-2 px-3 py-2 cursor-pointer text-small">
            <span
              className={`inline-block px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.16em] ${KIND_STYLE[item.kind]}`}
            >
              {item.kind}
            </span>
            <span className="font-mono text-[11px]">{String(item.data.nodeAlias || '')}</span>
            <span className="font-mono text-[11px] text-grey-400">
              {new Date(item.timestamp).toISOString()}
            </span>
            <span className="text-[11px] truncate max-w-[50%]">{summary(item)}</span>
          </summary>
          <pre className="px-3 py-2 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap break-all bg-grey-100">
            {JSON.stringify(item.data, null, 2)}
          </pre>
        </details>
      ))}
    </div>
  )
}
