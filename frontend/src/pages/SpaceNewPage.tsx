import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { api } from '../lib/api'
import { useToast } from '../context/ToastContext'

type ProjectAccess = 'open' | 'invite_only' | 'application'
type PrivacyDefault = 'public' | 'space_specific' | 'private'

const inputBase = 'etch-control etch-field-input'

const NAV = [
  { id: 'identity', label: 'Identity' },
  { id: 'access', label: 'Access' },
  { id: 'governance', label: 'Governance' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'confirm', label: 'Confirm' },
] as const

function navCaps(label: string) {
  return label.toUpperCase()
}

function parseCommaList(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(',')) {
    const a = part.trim().toLowerCase()
    if (!a || seen.has(a)) continue
    seen.add(a)
    out.push(a)
  }
  return out
}

function FieldHelp({ children }: { children: ReactNode }) {
  return <p className="etch-field-help">{children}</p>
}

function SectionHeader({ id, title, first }: { id: string; title: string; first?: boolean }) {
  return (
    <div
      id={id}
      className={`scroll-mt-6 flex items-center gap-3 ${first ? 'pt-0' : 'border-t border-[#2a2a2a] pt-8'}`}
    >
      <h2 className="etch-section-rule shrink-0">{navCaps(title)}</h2>
      <div className="h-px min-w-[1.5rem] flex-1 bg-[#2a2a2a]" aria-hidden />
    </div>
  )
}

function RadioRow({
  id,
  name,
  checked,
  onChange,
  label,
  disabled,
}: {
  id: string
  name: string
  checked: boolean
  onChange: () => void
  label: string
  disabled?: boolean
}) {
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-center gap-2.5 font-mono text-base text-white/72 ${disabled ? 'cursor-not-allowed opacity-45' : ''}`}
    >
      <input
        id={id}
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange()}
        className="h-[10px] w-[10px] shrink-0 cursor-pointer appearance-none rounded-full border border-solid border-[#555] bg-transparent checked:border-white checked:bg-white focus:outline-none focus-visible:ring-1 focus-visible:ring-white/25 disabled:cursor-not-allowed"
      />
      {label}
    </label>
  )
}

function SmallCheckbox({
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

export default function SpaceNewPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [projectAccess, setProjectAccess] = useState<ProjectAccess>('open')
  const [foundingRaw, setFoundingRaw] = useState('')
  const [vetoRaw, setVetoRaw] = useState('')
  const [votingThreshold, setVotingThreshold] = useState(0.5)
  const [customContractsAllowed, setCustomContractsAllowed] = useState(true)
  const [privacyDefault, setPrivacyDefault] = useState<PrivacyDefault>('public')
  const [restrictionsRaw, setRestrictionsRaw] = useState('')
  const [financeConfirmed, setFinanceConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!financeConfirmed) return
    setBusy(true)
    setError(null)
    try {
      const foundingAliases = parseCommaList(foundingRaw)
      const foundingMembers =
        foundingAliases.length > 0 ? foundingAliases.map((alias) => ({ alias, role: 'member' as const })) : undefined

      const vetoAuthority = parseCommaList(vetoRaw)
      const contentRestrictions = parseCommaList(restrictionsRaw)

      const out = await api<{ _id: string }>('/spaces', {
        method: 'POST',
        body: {
          name: name.trim(),
          description: description.trim() || '',
          foundingMembers,
          settings: {
            projectAccess,
            vetoAuthority: vetoAuthority.length > 0 ? vetoAuthority : undefined,
            votingThreshold,
            customContractsAllowed,
            privacyDefault,
            contentRestrictions: contentRestrictions.length > 0 ? contentRestrictions : undefined,
            ...(projectAccess === 'invite_only' && {
              inviteMode: 'single_use' as const,
              inviteExpiryDays: 15,
            }),
          },
        },
      })
      showToast('space created — genesis block written')
      const hid = String(out._id).replace(/[^a-f0-9]/gi, '')
      window.dispatchEvent(
        new CustomEvent('etch:chain-flash', {
          detail: { hashHint: hid.length >= 8 ? hid.slice(-12) : hid },
        }),
      )
      navigate('/spaces/' + encodeURIComponent(out._id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create space')
    } finally {
      setBusy(false)
    }
  }

  const canSubmit = financeConfirmed && name.trim().length > 0 && projectAccess !== 'application'

  return (
    <AppShell title="Create Space">
      <div className="min-h-0 min-w-0 font-mono text-white">
        <div className="grid min-h-0 grid-cols-1 gap-8 lg:grid-cols-[minmax(0,30%)_minmax(0,1fr)] lg:gap-x-8 lg:items-start">
          {/* LEFT — sticky nav */}
          <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-4 lg:self-start">
            <div>
              <p className="etch-page-header m-0">Create space</p>
              <p className="mt-2 font-mono text-base font-normal leading-relaxed text-white/38">
                Space settings are permanent after creation. Financial linking is always disabled and cannot be changed.
              </p>
            </div>
            <nav className="border-t border-[#2a2a2a] pt-4" aria-label="Form sections">
              <p className="etch-section-rule m-0 mb-2 text-white/55">Jump to</p>
              <ul className="m-0 list-none space-y-2 p-0">
                {NAV.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className="font-mono text-md font-medium uppercase tracking-[0.2em] text-white/45 underline decoration-transparent underline-offset-2 transition hover:text-white/70 hover:decoration-white/25"
                    >
                      {navCaps(item.label)}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          {/* RIGHT — form */}
          <div className="min-w-0 max-w-full overflow-x-hidden lg:max-h-[min(100%,calc(100dvh-5.5rem))] lg:overflow-y-auto lg:pr-1">
            <form onSubmit={onSubmit} className="space-y-6 pb-10" data-target-cursor-exclude>
              {error ? (
                <p
                  className="border border-[#2a2a2a] border-l-[3px] border-l-rose-700/80 bg-[#06060a] px-3 py-2.5 font-mono text-base text-rose-100/80"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <section className="space-y-4">
                <SectionHeader id="identity" title="Identity" first />
                <div>
                  <label htmlFor="space-name" className="etch-field-label">
                    NAME *
                  </label>
                  <input
                    id="space-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className={inputBase}
                  />
                </div>
                <div>
                  <label htmlFor="space-desc" className="etch-field-label">
                    DESCRIPTION
                  </label>
                  <textarea
                    id="space-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className={`${inputBase} min-h-[5.5rem] resize-y`}
                  />
                </div>
              </section>

              <section className="space-y-4">
                <SectionHeader id="access" title="Access" />
                <div>
                  <p className="etch-field-group-title">PROJECT ACCESS</p>
                  <div className="flex flex-col gap-2.5">
                    <RadioRow
                      id="pa-open"
                      name="projectAccess"
                      checked={projectAccess === 'open'}
                      onChange={() => setProjectAccess('open')}
                      label="open"
                    />
                    <RadioRow
                      id="pa-invite"
                      name="projectAccess"
                      checked={projectAccess === 'invite_only'}
                      onChange={() => setProjectAccess('invite_only')}
                      label="invite_only"
                    />
                    <RadioRow
                      id="pa-app"
                      name="projectAccess"
                      checked={projectAccess === 'application'}
                      onChange={() => setProjectAccess('application')}
                      label="application (coming soon)"
                      disabled
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="founding" className="etch-field-label">
                    FOUNDING MEMBERS
                  </label>
                  <input
                    id="founding"
                    value={foundingRaw}
                    onChange={(e) => setFoundingRaw(e.target.value)}
                    placeholder="aliases, comma separated"
                    className={inputBase}
                  />
                  <FieldHelp>
                    Founding members join immediately and are recorded on the genesis block. Later members are not founding members.
                  </FieldHelp>
                </div>
              </section>

              <section className="space-y-4">
                <SectionHeader id="governance" title="Governance" />
                <div>
                  <label htmlFor="veto" className="etch-field-label">
                    VETO AUTHORITY
                  </label>
                  <input
                    id="veto"
                    value={vetoRaw}
                    onChange={(e) => setVetoRaw(e.target.value)}
                    placeholder="aliases, comma separated"
                    className={inputBase}
                  />
                  <FieldHelp>These nodes receive an invitation. Role is empty until accepted.</FieldHelp>
                </div>
                <div>
                  <label htmlFor="threshold" className="etch-field-label">
                    VOTING THRESHOLD
                  </label>
                  <input
                    id="threshold"
                    type="number"
                    step={0.05}
                    min={0}
                    max={1}
                    value={votingThreshold}
                    onChange={(e) => setVotingThreshold(Number(e.target.value))}
                    className={inputBase}
                  />
                  <FieldHelp>0.5 = simple majority. Higher = broader consensus required.</FieldHelp>
                </div>
                <div>
                  <SmallCheckbox
                    id="custom-contracts"
                    checked={customContractsAllowed}
                    onChange={setCustomContractsAllowed}
                    label="ALLOW CUSTOM CONTRACTS"
                  />
                  <FieldHelp>Custom contracts cannot override chain-wide meta rules.</FieldHelp>
                </div>
              </section>

              <section className="space-y-4">
                <SectionHeader id="privacy" title="Privacy" />
                <div>
                  <p className="etch-field-group-title">PRIVACY DEFAULT</p>
                  <div className="flex flex-col gap-2.5">
                    {(['public', 'space_specific', 'private'] as const).map((v) => (
                      <RadioRow
                        key={v}
                        id={`priv-${v}`}
                        name="privacyDefault"
                        checked={privacyDefault === v}
                        onChange={() => setPrivacyDefault(v)}
                        label={v}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label htmlFor="restrictions" className="etch-field-label">
                    CONTENT RESTRICTIONS
                  </label>
                  <input
                    id="restrictions"
                    value={restrictionsRaw}
                    onChange={(e) => setRestrictionsRaw(e.target.value)}
                    placeholder="comma-separated tags (optional)"
                    className={inputBase}
                  />
                </div>
              </section>

              <section className="space-y-4">
                <SectionHeader id="confirm" title="Confirm" />
                <label
                  htmlFor="finance-confirm"
                  className="flex cursor-pointer items-start gap-3 rounded-sm border border-[#888] bg-[#0a0a0f]/80 px-3 py-3 font-mono text-xs leading-snug text-white/88"
                >
                  <input
                    id="finance-confirm"
                    type="checkbox"
                    checked={financeConfirmed}
                    onChange={(e) => setFinanceConfirmed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer appearance-none border border-solid border-[#888] bg-transparent checked:border-white checked:bg-white focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
                  />
                  <span>
                    I confirm that financial linking for this space is disabled and this setting is permanent and immutable.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={!canSubmit || busy}
                  className="box-border w-full max-w-full rounded-sm border border-solid border-[#444] bg-transparent py-3 font-mono text-base uppercase tracking-[0.2em] text-white shadow-none ring-0 outline-none transition hover:border-white hover:bg-white hover:text-[#000] focus-visible:ring-0 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 disabled:hover:border-[#444] disabled:hover:bg-transparent disabled:hover:text-white"
                >
                  {busy ? 'CREATING…' : 'CREATE SPACE'}
                </button>
              </section>
            </form>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
