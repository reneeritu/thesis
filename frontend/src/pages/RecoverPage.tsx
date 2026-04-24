import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { Button } from '../components/Button'
import { api } from '../lib/api'
import { flashDone } from '../lib/cursor'
import { redirectToDashboard, setSession } from '../lib/session'

type RecoverResponse = { token: string; alias: string }

const fieldLabel = 'block text-small font-mono uppercase tracking-[0.18em] text-white mb-1'
const fieldInput =
  'w-full border border-white/25 bg-zinc-900/55 px-3 py-2 text-body font-sans focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 focus:ring-offset-grey-50'
const textareaClass = fieldInput + ' min-h-[120px] font-mono text-small'

export default function RecoverPage() {
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const alias = String(fd.get('alias') ?? '').trim()
    const seedPhrase = String(fd.get('seedPhrase') ?? '').trim()
    const newPassword = String(fd.get('newPassword') ?? '')
    try {
      const data = await api<RecoverResponse>('/auth/recover', {
        method: 'POST',
        body: { alias, seedPhrase, newPassword },
      })
      setSession(data.token, data.alias)
      flashDone()
      redirectToDashboard()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    }
  }

  return (
    <AppShell title="Recover">
      <div className="grid w-full grid-cols-12 gap-x-3 gap-y-6">
        <div className="col-span-12 mx-auto w-full max-w-lg space-y-4">
          <p className="text-body text-white">
            Reset your password using your 12-word seed phrase. This invalidates previous sessions.
          </p>
          <form onSubmit={onSubmit} className="space-y-4 border border-white/20 bg-zinc-950/20 p-4 sm:p-5">
            {error ? (
              <p
                className="border border-black bg-grey-100 px-3 py-2 text-small font-mono text-white"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <div>
              <label htmlFor="rec-alias" className={fieldLabel}>
                Alias
              </label>
              <input id="rec-alias" name="alias" required autoComplete="username" className={fieldInput} />
            </div>
            <div>
              <label htmlFor="rec-seed" className={fieldLabel}>
                Seed phrase (12 words)
              </label>
              <textarea
                id="rec-seed"
                name="seedPhrase"
                required
                className={textareaClass}
                placeholder="word one word two …"
              />
            </div>
            <div>
              <label htmlFor="rec-new" className={fieldLabel}>
                New password (min 8 characters)
              </label>
              <input
                id="rec-new"
                name="newPassword"
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
                className={fieldInput}
              />
            </div>
            <Button type="submit" variant="danger">
              Reset password
            </Button>
          </form>
          <p className="text-small text-white">
            <Link to="/login" className="underline underline-offset-4 hover:text-white">
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </AppShell>
  )
}
