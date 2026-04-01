import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { Button } from '../components/Button'
import { api } from '../lib/api'

type SpaceSettings = {
  projectAccess?: string
  vetoAuthority?: string[]
  votingThreshold?: number
  customContractsAllowed?: boolean
  privacyDefault?: string
  contentRestrictions?: string[]
  minDocRequirements?: string[]
}

type Space = {
  _id: string
  name: string
  settings?: SpaceSettings
}

export default function SpaceSettingsPage() {
  const { id } = useParams<{ id: string }>()
  const [space, setSpace] = useState<Space | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [projectAccess, setProjectAccess] = useState('open')
  const [vetoRaw, setVetoRaw] = useState('')
  const [votingThreshold, setVotingThreshold] = useState(0.5)
  const [customContracts, setCustomContracts] = useState(true)
  const [privacyDefault, setPrivacyDefault] = useState('space_specific')
  const [restrictionsRaw, setRestrictionsRaw] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      try {
        const s = await api<Space>('/spaces/' + encodeURIComponent(id))
        if (cancelled) return
        setSpace(s)
        const st = s.settings || {}
        setProjectAccess(st.projectAccess || 'open')
        setVetoRaw((st.vetoAuthority || []).join(', '))
        setVotingThreshold(st.votingThreshold ?? 0.5)
        setCustomContracts(st.customContractsAllowed !== false)
        setPrivacyDefault(st.privacyDefault || 'space_specific')
        setRestrictionsRaw((st.contentRestrictions || []).join(', '))
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load space')
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!id) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await api('/spaces/' + encodeURIComponent(id) + '/settings', {
        method: 'PATCH',
        body: {
          projectAccess,
          vetoAuthority: vetoRaw.split(',').map((s) => s.trim()).filter(Boolean),
          votingThreshold,
          customContractsAllowed: customContracts,
          privacyDefault,
          contentRestrictions: restrictionsRaw.split(',').map((s) => s.trim()).filter(Boolean),
        },
      })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell title={space ? `${space.name} — Settings` : 'Space Settings'}>
      <div className="max-w-lg space-y-4">
        {error && (
          <p className="border border-black bg-grey-100 px-3 py-2 text-small font-mono" role="alert">{error}</p>
        )}
        {saved && !error && (
          <p className="border border-black bg-white px-3 py-2 text-small font-mono">Saved.</p>
        )}

        {space ? (
          <form onSubmit={onSubmit} className="space-y-4 text-small">
            <div>
              <p className="font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">Project access</p>
              {(['open', 'invite_only', 'application'] as const).map((v) => (
                <label key={v} className="flex items-center gap-2 font-mono">
                  <input
                    type="radio"
                    name="projectAccess"
                    value={v}
                    checked={projectAccess === v}
                    onChange={() => setProjectAccess(v)}
                  />
                  {v}
                </label>
              ))}
            </div>

            <div>
              <label className="block font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">
                Veto authority (comma-separated aliases)
              </label>
              <input
                value={vetoRaw}
                onChange={(e) => setVetoRaw(e.target.value)}
                className="w-full border border-black bg-white px-3 py-2 font-mono text-small"
              />
            </div>

            <div>
              <label className="block font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">
                Voting threshold (0 – 1)
              </label>
              <input
                type="number"
                step={0.05}
                min={0}
                max={1}
                value={votingThreshold}
                onChange={(e) => setVotingThreshold(Number(e.target.value))}
                className="w-full border border-black bg-white px-3 py-2 font-mono text-small"
              />
            </div>

            <label className="flex items-center gap-2 font-mono">
              <input
                type="checkbox"
                checked={customContracts}
                onChange={(e) => setCustomContracts(e.target.checked)}
              />
              Custom contracts allowed
            </label>

            <div>
              <p className="font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">Privacy default</p>
              {(['public', 'space_specific', 'private'] as const).map((v) => (
                <label key={v} className="flex items-center gap-2 font-mono">
                  <input
                    type="radio"
                    name="privacyDefault"
                    value={v}
                    checked={privacyDefault === v}
                    onChange={() => setPrivacyDefault(v)}
                  />
                  {v}
                </label>
              ))}
            </div>

            <div>
              <label className="block font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">
                Content restrictions (comma-separated)
              </label>
              <input
                value={restrictionsRaw}
                onChange={(e) => setRestrictionsRaw(e.target.value)}
                className="w-full border border-black bg-white px-3 py-2 font-mono text-small"
              />
            </div>

            <Button type="submit" variant="primary" loading={saving}>Save Settings</Button>
          </form>
        ) : !error ? (
          <p className="text-small font-mono text-grey-400">Loading…</p>
        ) : null}
      </div>
    </AppShell>
  )
}
