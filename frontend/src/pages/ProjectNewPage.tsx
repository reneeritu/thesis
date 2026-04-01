import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
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

export default function ProjectNewPage() {
  const [search] = useSearchParams()
  const [spaces, setSpaces] = useState<SpaceWithName[]>([])
  const [spaceId, setSpaceId] = useState<string>('')
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
    const fd = new FormData(e.currentTarget)
    const title = String(fd.get('title') ?? '').trim()
    const space = String(fd.get('spaceId') ?? '').trim()
    const contrib = String(fd.get('contrib') ?? '')
    const mentorAlias = String(fd.get('mentorAlias') ?? '').trim()
    try {
      const lines = contrib
        .split(/\n/)
        .map((x) => x.trim())
        .filter(Boolean)
      const contributors = lines.map((a) => ({ alias: a, role: 'contributor' as const }))
      const body: {
        title: string
        spaceId: string
        contributors: { alias: string; role: string }[]
        mentorAlias?: string
      } = {
        title,
        spaceId: space,
        contributors,
      }
      if (mentorAlias) body.mentorAlias = mentorAlias
      const pr = await api<Project>('/projects', {
        method: 'POST',
        body,
      })
      window.location.href = `/projects/${encodeURIComponent(pr._id)}`
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create project')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell title="New project">
      <form onSubmit={onSubmit} className="max-w-lg space-y-4">
        {error ? (
          <p className="border border-black bg-grey-100 px-3 py-2 text-small font-mono text-black" role="alert">
            {error}
          </p>
        ) : null}
        <div>
          <label className="block text-small font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">
            Title
          </label>
          <input
            name="title"
            required
            className="w-full border border-black bg-white px-3 py-2 text-body font-sans"
          />
        </div>
        <div>
          <label className="block text-small font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">
            Space
          </label>
          <select
            name="spaceId"
            required
            value={spaceId}
            onChange={(e) => setSpaceId(e.target.value)}
            className="w-full border border-black bg-white px-3 py-2 text-body font-sans"
          >
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-small font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">
            Contributors (one alias per line)
          </label>
          <textarea
            name="contrib"
            rows={4}
            className="w-full border border-black bg-white px-3 py-2 text-small font-mono"
          />
        </div>
        <div>
          <label className="block text-small font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">
            Mentor alias (optional)
          </label>
          <input
            name="mentorAlias"
            className="w-full border border-black bg-white px-3 py-2 text-body font-sans"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="border border-black bg-yellow-400 px-6 py-2 font-mono text-small uppercase tracking-[0.2em] text-black hover:bg-black hover:text-yellow-400 transition disabled:opacity-70"
        >
          {saving ? 'Creating…' : 'Create project'}
        </button>
      </form>
    </AppShell>
  )
}

