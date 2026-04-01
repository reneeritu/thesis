import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell'

export default function DiscoverPage() {
  const [alias, setAlias] = useState('')
  const navigate = useNavigate()

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const a = alias.trim()
    if (!a) return
    navigate(`/nodes/${encodeURIComponent(a)}`)
  }

  return (
    <AppShell title="Discover">
      <div className="max-w-lg space-y-6">
        <p className="text-body text-grey-400">
          Exact alias lookup. No ranking — open a public profile by alias.
        </p>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label htmlFor="disc-alias" className="block text-small font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">
              Alias
            </label>
            <input
              id="disc-alias"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              className="w-full border border-black bg-white px-3 py-2 font-mono text-body"
              required
            />
          </div>
          <button
            type="submit"
            className="border border-black bg-yellow-400 px-6 py-2 font-mono text-small uppercase tracking-[0.2em] text-black hover:bg-black hover:text-yellow-400 transition"
          >
            Open profile
          </button>
        </form>
      </div>
    </AppShell>
  )
}
