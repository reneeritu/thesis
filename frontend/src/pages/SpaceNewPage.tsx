import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { Button } from '../components/Button'
import { api } from '../lib/api'

type FoundingMember = { alias: string; role: 'admin' | 'member' }

type SpaceData = {
  name: string
  description: string
  projectAccess: 'open' | 'invite_only' | 'application'
  vetoAuthority: string[]
  votingThreshold: number
  customContractsAllowed: boolean
  privacyDefault: 'public' | 'space_specific' | 'private'
  contentRestrictions: string[]
  // invite options (only relevant when projectAccess === 'invite_only')
  inviteMode: 'single_use' | 'multi_use'
  inviteExpiryDays: number | null
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
  inviteMode: 'single_use',
  inviteExpiryDays: 15,
}

const TOTAL_STEPS = 7

export default function SpaceNewPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<SpaceData>(INITIAL)
  const [vetoRaw, setVetoRaw] = useState('')
  const [restrictionsRaw, setRestrictionsRaw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Co-founders
  const [foundingMembers, setFoundingMembers] = useState<FoundingMember[]>([])
  const [foRaw, setFoRaw] = useState('')
  const [foRole, setFoRole] = useState<'admin' | 'member'>('member')

  function next() { setStep((s) => s + 1) }
  function back() { setStep((s) => Math.max(1, s - 1)) }

  const bar = (
    <div className="flex gap-1 mb-4">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
        <div key={n} className={`h-1 flex-1 ${n <= step ? 'bg-black' : 'bg-grey-200'}`} />
      ))}
    </div>
  )

  function addFoundingMember() {
    const a = foRaw.trim().toLowerCase()
    if (!a) return
    if (foundingMembers.some((m) => m.alias === a)) return
    setFoundingMembers((prev) => [...prev, { alias: a, role: foRole }])
    setFoRaw('')
  }

  function removeFoundingMember(alias: string) {
    setFoundingMembers((prev) => prev.filter((m) => m.alias !== alias))
  }

  async function create() {
    setBusy(true)
    setError(null)
    try {
      const out = await api<{ _id: string }>('/spaces', {
        method: 'POST',
        body: {
          name: data.name,
          description: data.description || '',
          foundingMembers: foundingMembers.length > 0 ? foundingMembers : undefined,
          settings: {
            projectAccess: data.projectAccess,
            vetoAuthority: data.vetoAuthority,
            votingThreshold: data.votingThreshold,
            customContractsAllowed: data.customContractsAllowed,
            privacyDefault: data.privacyDefault,
            contentRestrictions: data.contentRestrictions,
            ...(data.projectAccess === 'invite_only' && {
              inviteMode: data.inviteMode,
              inviteExpiryDays: data.inviteExpiryDays,
            }),
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

  const stepLabel = [
    'Name & description',
    'Co-founders',
    'Project access & invites',
    'Veto authority',
    'Voting & contracts',
    'Privacy & restrictions',
    'Review',
  ][step - 1]

  const stepBodyClass = step === 7 ? '' : 'min-h-[40vh]'

  return (
    <AppShell title="Create Space">
      <div className="max-w-lg space-y-4">
        {bar}
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white">
          Step {step}/{TOTAL_STEPS} — {stepLabel}
        </p>

        {error && (
          <p className="border border-black bg-grey-100 px-3 py-2 text-small font-mono" role="alert">{error}</p>
        )}

        {/* ── Step 1: Name + Description ── */}
        {step === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); next() }} className={`space-y-3 text-small ${stepBodyClass}`}>
            <div>
              <label className="block font-mono uppercase tracking-[0.18em] text-white mb-1">Name *</label>
              <input
                value={data.name}
                onChange={(e) => setData((d) => ({ ...d, name: e.target.value }))}
                required
                className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 font-sans text-body"
              />
            </div>
            <div>
              <label className="block font-mono uppercase tracking-[0.18em] text-white mb-1">Description</label>
              <textarea
                value={data.description}
                onChange={(e) => setData((d) => ({ ...d, description: e.target.value }))}
                rows={3}
                className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 font-sans text-body"
              />
            </div>
            <Button type="submit" variant="primary">Next</Button>
          </form>
        )}

        {/* ── Step 2: Co-founders ── */}
        {step === 2 && (
          <div className={`space-y-3 text-small ${stepBodyClass}`}>
            <p className="font-mono text-[11px] text-white">
              Add other nodes as founding members. They join the space immediately. You can skip this step.
            </p>
            <div className="flex gap-2">
              <input
                value={foRaw}
                onChange={(e) => setFoRaw(e.target.value)}
                placeholder="alias"
                className="flex-1 border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono text-small"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFoundingMember() } }}
              />
              <select
                value={foRole}
                onChange={(e) => setFoRole(e.target.value as 'admin' | 'member')}
                className="border border-white/25 bg-zinc-900/55 px-2 py-2 font-mono text-small"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <Button type="button" variant="secondary" onClick={addFoundingMember}>Add</Button>
            </div>
            {foundingMembers.length > 0 && (
              <ul className="space-y-1">
                {foundingMembers.map((m) => (
                  <li key={m.alias} className="flex items-center justify-between border border-grey-200 px-3 py-1 font-mono text-[11px]">
                    <span>{m.alias} <span className="text-white">({m.role})</span></span>
                    <button type="button" onClick={() => removeFoundingMember(m.alias)} className="text-white hover:text-white ml-2">✕</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={back}>Back</Button>
              <Button type="button" variant="primary" onClick={next}>Next</Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Project access + invite options ── */}
        {step === 3 && (
          <form
            onSubmit={(e) => { e.preventDefault(); next() }}
            className={`space-y-3 text-small ${stepBodyClass}`}
          >
            <p className="font-mono uppercase tracking-[0.18em] text-white">Who can start a project?</p>
            {(['open', 'invite_only', 'application'] as const).map((v) => (
              <label key={v} className="flex items-center gap-2 font-mono">
                <input
                  type="radio"
                  name="projectAccess"
                  value={v}
                  checked={data.projectAccess === v}
                  onChange={() => setData((d) => ({ ...d, projectAccess: v }))}
                />
                {v === 'open' ? 'Open (anyone can join)' : v === 'invite_only' ? 'Invite only' : 'Application (coming soon)'}
              </label>
            ))}

            {data.projectAccess === 'invite_only' && (
              <div className="border border-grey-200 p-3 space-y-3 mt-2">
                <p className="font-mono uppercase tracking-[0.16em] text-white text-[10px]">Invite code settings</p>
                <div>
                  <label className="block font-mono uppercase tracking-[0.14em] text-white mb-1 text-[10px]">Code type</label>
                  <select
                    value={data.inviteMode}
                    onChange={(e) => setData((d) => ({ ...d, inviteMode: e.target.value as 'single_use' | 'multi_use' }))}
                    className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono text-small"
                  >
                    <option value="single_use">Single-use (one person per code)</option>
                    <option value="multi_use">Multi-use / shareable link</option>
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-2 font-mono text-[11px]">
                    <input
                      type="checkbox"
                      checked={data.inviteExpiryDays !== null}
                      onChange={(e) =>
                        setData((d) => ({ ...d, inviteExpiryDays: e.target.checked ? 15 : null }))
                      }
                    />
                    Expire after (days)
                  </label>
                  {data.inviteExpiryDays !== null && (
                    <input
                      type="number"
                      min={1}
                      value={data.inviteExpiryDays}
                      onChange={(e) => setData((d) => ({ ...d, inviteExpiryDays: Number(e.target.value) }))}
                      className="mt-1 w-32 border border-white/25 bg-zinc-900/55 px-3 py-1 font-mono text-small"
                    />
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={back}>Back</Button>
              <Button type="submit" variant="primary">Next</Button>
            </div>
          </form>
        )}

        {/* ── Step 4: Veto authority ── */}
        {step === 4 && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setData((d) => ({
                ...d,
                vetoAuthority: vetoRaw.split(',').map((s) => s.trim()).filter(Boolean),
              }))
              next()
            }}
            className={`space-y-3 text-small ${stepBodyClass}`}
          >
            <div>
              <label className="block font-mono uppercase tracking-[0.18em] text-white mb-1">
                Veto authority (comma-separated aliases)
              </label>
              <input
                value={vetoRaw}
                onChange={(e) => setVetoRaw(e.target.value)}
                className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono text-small"
                placeholder="e.g. pqr, xyz"
              />
              <p className="mt-1 font-mono text-[10px] text-white">
                These nodes will receive an invitation. Veto role is empty until they accept.
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={back}>Back</Button>
              <Button type="submit" variant="primary">Next</Button>
            </div>
          </form>
        )}

        {/* ── Step 5: Voting + contracts ── */}
        {step === 5 && (
          <form
            onSubmit={(e) => { e.preventDefault(); next() }}
            className={`space-y-3 text-small ${stepBodyClass}`}
          >
            <div>
              <label className="block font-mono uppercase tracking-[0.18em] text-white mb-1">
                Voting threshold (0 – 1)
              </label>
              <input
                type="number"
                step={0.05}
                min={0}
                max={1}
                value={data.votingThreshold}
                onChange={(e) => setData((d) => ({ ...d, votingThreshold: Number(e.target.value) }))}
                className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono text-small"
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

        {/* ── Step 6: Privacy + restrictions ── */}
        {step === 6 && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setData((d) => ({
                ...d,
                contentRestrictions: restrictionsRaw.split(',').map((s) => s.trim()).filter(Boolean),
              }))
              next()
            }}
            className={`space-y-3 text-small ${stepBodyClass}`}
          >
            <p className="font-mono uppercase tracking-[0.18em] text-white">Privacy default</p>
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
              <label className="block font-mono uppercase tracking-[0.18em] text-white mb-1">
                Content restrictions (comma-separated)
              </label>
              <input
                value={restrictionsRaw}
                onChange={(e) => setRestrictionsRaw(e.target.value)}
                className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono text-small"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={back}>Back</Button>
              <Button type="submit" variant="primary">Next</Button>
            </div>
          </form>
        )}

        {/* ── Step 7: Review + Create ── */}
        {step === 7 && (
          <div className="space-y-3 text-small">
            <p className="font-mono uppercase tracking-[0.18em] text-white">Review</p>
            <pre className="border border-black bg-grey-100 p-3 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(
                {
                  name: data.name,
                  description: data.description,
                  foundingMembers,
                  settings: {
                    projectAccess: data.projectAccess,
                    vetoAuthority: vetoRaw.split(',').map((s) => s.trim()).filter(Boolean),
                    votingThreshold: data.votingThreshold,
                    privacyDefault: data.privacyDefault,
                    ...(data.projectAccess === 'invite_only' && {
                      inviteMode: data.inviteMode,
                      inviteExpiryDays: data.inviteExpiryDays,
                    }),
                  },
                },
                null,
                2,
              )}
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
