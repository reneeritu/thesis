import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { api } from '../lib/api'
import { flashDone } from '../lib/cursor'
import { redirectAfterAuth, setSession } from '../lib/session'

type LoginResponse = { token: string; alias: string }

export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const loginReason = searchParams.get('reason')?.trim() || ''

  const [alias, setAlias] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const trimmedAlias = alias.trim()
    if (!trimmedAlias) {
      setError('Enter an alias.')
      return
    }
    if (!password) {
      setError('Enter a password.')
      return
    }
    setBusy(true)
    try {
      const data = await api<LoginResponse>('/auth/login', {
        method: 'POST',
        body: { alias: trimmedAlias, password },
      })
      setSession(data.token, data.alias)
      flashDone()
      redirectAfterAuth()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell title="" scrollMain gridOverlay={false}>
      <div className="auth-page flex min-h-0 w-full flex-1 flex-col items-center justify-center px-4 py-20">
        <div className="auth-container w-full max-w-[860px]">
          <div className="auth-columns flex flex-col md:flex-row gap-y-8 md:gap-x-[60px] md:items-start">
            {/* Left Column */}
            <div className="auth-column-left w-full md:w-[45%]">
              {/* Wordmark */}
              <div className="font-mono text-sm uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-6">
                ETCH
              </div>

              {/* Heading */}
              <h1 className="font-mono text-xl uppercase tracking-[0.14em] text-[var(--text-primary)] mb-3">
                ENTER THE CHAIN
              </h1>

              {/* Tagline */}
              <p className="font-mono text-sm text-[var(--text-muted)] mb-6">
                no email. no phone. just your alias and seed.
              </p>

              {/* Divider */}
              <div className="h-px bg-[#2a2a2a] mb-6" />

              {loginReason ? (
                <p className="font-mono text-sm text-[var(--text-muted)] mb-4">{loginReason}</p>
              ) : null}

              {/* Form */}
              <form onSubmit={onSubmit} className="space-y-4 mb-6">
                {/* Alias */}
                <label className="block">
                  <div className="font-mono text-sm uppercase tracking-[0.14em] text-[var(--text-secondary)] mb-2">
                    ALIAS
                  </div>
                  <input
                    className="w-full bg-[#0d0d0b] border border-[#2a2a2a] focus:border-[#777] font-mono text-base px-3 py-2.5 text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none transition"
                    name="alias"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    autoComplete="username"
                    spellCheck={false}
                    disabled={busy}
                    placeholder="xyz_123"
                  />
                </label>

                {/* Password */}
                <label className="block">
                  <div className="font-mono text-sm uppercase tracking-[0.14em] text-[var(--text-secondary)] mb-2">
                    PASSWORD
                  </div>
                  <input
                    className="w-full bg-[#0d0d0b] border border-[#2a2a2a] focus:border-[#777] font-mono text-base px-3 py-2.5 text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none transition"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={busy}
                  />
                </label>

                {/* Error */}
                {error ? (
                  <div
                    className="border border-[#2a2a2a] bg-black/35 px-3 py-2 font-mono text-sm text-red-300"
                    role="alert"
                  >
                    {error}
                  </div>
                ) : null}

                {/* Button */}
                <button
                  type="submit"
                  className="w-full border border-[#777] bg-transparent px-4 py-2.5 font-mono text-sm uppercase tracking-[0.14em] text-[var(--text-primary)] transition hover:bg-white hover:text-black disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={busy}
                >
                  {busy ? (
                    <span className="etch-loading-caret" aria-hidden>
                      _
                    </span>
                  ) : (
                    'LOGIN'
                  )}
                </button>
              </form>

              {/* Links */}
              <div className="flex items-center justify-center gap-3 text-sm font-mono text-[var(--text-muted)]">
                <Link
                  to="/recover"
                  className="hover:text-[var(--text-secondary)] transition no-underline"
                >
                  forgot access? recover with seed
                </Link>
                <span>·</span>
                <Link
                  to="/register"
                  className="hover:text-[var(--text-secondary)] transition no-underline"
                >
                  new here? register
                </Link>
              </div>
            </div>

            {/* Divider */}
            <div className="hidden md:block w-px bg-[#1a1a1a] flex-shrink-0" />

            {/* Right Column */}
            <div className="hidden md:block auth-column-right w-[45%]">
              <div className="font-mono text-sm uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-6">
                WHAT IS A NODE?
              </div>

              <div className="space-y-0 border-t border-[#1a1a1a]">
                {/* Alias Row */}
                <div className="grid grid-cols-[140px_1fr] gap-0 py-2.5 px-0 border-b border-[#1a1a1a]">
                  <div className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                    ALIAS
                  </div>
                  <div className="font-mono text-sm text-[var(--text-muted)]">
                    your permanent public identity on the chain
                  </div>
                </div>

                {/* Seed Phrase Row */}
                <div className="grid grid-cols-[140px_1fr] gap-0 py-2.5 px-0 border-b border-[#1a1a1a]">
                  <div className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                    SEED PHRASE
                  </div>
                  <div className="font-mono text-sm text-[var(--text-muted)]">
                    12 words that prove you are you. keep them offline.
                  </div>
                </div>

                {/* Proof of Work Row */}
                <div className="grid grid-cols-[140px_1fr] gap-0 py-2.5 px-0">
                  <div className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                    PROOF OF WORK
                  </div>
                  <div className="font-mono text-sm text-[var(--text-muted)]">
                    every trace you log builds your record permanently.
                  </div>
                </div>
              </div>

              {/* Footer */}
              <p className="font-mono text-xs text-[var(--text-subtle)] mt-6 leading-relaxed">
                etch does not store your email or phone number. if you lose your seed phrase, recovery depends on your trustees.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
