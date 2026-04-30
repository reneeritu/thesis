import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { api } from '../lib/api'
import { getAlias } from '../lib/session'

type SpaceWithName = {
  id: string
  name: string
}

type NodeProfile = {
  spacesWithNames?: SpaceWithName[]
}

type Project = {
  _id: string
}

const inputBase = 'etch-control'

const selectClass = 'etch-select'

function SelectChevron() {
  return (
    <span
      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs leading-none text-white/35"
      aria-hidden
    >
      ▾
    </span>
  )
}

function FieldHelp({ children }: { children: ReactNode }) {
  return <p className="etch-field-help">{children}</p>
}

function PedagogicalCheckbox({
  id,
  checked,
  onChange,
  label,
}: {
  id: string
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 font-mono text-base leading-snug text-white/72">
      <span className="relative mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center border border-[#555] bg-[#0a0a0f]">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="font-mono text-xs leading-none text-white opacity-0 peer-checked:opacity-100">✓</span>
      </span>
      <span>{label}</span>
    </label>
  )
}

/** Non-empty marker stored in `pedagogicalId` when the user marks a pedagogical project. */
const PEDAGOGICAL_MARKER = 'pedagogical'

export default function ProjectNewPage() {
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const [spaces, setSpaces] = useState<SpaceWithName[]>([])
  const [spaceId, setSpaceId] = useState('')
  const [title, setTitle] = useState('')
  const [context, setContext] = useState('')
  const [contribText, setContribText] = useState('')
  const [mentorAlias, setMentorAlias] = useState('')
  const [pedagogical, setPedagogical] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const alias = getAlias()
        const me = await api<NodeProfile>('/nodes/' + encodeURIComponent(alias))
        const sns = me.spacesWithNames ?? []
        let initial = sns[0]?.id || ''
        const qSpace = search.get('space')
        if (qSpace && sns.find((s) => s.id === qSpace)) {
          initial = qSpace
        }
        if (!cancelled) {
          setSpaces(sns)
          setSpaceId(initial)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load spaces')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [search])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const lines = contribText.split(/\n/).map((x) => x.trim()).filter(Boolean)
      const contributors = lines.map((a) => ({ alias: a, role: 'contributor' as const }))
      const body: {
        title: string
        spaceId: string
        contributors: { alias: string; role: string }[]
        context?: string
        pedagogicalId?: string
        mentorAlias?: string
      } = {
        title: title.trim(),
        spaceId,
        contributors,
      }
      const ctx = context.trim()
      if (ctx) body.context = ctx
      if (pedagogical) body.pedagogicalId = PEDAGOGICAL_MARKER
      const m = mentorAlias.trim()
      if (m) body.mentorAlias = m

      const pr = await api<Project>('/projects', {
        method: 'POST',
        body,
      })
      navigate(`/projects/${encodeURIComponent(pr._id)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = title.trim().length > 0 && spaceId.length > 0 && !saving

  return (
    <AppShell title="New project">
      <div className="min-h-0 min-w-0 font-mono text-white">
        <div className="grid min-h-0 grid-cols-1 gap-8 lg:grid-cols-[minmax(0,30%)_minmax(0,1fr)] lg:gap-x-8 lg:items-start">
          <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-4 lg:self-start">
            <div>
              <p className="etch-page-header m-0">New project</p>
              <p className="mt-3 font-mono text-base font-normal leading-relaxed text-[var(--text-muted)]">
                A project is a single tracked work thread. Contributors are recorded on the start block. The chain record
                begins the moment you submit.
              </p>
              <p className="mt-3 font-mono text-base font-normal leading-relaxed text-white/38">
                You can add more contributors and log traces after the project is created.
              </p>
            </div>
          </aside>

          <div className="min-w-0 max-w-full overflow-x-hidden lg:max-h-[min(100%,calc(100dvh-5.5rem))] lg:overflow-y-auto lg:pr-1">
            <form onSubmit={onSubmit} className="space-y-5 pb-10" data-target-cursor-exclude>
              {error ? (
                <p
                  className="border border-[#2a2a2a] border-l-[3px] border-l-rose-700/80 bg-[#06060a] px-3 py-2.5 font-mono text-base text-rose-100/80"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <div>
                <label htmlFor="proj-title" className="etch-field-label">
                  TITLE *
                </label>
                <input
                  id="proj-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className={inputBase}
                />
              </div>

              <div>
                <label htmlFor="proj-space" className="etch-field-label">
                  SPACE
                </label>
                <div className="relative">
                  <select
                    id="proj-space"
                    value={spaceId}
                    onChange={(e) => setSpaceId(e.target.value)}
                    required
                    disabled={spaces.length === 0}
                    className={selectClass}
                  >
                    {spaces.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <SelectChevron />
                </div>
                {spaces.length === 0 ? (
                  <FieldHelp>Join a space first to create a project.</FieldHelp>
                ) : null}
              </div>

              <div>
                <label htmlFor="proj-context" className="etch-field-label">
                  CONTEXT
                </label>
                <textarea
                  id="proj-context"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  rows={4}
                  className={`${inputBase} min-h-[5.5rem] resize-y`}
                />
                <FieldHelp>What is this project trying to do or explore?</FieldHelp>
              </div>

              <div>
                <label htmlFor="proj-contrib" className="etch-field-label">
                  CONTRIBUTORS
                </label>
                <textarea
                  id="proj-contrib"
                  value={contribText}
                  onChange={(e) => setContribText(e.target.value)}
                  rows={4}
                  placeholder="one alias per line"
                  className={`${inputBase} min-h-[5.5rem] resize-y`}
                />
                <FieldHelp>One alias per line.</FieldHelp>
                <FieldHelp>Contributors are invited to the project. They can log traces once they accept.</FieldHelp>
              </div>

              <div>
                <label htmlFor="proj-mentor" className="etch-field-label">
                  MENTOR ALIAS
                </label>
                <input
                  id="proj-mentor"
                  value={mentorAlias}
                  onChange={(e) => setMentorAlias(e.target.value)}
                  placeholder="optional"
                  className={inputBase}
                />
              </div>

              <div>
                <p className="etch-field-group-title">IS THIS A PEDAGOGICAL PROJECT?</p>
                <PedagogicalCheckbox
                  id="proj-pedagogical"
                  checked={pedagogical}
                  onChange={setPedagogical}
                  label="PEDAGOGICAL"
                />
                <FieldHelp>Marks the mentor role as elevated in the provenance record.</FieldHelp>
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="box-border w-full max-w-full rounded-sm border border-solid border-[#444] bg-transparent py-3 font-mono text-base uppercase tracking-[0.2em] text-white shadow-none ring-0 outline-none transition hover:border-white hover:bg-white hover:text-[#000] focus-visible:ring-0 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 disabled:hover:border-[#444] disabled:hover:bg-transparent disabled:hover:text-white"
              >
                {saving ? 'CREATING…' : 'CREATE PROJECT'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
