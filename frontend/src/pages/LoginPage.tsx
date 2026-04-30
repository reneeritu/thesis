import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { api } from '../lib/api'
import { flashDone } from '../lib/cursor'
import { redirectToDashboard, setSession } from '../lib/session'

type LoginResponse = { token: string; alias: string }

export default function LoginPage() {
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
      redirectToDashboard()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell title="" scrollMain gridOverlay={false}>
      <div className="login-page flex min-h-0 w-full flex-1 flex-col items-center justify-center px-3 py-10 sm:px-4">
        <div className="flex w-full max-w-[920px] flex-col gap-10 md:flex-row md:items-start md:justify-center md:gap-0 md:gap-x-12 lg:gap-x-16">
          {/* Left: sign in */}
          <div className="w-full md:w-[40%] md:max-w-[360px] md:flex-shrink-0">
            <h1 className="login-page-title mb-6 font-mono text-xl uppercase tracking-[0.14em]">
              LOGIN
            </h1>
            <form onSubmit={onSubmit} className="space-y-4">
              <label className="block space-y-2">
                <div className="login-page-label font-mono text-small uppercase tracking-[0.14em]">
                  ALIAS
                </div>
                <input
                  className={`login-page-input ${error && !alias.trim() ? 'login-page-input--invalid' : ''}`}
                  name="alias"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  autoComplete="username"
                  spellCheck={false}
                  disabled={busy}
                  placeholder="xyz_123"
                />
              </label>

              <label className="block space-y-2">
                <div className="login-page-label font-mono text-small uppercase tracking-[0.14em]">
                  PASSWORD
                </div>
                <input
                  className={`login-page-input ${error && !password ? 'login-page-input--invalid' : ''}`}
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={busy}
                />
              </label>

              {error ? (
                <div
                  className="login-page-error border border-[#2a2a2a] bg-black/35 px-3 py-2 font-mono text-small text-red-200/90"
                  role="alert"
                >
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                className="login-page-btn-outline etch-outlined-press font-mono"
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

            <div className="mt-4 text-center">
              <Link
                to="/recover"
                className="login-page-recover font-mono no-underline"
              >
                forgot access? recover with seed
              </Link>
            </div>
          </div>

          {/* Right: new user */}
          <div className="login-page-right w-full border-t pt-10 md:w-[40%] md:max-w-[360px] md:flex-shrink-0 md:border-l md:border-t-0 md:pl-10 md:pt-0">
            <p className="login-page-subhead font-mono text-small uppercase tracking-[0.14em]">
              NEW HERE?
            </p>
            <p className="login-page-explainer mt-3 max-w-sm font-sans">
              etch uses an alias and seed phrase instead of email. your identity lives on the chain.
            </p>
            <div className="mt-6">
              <Link
                to="/register"
                className="login-page-btn-outline etch-outlined-press font-mono no-underline"
              >
                REGISTER
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
