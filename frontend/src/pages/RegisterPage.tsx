import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { DefTerm } from '../components/DefTerm'
import { api } from '../lib/api'
import { flashDone } from '../lib/cursor'
import { redirectAfterAuth, setSession } from '../lib/session'
import { INTEREST_PRESETS, MIN_PROFILE_INTERESTS } from '../lib/interestPresets'

type RegisterResponse = {
  alias: string
  token: string
  seedPhrase: string
}

type Step = 1 | 2 | 3 | 4 | 5

const fieldInput =
  'etch-field-input w-full border border-white/25 bg-zinc-900/55 px-3 py-2 text-body font-mono focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 focus:ring-offset-grey-50'

const MIN_TRUSTEES = 3
const MAX_TRUSTEES = 5

/** Outlined monospace CTA — dark fill, 1px white border, hover inverts. */
const outlineBtn =
  'etch-outlined-press inline-flex justify-center border border-white bg-[#0a0a0a] px-6 py-2.5 font-mono text-small uppercase tracking-[0.2em] text-white transition hover:bg-white hover:text-[#0a0a0a] disabled:pointer-events-none disabled:opacity-40'

function Progress({ step }: { step: Step }) {
  const items = [
    { n: 1, label: 'Identity' },
    { n: 2, label: 'Seed phrase' },
    { n: 3, label: 'Interests' },
    { n: 4, label: 'Trustees' },
    { n: 5, label: 'Done' },
  ] as const
  return (
    <div className="w-full space-y-2 border-b border-white/10 pb-3">
      <div className="flex w-full gap-1.5">
        {items.map(({ n }) => {
          const fill =
            step > n ? '100%' : step === n ? '72%' : '0%'
          return (
            <div
              key={n}
              className="h-0.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.07]"
              aria-hidden
            >
              <div
                className="h-full rounded-full bg-white/50 transition-[width] duration-500 ease-out"
                style={{ width: fill }}
              />
            </div>
          )
        })}
      </div>
      <div className="grid w-full grid-cols-2 gap-x-3 gap-y-2 text-small font-mono uppercase tracking-[0.18em] sm:grid-cols-5">
        {items.map(({ n, label }) => {
          const tone =
            step === n ? 'text-white' : n < step ? 'text-[var(--text-muted)]' : 'text-[var(--text-subtle)]'
          const mark = step === n ? 'border-b border-white pb-0.5' : ''
          return (
            <span key={n} className={`${tone} ${mark}`.trim()}>
              {n}. {label}
            </span>
          )
        })}
      </div>
    </div>
  )
}

export default function RegisterPage() {
  const [step, setStep] = useState<Step>(1)
  const [error, setError] = useState<string | null>(null)
  const [alias, setAlias] = useState('')
  const [seedWords, setSeedWords] = useState<string[]>([])
  const [seedAck, setSeedAck] = useState(false)

  const [interestSel, setInterestSel] = useState<Set<string>>(() => new Set())
  const [customInterest, setCustomInterest] = useState('')
  const [interestMsg, setInterestMsg] = useState<string | null>(null)
  const [interestBusy, setInterestBusy] = useState(false)

  const [trustees, setTrustees] = useState<string[]>([''])
  const [trusteeBusy, setTrusteeBusy] = useState(false)
  const [trusteeMsg, setTrusteeMsg] = useState<string | null>(null)
  const [step1Busy, setStep1Busy] = useState(false)
  const [pulseInterest, setPulseInterest] = useState<string | null>(null)

  async function onStep1(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const a = String(fd.get('alias') ?? '').trim().toLowerCase()
    const password = String(fd.get('password') ?? '')
    if (!/^[a-z0-9_-]+$/.test(a)) {
      setError('Alias: use lowercase a–z, 0–9, underscore, hyphen only.')
      return
    }
    setStep1Busy(true)
    try {
      const data = await api<RegisterResponse>('/auth/register', {
        method: 'POST',
        body: { alias: a, password },
      })
      setAlias(data.alias || a)
      setSession(data.token, data.alias || a)
      setSeedWords((data.seedPhrase || '').split(/\s+/).filter(Boolean))
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setStep1Busy(false)
    }
  }

  function onStep2(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!seedAck) return
    setStep(3)
    setError(null)
  }

  function toggleInterest(tag: string) {
    setInterestSel((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) {
        next.delete(tag)
      } else {
        next.add(tag)
        setPulseInterest(tag)
        window.setTimeout(() => setPulseInterest(null), 380)
      }
      return next
    })
  }

  async function onSaveInterests(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const interests = [...interestSel].filter(Boolean)
    if (interests.length < MIN_PROFILE_INTERESTS) {
      setInterestMsg(`Pick at least ${MIN_PROFILE_INTERESTS} interests (preset or custom).`)
      return
    }
    setInterestBusy(true)
    setInterestMsg(null)
    try {
      await api('/nodes/me', {
        method: 'PATCH',
        body: { interests },
      })
      setStep(4)
      flashDone()
    } catch (err) {
      setInterestMsg(err instanceof Error ? err.message : 'Failed to save interests')
    } finally {
      setInterestBusy(false)
    }
  }

  function addCustomInterest() {
    const t = customInterest.trim()
    if (!t || interestSel.has(t)) return
    setInterestSel((prev) => new Set(prev).add(t))
    setCustomInterest('')
  }

  function setTrusteeAt(i: number, val: string) {
    setTrustees((prev) => {
      const next = [...prev]
      next[i] = val.trim().toLowerCase()
      return next
    })
  }
  function addTrustee() {
    setTrustees((prev) => (prev.length < MAX_TRUSTEES ? [...prev, ''] : prev))
  }
  function removeTrustee(i: number) {
    setTrustees((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function onSaveTrustees(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const cleaned = trustees.map((t) => t.trim().toLowerCase()).filter(Boolean)
    if (cleaned.length < MIN_TRUSTEES) {
      setTrusteeMsg(`Need at least ${MIN_TRUSTEES} trustees. Or skip and set up later.`)
      return
    }
    if (new Set(cleaned).size !== cleaned.length) {
      setTrusteeMsg('Duplicate aliases — each trustee must be unique.')
      return
    }
    if (cleaned.includes(alias)) {
      setTrusteeMsg('You cannot list yourself as a trustee.')
      return
    }
    setTrusteeBusy(true)
    setTrusteeMsg(null)
    try {
      await api('/nodes/me/trustees', {
        method: 'PUT',
        body: { trustees: cleaned },
      })
      setStep(5)
      flashDone()
    } catch (err) {
      setTrusteeMsg(err instanceof Error ? err.message : 'Failed to save trustees')
    } finally {
      setTrusteeBusy(false)
    }
  }

  function skipTrustees() {
    setStep(5)
    flashDone()
  }

  return (
    <AppShell title="Register">
      <div className="grid w-full grid-cols-12 gap-x-3 gap-y-6 etch-auth-ink">
        <div className="col-span-12 w-full max-w-5xl space-y-6">
          <Progress step={step} />

          {step === 1 ? (
            <div className="auth-columns flex flex-col md:flex-row gap-y-8 md:gap-x-[60px] md:items-start border-t border-[#1a1a1a] pt-8">
              {/* Left Column */}
              <div className="auth-column-left w-full md:w-[45%]">
                {/* Wordmark */}
                <div className="font-mono text-sm uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-6">
                  ETCH
                </div>

                {/* Heading */}
                <h1 className="font-mono text-xl uppercase tracking-[0.14em] text-[var(--text-primary)] mb-3">
                  CREATE A NODE
                </h1>

                {/* Tagline */}
                <p className="font-mono text-sm text-[var(--text-secondary)] mb-6">
                  your alias is permanent and cannot be changed.
                </p>

                {/* Divider */}
                <div className="h-px bg-[#2a2a2a] mb-6" />

                {/* Form */}
                <form onSubmit={onStep1} className="space-y-4">
                  {error ? (
                    <div
                      className="border border-[#2a2a2a] bg-black/35 px-3 py-2 font-mono text-sm text-red-300"
                      role="alert"
                    >
                      {error}
                    </div>
                  ) : null}

                  {/* Alias */}
                  <label className="block">
                    <div className="font-mono text-sm uppercase tracking-[0.14em] text-[var(--text-secondary)] mb-2">
                      ALIAS (3-30 CHARS)
                    </div>
                    <input
                      name="alias"
                      required
                      minLength={3}
                      maxLength={30}
                      pattern="[a-z0-9_-]{3,30}"
                      title="Lowercase letters, numbers, hyphen, underscore"
                      autoComplete="username"
                      className="w-full bg-[#0d0d0b] border border-[#2a2a2a] focus:border-[#777] font-mono text-base px-3 py-2.5 text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none transition"
                      placeholder="xyz_123"
                    />
                    <p className="font-mono text-xs text-[var(--text-muted)] mt-1">
                      this is your permanent public handle. choose carefully.
                    </p>
                  </label>

                  {/* Password */}
                  <label className="block">
                    <div className="font-mono text-sm uppercase tracking-[0.14em] text-[var(--text-secondary)] mb-2">
                      PASSWORD (MIN 8 CHARACTERS)
                    </div>
                    <input
                      name="password"
                      type="password"
                      minLength={8}
                      required
                      autoComplete="new-password"
                      className="w-full bg-[#0d0d0b] border border-[#2a2a2a] focus:border-[#777] font-mono text-base px-3 py-2.5 text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none transition"
                    />
                  </label>

                  {/* Button */}
                  <button
                    type="submit"
                    className="w-full border border-[#777] bg-transparent px-4 py-2.5 font-mono text-sm uppercase tracking-[0.14em] text-[var(--text-primary)] transition hover:bg-white hover:text-black disabled:opacity-40 disabled:cursor-not-allowed"
                    disabled={step1Busy}
                  >
                    {step1Busy ? (
                      <span className="etch-loading-caret" aria-hidden>
                        _
                      </span>
                    ) : (
                      'CREATE NODE'
                    )}
                  </button>

                  {/* Login Link */}
                  <p className="text-sm font-mono text-[var(--text-muted)]">
                    already a node?{' '}
                    <Link to="/login" className="hover:text-[var(--text-secondary)] transition no-underline">
                      login
                    </Link>
                  </p>
                </form>
              </div>

              {/* Divider */}
              <div className="hidden md:block w-px bg-[#1a1a1a] flex-shrink-0" />

              {/* Right Column */}
              <div className="hidden md:block auth-column-right w-[45%]">
                <div className="font-mono text-sm uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-6">
                  BEFORE YOU BEGIN
                </div>

                <div className="space-y-0 border-t border-[#1a1a1a]">
                  {/* Alias Row */}
                  <div className="grid grid-cols-[140px_1fr] gap-0 py-2.5 px-0 border-b border-[#1a1a1a]">
                    <div className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                      ALIAS
                    </div>
                    <div className="font-mono text-sm text-[var(--text-muted)]">
                      permanent. appears on every credit and trace forever.
                    </div>
                  </div>

                  {/* Seed Phrase Row */}
                  <div className="grid grid-cols-[140px_1fr] gap-0 py-2.5 px-0 border-b border-[#1a1a1a]">
                    <div className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                      SEED PHRASE
                    </div>
                    <div className="font-mono text-sm text-[var(--text-muted)]">
                      generated on the next step. write it down offline.
                    </div>
                  </div>

                  {/* No Email Row */}
                  <div className="grid grid-cols-[140px_1fr] gap-0 py-2.5 px-0 border-b border-[#1a1a1a]">
                    <div className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                      NO EMAIL
                    </div>
                    <div className="font-mono text-sm text-[var(--text-muted)]">
                      there is no "forgot password" email. your seed is your key.
                    </div>
                  </div>

                  {/* Trustees Row */}
                  <div className="grid grid-cols-[140px_1fr] gap-0 py-2.5 px-0">
                    <div className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                      TRUSTEES
                    </div>
                    <div className="font-mono text-sm text-[var(--text-muted)]">
                      optional recovery contacts you set after registration.
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <p className="font-mono text-xs text-[var(--text-subtle)] mt-6 leading-relaxed">
                  registration writes an identity block to the chain. this action is permanent.
                </p>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4 border-t border-white/10 pt-6">
              <div
                className="border border-[#777777] border-l-[3px] border-l-[#5a4a00] bg-zinc-950/80 px-4 py-3 text-base font-mono normal-case leading-relaxed text-[var(--text-secondary)]"
                role="status"
              >
                Write these words down in order. This is the only time they are shown. There is no account
                recovery without them.
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                {seedWords.map((w, i) => (
                  <div
                    key={i}
                    className="border border-[#2a2a2a] bg-zinc-900/55 px-3 py-2 font-mono text-small"
                  >
                    <span className="text-[var(--text-muted)]">{i + 1}.</span>{' '}
                    <span className="text-white">{w}</span>
                  </div>
                ))}
              </div>
              <form onSubmit={onStep2} className="space-y-4">
                <label className="flex cursor-pointer items-start gap-3 text-base text-white">
                  <input
                    type="checkbox"
                    checked={seedAck}
                    onChange={(e) => setSeedAck(e.target.checked)}
                    className="peer sr-only"
                    required
                  />
                  <span
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border border-[#777777] bg-[#0a0a0a] peer-checked:border-white peer-focus-visible:ring-2 peer-focus-visible:ring-white peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#0a0a0a]"
                    aria-hidden
                  >
                    {seedAck ? (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
                        <path
                          d="M2 6.5L5 9.5L10 3"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="square"
                        />
                      </svg>
                    ) : null}
                  </span>
                  <span>I have written down all words in order.</span>
                </label>
                <button type="submit" className={`${outlineBtn} max-w-md`} disabled={!seedAck}>
                  Continue
                </button>
              </form>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="border-t border-white/10 pt-6">
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,40%)] lg:items-start lg:gap-10">
                <div className="max-w-xl space-y-4">
                  <h2 className="font-mono text-h3 uppercase tracking-[0.14em] text-white">
                    Pick your interests
                  </h2>
                  <p className="text-base text-white">
                    Choose at least {MIN_PROFILE_INTERESTS} tags so peers can find you. Add custom tags if you
                    like.
                  </p>
                  {interestMsg ? (
                    <p className="border border-black bg-grey-100 px-3 py-2 text-small font-mono" role="alert">
                      {interestMsg}
                    </p>
                  ) : null}
                  <form onSubmit={onSaveInterests} className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {INTEREST_PRESETS.map((tag) => {
                        const on = interestSel.has(tag)
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleInterest(tag)}
                            className={`border px-2 py-1 font-mono text-base uppercase tracking-[0.12em] transition ${
                              pulseInterest === tag ? 'etch-interest-pulse ' : ''
                            } ${
                              on
                                ? 'border-white bg-white text-[#0a0a0a]'
                                : 'border-white bg-[#0a0a0a] text-white hover:border-white/80'
                            }`}
                          >
                            {tag}
                          </button>
                        )
                      })}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[...interestSel]
                        .filter((t) => !(INTEREST_PRESETS as readonly string[]).includes(t))
                        .map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 border border-white bg-white px-2 py-0.5 font-mono text-base uppercase tracking-[0.12em] text-[#0a0a0a]"
                          >
                            {tag}
                            <button
                              type="button"
                              className="text-[#0a0a0a]/60 hover:text-[#0a0a0a]"
                              onClick={() => toggleInterest(tag)}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <input
                        value={customInterest}
                        onChange={(e) => setCustomInterest(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addCustomInterest()
                          }
                        }}
                        placeholder="Custom tag + Enter"
                        className="min-w-[12rem] flex-1 border border-white/25 bg-zinc-900/55 px-3 py-2 font-mono text-small text-white"
                      />
                      <button
                        type="button"
                        onClick={addCustomInterest}
                        className="border border-white/25 px-3 py-2 font-mono text-small uppercase tracking-[0.14em] hover:bg-white/10"
                      >
                        Add
                      </button>
                    </div>
                    <p className="font-mono text-small text-white/65">
                      Selected: {interestSel.size} (need ≥ {MIN_PROFILE_INTERESTS})
                    </p>
                    <button type="submit" className={`${outlineBtn} max-w-md`} disabled={interestBusy}>
                      {interestBusy ? (
                        <span className="inline-flex min-w-[1.25em] justify-center" aria-busy>
                          <span className="etch-loading-caret">_</span>
                        </span>
                      ) : (
                        'Continue'
                      )}
                    </button>
                  </form>
                </div>
                <aside className="border-t border-white/10 pt-6 font-mono text-small normal-case leading-relaxed tracking-normal text-[var(--text-muted)] lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                  Interests help peers find you on the discover page. They are not permanent — you can change
                  them later.
                </aside>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="border-t border-white/10 pt-6">
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,40%)] lg:items-start lg:gap-10">
                <div className="max-w-xl space-y-4">
                  <div className="space-y-2">
                    <h2 className="font-mono text-h3 uppercase tracking-[0.14em] text-white">
                      Pick your trustees (optional)
                    </h2>
                    <p className="text-base text-white">
                      <DefTerm term="trustees">Trustees</DefTerm> are {MIN_TRUSTEES}–{MAX_TRUSTEES} nodes who can help
                      you recover this account if you lose your seed phrase. A majority of them must agree before any
                      recovery happens. Pick people who know you.
                    </p>
                    <p className="text-base text-white">
                      You can skip this now and set it up from your settings later — but without trustees, losing your
                      seed phrase means losing the account.
                    </p>
                  </div>

                  {trusteeMsg ? (
                    <p
                      className="border border-black bg-grey-100 px-3 py-2 text-small font-mono"
                      role="alert"
                    >
                      {trusteeMsg}
                    </p>
                  ) : null}

                  <form onSubmit={onSaveTrustees} className="space-y-3">
                    <div className="space-y-2">
                      {trustees.map((t, i) => (
                        <div key={i} className="flex gap-2">
                          <input
                            value={t}
                            onChange={(e) => setTrusteeAt(i, e.target.value)}
                            placeholder={`Trustee alias ${i + 1}`}
                            className={fieldInput + ' flex-1'}
                            autoComplete="off"
                          />
                          {trustees.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => removeTrustee(i)}
                              className="border border-black px-2 py-1 font-mono text-small uppercase tracking-[0.14em] hover:bg-white/10"
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {trustees.length < MAX_TRUSTEES ? (
                        <button
                          type="button"
                          onClick={addTrustee}
                          className="border border-black px-3 py-1 font-mono text-small uppercase tracking-[0.14em] hover:bg-white/10"
                        >
                          + Add another
                        </button>
                      ) : null}
                      <p className="text-small font-mono text-white">
                        {trustees.filter(Boolean).length} / {MAX_TRUSTEES} · need ≥ {MIN_TRUSTEES}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
                      <button type="submit" className={`${outlineBtn} w-full sm:w-auto`} disabled={trusteeBusy}>
                        {trusteeBusy ? (
                          <span className="inline-flex min-w-[1.25em] justify-center" aria-busy>
                            <span className="etch-loading-caret">_</span>
                          </span>
                        ) : (
                          'Save trustees'
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={skipTrustees}
                        className="self-start bg-transparent p-0 font-mono text-small normal-case tracking-normal text-[var(--text-subtle)] underline-offset-4 hover:text-[var(--text-primary)] hover:underline"
                      >
                        Skip and set up later
                      </button>
                    </div>
                  </form>
                </div>
                <aside className="border-t border-white/10 pt-6 font-mono text-small normal-case leading-relaxed tracking-normal text-[var(--text-muted)] lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                  Without trustees, losing your seed phrase means permanent loss of the account. No email recovery
                  exists.
                </aside>
              </div>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="space-y-4 border-t border-white/10 pt-6">
              <h2 className="font-mono text-h3 uppercase tracking-[0.14em] text-white">Welcome to the chain</h2>
              <p className="text-base text-white">
                Node <span className="font-mono">{alias}</span> is ready.
              </p>
              <button type="button" onClick={() => redirectAfterAuth()} className={`${outlineBtn} inline-flex w-auto`}>
                Go to home
              </button>
              <ul className="mt-8 max-w-md list-none space-y-2 pl-0 font-mono text-small leading-relaxed text-[var(--text-muted)]">
                <li>→ complete your personal statement on your profile</li>
                <li>→ join or create a space</li>
                <li>→ start your first project</li>
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  )
}
