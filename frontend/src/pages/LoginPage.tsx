import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { Button } from '../components/Button'
import { api } from '../lib/api'
import { flashDone } from '../lib/cursor'
import { redirectToLegacyDashboard, setSession } from '../lib/session'

type LoginResponse = { token: string; alias: string }

const fieldLabel = 'block text-small font-mono uppercase tracking-[0.18em] text-grey-400 mb-1'
const fieldInput =
  'w-full border border-black bg-white px-3 py-2 text-body font-sans placeholder:text-grey-400 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 focus:ring-offset-grey-50'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const alias = String(fd.get('alias') ?? '').trim()
    const password = String(fd.get('password') ?? '')
    try {
      const data = await api<LoginResponse>('/auth/login', {
        method: 'POST',
        body: { alias, password },
      })
      setSession(data.token, data.alias)
      flashDone()
      redirectToLegacyDashboard()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    }
  }

  return (
    <AppShell title="Login">
      <div className="w-full grid grid-cols-12 gap-x-3 gap-y-6">
        <div className="col-span-12 md:col-span-5 space-y-4">
          <p className="text-body text-grey-400">New here?</p>
          <Link
            to="/register"
            className="inline-block border border-black px-6 py-3 font-mono text-small uppercase tracking-[0.2em] hover:bg-black hover:text-yellow-400 transition active:scale-[0.98] w-full text-center"
          >
            Sign up
          </Link>
          <p className="text-small text-grey-400">
            <Link to="/recover" className="underline underline-offset-4 hover:text-black">
              Forgot access? Recover with seed
            </Link>
          </p>
        </div>

        <div className="col-span-12 md:col-span-7">
          <form onSubmit={onSubmit} className="space-y-4 max-w-md">
            {error ? (
              <p
                className="border border-black bg-grey-100 px-3 py-2 text-small font-mono text-black"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <div>
              <label htmlFor="login-alias" className={fieldLabel}>
                Alias
              </label>
              <input
                id="login-alias"
                name="alias"
                autoComplete="username"
                required
                placeholder="xyz_123"
                className={fieldInput}
              />
            </div>
            <div>
              <label htmlFor="login-password" className={fieldLabel}>
                Password
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className={fieldInput}
              />
            </div>
            <Button type="submit" variant="primary">
              Login
            </Button>
          </form>
        </div>
      </div>
    </AppShell>
  )
}
