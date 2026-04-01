import { useState, type FormEvent } from 'react'
import { AppShell } from '../components/AppShell'
import { api } from '../lib/api'

type JoinResponse = {
  message?: string
}

export default function SpaceJoinPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const fd = new FormData(e.currentTarget)
    const spaceId = String(fd.get('spaceId') ?? '').trim()
    const inviteCode = String(fd.get('inviteCode') ?? '').trim()
    try {
      const body: { inviteCode?: string } = {}
      if (inviteCode) body.inviteCode = inviteCode
      const res = await api<JoinResponse>(`/spaces/${encodeURIComponent(spaceId)}/join`, {
        method: 'POST',
        body,
      })
      setSuccess(res.message || 'Joined space')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join space')
    }
  }

  return (
    <AppShell title="Join space">
      <form onSubmit={onSubmit} className="max-w-md space-y-4">
        {error ? (
          <p className="border border-black bg-grey-100 px-3 py-2 text-small font-mono text-black" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="border border-black bg-white px-3 py-2 text-small font-mono text-black">
            {success}
          </p>
        ) : null}
        <div>
          <label className="block text-small font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">
            Space ID
          </label>
          <input
            name="spaceId"
            required
            className="w-full border border-black bg-white px-3 py-2 text-body font-mono"
          />
        </div>
        <div>
          <label className="block text-small font-mono uppercase tracking-[0.18em] text-grey-400 mb-1">
            Invite code (if required)
          </label>
          <input
            name="inviteCode"
            className="w-full border border-black bg-white px-3 py-2 text-body font-mono"
          />
        </div>
        <button
          type="submit"
          className="border border-black bg-yellow-400 px-6 py-2 font-mono text-small uppercase tracking-[0.2em] text-black hover:bg-black hover:text-yellow-400 transition"
        >
          Join
        </button>
      </form>
    </AppShell>
  )
}

