import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { Button } from '../components/Button'
import { api } from '../lib/api'
import { flashDone } from '../lib/cursor'
import { setSession } from '../lib/session'

type RegisterResponse = {
  alias: string
  token: string
  seedPhrase: string
}

const fieldLabel = 'block text-small font-mono uppercase tracking-[0.18em] text-grey-400 mb-1'
const fieldInput =
  'w-full border border-black bg-white px-3 py-2 text-body font-sans focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 focus:ring-offset-grey-50'

function Progress({ step }: { step: 1 | 2 | 3 }) {
  const items = [
    { n: 1, label: 'Identity' },
    { n: 2, label: 'Seed phrase' },
    { n: 3, label: 'Confirmed' },
  ] as const
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-small font-mono uppercase tracking-[0.18em] text-grey-400">
      {items.map(({ n, label }) => (
        <span key={n} className={step === n ? 'text-black border-b-2 border-black pb-0.5' : ''}>
          {n}. {label}
        </span>
      ))}
    </div>
  )
}

export default function RegisterPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [error, setError] = useState<string | null>(null)
  const [alias, setAlias] = useState('')
  const [seedWords, setSeedWords] = useState<string[]>([])
  const [seedAck, setSeedAck] = useState(false)

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
    }
  }

  function onStep2(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!seedAck) return
    setStep(3)
    flashDone()
  }

  return (
    <AppShell title="Register">
      <div className="w-full grid grid-cols-12 gap-x-3 gap-y-6">
        <div className="col-span-12 space-y-6">
          <Progress step={step} />

          {step === 1 ? (
            <form onSubmit={onStep1} className="space-y-4 max-w-md">
              {error ? (
                <p
                  className="border border-black bg-grey-100 px-3 py-2 text-small font-mono text-black"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
              <p className="text-body text-grey-400">
                Your alias is permanent on the chain. No email or phone — only this name and your seed.
              </p>
              <div>
                <label htmlFor="reg-alias" className={fieldLabel}>
                  Alias (3–30 chars)
                </label>
                <input
                  id="reg-alias"
                  name="alias"
                  required
                  minLength={3}
                  maxLength={30}
                  pattern="[a-z0-9_-]{3,30}"
                  title="Lowercase letters, numbers, hyphen, underscore"
                  autoComplete="username"
                  className={fieldInput}
                />
              </div>
              <div>
                <label htmlFor="reg-password" className={fieldLabel}>
                  Password (min 8 characters)
                </label>
                <input
                  id="reg-password"
                  name="password"
                  type="password"
                  minLength={8}
                  required
                  autoComplete="new-password"
                  className={fieldInput}
                />
              </div>
              <Button type="submit" variant="primary">
                Create node
              </Button>
              <p className="text-small text-grey-400">
                Already have an account?{' '}
                <Link to="/login" className="underline underline-offset-4 hover:text-black">
                  Login
                </Link>
              </p>
            </form>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div
                className="border-l-4 border-yellow-400 bg-grey-100 px-4 py-3 text-body font-mono"
                role="status"
              >
                Write these words down in order. This is the only time they are shown. There is no account
                recovery without them.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {seedWords.map((w, i) => (
                  <div
                    key={i}
                    className="border border-black bg-white px-3 py-2 font-mono text-small"
                  >
                    <span className="text-grey-400">{i + 1}.</span> {w}
                  </div>
                ))}
              </div>
              <form onSubmit={onStep2} className="space-y-4">
                <label className="flex items-start gap-3 text-body cursor-pointer">
                  <input
                    type="checkbox"
                    checked={seedAck}
                    onChange={(e) => setSeedAck(e.target.checked)}
                    className="mt-1 h-4 w-4 border-black"
                    required
                  />
                  <span>I have written down all words in order.</span>
                </label>
                <Button type="submit" variant="primary" disabled={!seedAck}>
                  Continue
                </Button>
              </form>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <p className="text-h3 font-mono">Welcome to the chain</p>
              <p className="text-body">
                Node <span className="font-mono">{alias}</span> is ready.
              </p>
              <a
                href="/dashboard"
                className="inline-block border border-black bg-yellow-400 text-black font-mono text-small uppercase tracking-[0.2em] px-6 py-2 hover:bg-black hover:text-yellow-400 transition active:scale-[0.98]"
              >
                Go to dashboard
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  )
}
