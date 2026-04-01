import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { Button } from '../components/Button'
import { api } from '../lib/api'

type SpaceData = {
  name: string
  description: string
  projectAccess: string
  vetoAuthority: string[]
  votingThreshold: number
  customContractsAllowed: boolean
  privacyDefault: string
  contentRestrictions: string[]
}

const INITIAL: SpaceData = {
  name: '',
  description: '',
  projectAccess: 'open',
  vetoAuthority: [],
  votingThreshold: 0.5,
  customContractsAllowed: true,
  privacyDefault: 'space_specific',
  contentRestrictions: [],
}

export default function SpaceNewPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<SpaceData>(INITIAL)
  const [vetoRaw, setVetoRaw] = useState('')
  const [restrictionsRaw, setRestrictionsRaw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function next() { setStep((s) => s + 1) }
  function back() { setStep((s) => Math.max(1, s - 1)) }

  const bar = (
    <div className="flex gap-1 mb-4">
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          className={`h-1 flex-1 ${n <= step ? 'bg-black' : 'bg-grey-200'}`}
        />
      ))}
    </div>
  )

  async function create() {
    setBusy(true)
    setError(null)
    try {
      const out = await api<{ _id: string }>('/spaces', {
        method: 'POST',
        body: {
          name: data.name,
          description: data.description || '',
          settings: {
            projectAccess: data.projectAccess,
            vetoAuthority: data.vetoAuthority,
            votingThreshold: data.votingThreshold,
            customContractsAllowed: data.customContractsAllowed,
            privacyDefault: data.privacyDefault,
            contentRestrictions: data.contentRestrictions,
          },
        },
      })
      navigate('/spaces/' + encodeURIComponent(out._id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create space')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell title="Create Space">
      <div className="max-w-lg space-y-4">
        {bar}

        {error && (
          <p className="border border-black bg-grey-100 px-3 py-2 text-small font-mono" role="alert">{error}</p>
        )}

        {step === 1 && (
          <form
            onSubmit={(e) => { e.preventDefault(); next() }}
            className="space-y-3 text-small"
          >
            <div>
              <label className="block font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">Name</label>
              <input
                value={data.name}
                onChange={(e) => setData((d) => ({ ...d, name: e.target.value }))}
                required
                className="w-full border border-black bg-white px-3 py-2 font-sans text-body"
              />
            </div>
            <div>
              <label className="block font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">Description</label>
              <textarea
                value={data.description}
                onChange={(e) => setData((d) => ({ ...d, description: e.target.value }))}
                rows={3}
                className="w-full border border-black bg-white px-3 py-2 font-sans text-body"
              />
            </div>
            <Button type="submit" variant="primary">Next</Button>
          </form>
        )}

        {step === 2 && (
          <form
            onSubmit={(e) => { e.preventDefault(); next() }}
            className="space-y-3 text-small"
          >
            <p className="font-mono uppercase tracking-[0.18em] text-grey-400">Who can start a project?</p>
            {(['open', 'invite_only', 'application'] as const).map((v) => (
              <label key={v} className="flex items-center gap-2 font-mono">
                <input
                  type="radio"
                  name="projectAccess"
                  value={v}
                  checked={data.projectAccess === v}
                  onChange={() => setData((d) => ({ ...d, projectAccess: v }))}
                />
                {v}
              </label>
            ))}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={back}>Back</Button>
              <Button type="submit" variant="primary">Next</Button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setData((d) => ({
                ...d,
                vetoAuthority: vetoRaw.split(',').map((s) => s.trim()).filter(Boolean),
              }))
              next()
            }}
            className="space-y-3 text-small"
          >
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
                value={data.votingThreshold}
                onChange={(e) => setData((d) => ({ ...d, votingThreshold: Number(e.target.value) }))}
                className="w-full border border-black bg-white px-3 py-2 font-mono text-small"
              />
            </div>
            <label className="flex items-center gap-2 font-mono">
              <input
                type="checkbox"
                checked={data.customContractsAllowed}
                onChange={(e) => setData((d) => ({ ...d, customContractsAllowed: e.target.checked }))}
              />
              Custom contracts allowed
            </label>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={back}>Back</Button>
              <Button type="submit" variant="primary">Next</Button>
            </div>
          </form>
        )}

        {step === 4 && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setData((d) => ({
                ...d,
                contentRestrictions: restrictionsRaw.split(',').map((s) => s.trim()).filter(Boolean),
              }))
              next()
            }}
            className="space-y-3 text-small"
          >
            <p className="font-mono uppercase tracking-[0.18em] text-grey-400">Privacy default</p>
            {(['public', 'space_specific', 'private'] as const).map((v) => (
              <label key={v} className="flex items-center gap-2 font-mono">
                <input
                  type="radio"
                  name="privacyDefault"
                  value={v}
                  checked={data.privacyDefault === v}
                  onChange={() => setData((d) => ({ ...d, privacyDefault: v }))}
                />
                {v}
              </label>
            ))}
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
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={back}>Back</Button>
              <Button type="submit" variant="primary">Next</Button>
            </div>
          </form>
        )}

        {step === 5 && (
          <div className="space-y-3 text-small">
            <p className="font-mono uppercase tracking-[0.18em] text-grey-400">Review</p>
            <pre className="border border-black bg-grey-100 p-3 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(data, null, 2)}
            </pre>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={back}>Back</Button>
              <Button type="button" variant="primary" loading={busy} onClick={create}>
                Create Space
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
