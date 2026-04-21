import { useEffect, useState, type FormEvent } from 'react'
import { AppShell } from '../components/AppShell'
import { CrystalRadar3D } from '../components/CrystalRadar3D'
import { api } from '../lib/api'
import { getAlias } from '../lib/session'

type CompletedProject = {
  title: string
  nftId?: string
  projectId?: string
}

type SpaceWithName = {
  id: string
  name: string
}

type NodeProfile = {
  alias: string
  reputationScore?: number
  reputationCategories?: {
    craft?: number
    research?: number
    collaboration?: number
    pedagogy?: number
    consistency?: number
    community?: number
  }
  badges?: string[]
  keywords?: string[]
  interests?: string[]
  portfolioUrl?: string
  completedProjects?: CompletedProject[]
  spacesWithNames?: SpaceWithName[]
}

type ProfileForm = {
  interests: string
  portfolioUrl: string
  keywords: string
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<NodeProfile | null>(null)
  const [form, setForm] = useState<ProfileForm>({
    interests: '',
    portfolioUrl: '',
    keywords: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const alias = getAlias()
        const me = await api<NodeProfile>('/nodes/' + encodeURIComponent(alias))
        if (!cancelled) {
          setProfile(me)
          setForm({
            interests: (me.interests || []).join(', '),
            portfolioUrl: me.portfolioUrl || '',
            keywords: (me.keywords || []).join(', '),
          })
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load profile')
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const rawInterests = form.interests
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const rawKeywords = form.keywords
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      await api('/nodes/me', {
        method: 'PATCH',
        body: {
          interests: rawInterests,
          portfolioUrl: form.portfolioUrl || '',
          keywords: rawKeywords,
        },
      })
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const spaces = profile?.spacesWithNames ?? []
  const completed = profile?.completedProjects ?? []
  const badges = profile?.badges ?? []

  return (
    <AppShell title="Profile">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <section className="space-y-3">
          {profile ? (
            <>
              <p className="text-small font-mono uppercase tracking-[0.18em] text-grey-400">
                Node
              </p>
              <p className="text-h3 font-mono">{profile.alias}</p>
              <div className="max-w-[380px] border border-black bg-white p-3 text-black">
                <CrystalRadar3D categories={profile.reputationCategories} className="w-full" />
              </div>
              {profile.reputationScore != null ? (
                <p className="text-small font-mono">
                  CURRENT SCORE — <span className="font-mono">{profile.reputationScore}</span>
                </p>
              ) : (
                <p className="text-small text-grey-400">
                  Score is only visible on your own profile.
                </p>
              )}
              {badges.length ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  {badges.map((b) => (
                    <span
                      key={b}
                      className="border border-black bg-black px-2 py-1 text-[11px] font-mono uppercase tracking-[0.16em] text-yellow-400"
                    >
                      {String(b).toUpperCase()}
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-small font-mono text-grey-400">Loading profile…</p>
          )}

          <div>
            <h2 className="mb-2 text-small font-mono uppercase tracking-[0.18em] text-grey-400">
              Spaces
            </h2>
            {spaces.length ? (
              <ul className="space-y-1 text-small">
                {spaces.map((s) => (
                  <li key={s.id} className="truncate font-mono">
                    {s.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-small text-grey-400">No spaces listed.</p>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="mb-2 text-small font-mono uppercase tracking-[0.18em] text-grey-400">
              Statement / Keywords
            </h2>
            <p className="text-body text-grey-400">
              {profile?.keywords?.length ? profile.keywords.join(', ') : '—'}
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-small font-mono uppercase tracking-[0.18em] text-grey-400">
              Interests
            </h2>
            {profile?.interests?.length ? (
              <ul className="mt-0 list-disc pl-5 text-small text-grey-800">
                {profile.interests.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            ) : (
              <p className="text-small text-grey-400">—</p>
            )}
          </div>

          <div>
            <h2 className="mb-2 text-small font-mono uppercase tracking-[0.18em] text-grey-400">
              Links
            </h2>
            {profile?.portfolioUrl ? (
              <a
                href={profile.portfolioUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-small font-mono underline underline-offset-4"
              >
                Portfolio
              </a>
            ) : (
              <p className="text-small text-grey-400">—</p>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="mb-2 text-small font-mono uppercase tracking-[0.18em] text-grey-400">
              Profile settings
            </h2>
            <form onSubmit={onSubmit} className="space-y-3 text-small">
              {error ? (
                <p className="border border-black bg-grey-100 px-3 py-2 font-mono text-black" role="alert">
                  {error}
                </p>
              ) : null}
              {saved && !error ? (
                <p className="border border-black bg-white px-3 py-2 font-mono text-black">
                  Saved.
                </p>
              ) : null}
              <div>
                <label className="block font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">
                  Interests (comma-separated)
                </label>
                <input
                  name="interests"
                  value={form.interests}
                  onChange={(e) => setForm((f) => ({ ...f, interests: e.target.value }))}
                  className="w-full border border-black bg-white px-3 py-2 text-body font-sans"
                />
              </div>
              <div>
                <label className="block font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">
                  Portfolio URL
                </label>
                <input
                  name="portfolioUrl"
                  value={form.portfolioUrl}
                  onChange={(e) => setForm((f) => ({ ...f, portfolioUrl: e.target.value }))}
                  className="w-full border border-black bg-white px-3 py-2 text-body font-sans"
                />
              </div>
              <div>
                <label className="block font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">
                  Keywords (comma-separated)
                </label>
                <input
                  name="keywords"
                  value={form.keywords}
                  onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
                  className="w-full border border-black bg-white px-3 py-2 text-body font-sans"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="border border-black bg-yellow-400 px-6 py-2 font-mono text-small uppercase tracking-[0.2em] text-black hover:bg-black hover:text-yellow-400 transition disabled:opacity-70"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </form>
          </div>

          <div>
            <h2 className="mb-2 text-small font-mono uppercase tracking-[0.18em] text-grey-400">
              Completed projects
            </h2>
            {completed.length ? (
              <ul className="space-y-1 text-small">
                {completed.map((c) => (
                  <li key={`${c.projectId || c.nftId || c.title}`} className="truncate">
                    {c.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-small text-grey-400">—</p>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  )
}

