import { useState, type FormEvent } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { api } from '../lib/api'

type JoinResponse = { message?: string }

export default function SpaceJoinPage() {
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const prefillSpace = search.get('space') ?? ''
  const prefillCode = search.get('code') ?? ''

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [spaceId, setSpaceId] = useState(prefillSpace)
  const [inviteCode, setInviteCode] = useState(prefillCode)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    try {
      const body: { inviteCode?: string } = {}
      if (inviteCode.trim()) body.inviteCode = inviteCode.trim()
      const res = await api<JoinResponse>(`/spaces/${encodeURIComponent(spaceId.trim())}/join`, {
        method: 'POST',
        body,
      })
      setSuccess(res.message || 'Joined space')
      setTimeout(() => navigate('/spaces/' + encodeURIComponent(spaceId.trim())), 1200)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join space')
    }
  }

  return (
    <AppShell title="Join space">
      <div className="mx-auto w-full max-w-md space-y-4">
        <p className="text-body text-white/90">
          Enter a space ID and, if needed, an invite code from an admin.
        </p>
        <form onSubmit={onSubmit} className="space-y-4 border border-white/20 bg-zinc-950/20 p-4">
          {error && (
            <p className="border border-black bg-grey-100 px-3 py-2 text-small font-mono text-white" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="border border-white/25 bg-zinc-900/55 px-3 py-2 text-small font-mono text-white">
              {success}
            </p>
          )}
          <div>
            <label className="mb-1 block text-small font-mono uppercase tracking-[0.18em] text-white">
              Space ID
            </label>
            <input
              value={spaceId}
              onChange={(e) => setSpaceId(e.target.value)}
              required
              className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 text-body font-mono"
            />
          </div>
          <div>
            <label className="mb-1 block text-small font-mono uppercase tracking-[0.18em] text-white">
              Invite code (if required)
            </label>
            <input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 text-body font-mono"
            />
          </div>
          <button
            type="submit"
            className="border border-black bg-yellow-400 px-6 py-2 font-mono text-small uppercase tracking-[0.2em] text-white transition hover:bg-black hover:text-yellow-400"
          >
            Join
          </button>
        </form>
      </div>
    </AppShell>
  )
}

