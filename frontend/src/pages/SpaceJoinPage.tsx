import { useState, type FormEvent } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { api } from '../lib/api'

type JoinResponse = { message?: string }

const inputClass =
  'etch-control etch-field-input w-full border border-white/25 bg-zinc-900/55 px-3 py-2 text-body font-mono focus:border-white/40 [html.light-mode_&]:border-[var(--border-default)] [html.light-mode_&]:bg-[var(--bg-primary)] [html.light-mode_&]:text-[var(--text-primary)]'

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

  const muted = 'font-mono text-sm leading-relaxed text-[var(--text-muted)]'
  const mutedTight = 'font-mono text-sm leading-snug text-[var(--text-muted)]'
  const rowLabel =
    'font-mono text-sm uppercase tracking-[0.08em] text-white [html.light-mode_&]:text-[var(--text-primary)]'

  return (
    <AppShell title="Join space">
      <div className="grid w-full max-w-[100%] grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-12 lg:items-start">
        {/* LEFT ~30% */}
        <div className="lg:col-span-4">
          <h1 className="mb-4 font-mono text-xl uppercase tracking-[0.14em] text-white [html.light-mode_&]:text-[var(--text-primary)]">
            Join a space
          </h1>
          <p className={muted}>
            Spaces are studios, classes, and collectives. Open spaces can be joined directly with a space ID.
            Invite-only spaces require a code from an admin.
          </p>
          <hr className="my-[20px] border-0 border-t border-solid border-[#2a2a2a] [html.light-mode_&]:border-[var(--border-default)]" />
          <p className="font-mono text-xs leading-relaxed text-[var(--text-muted)]">
            The space ID is visible in the space&apos;s URL or can be shared by any member.
          </p>
        </div>

        {/* MIDDLE ~40% */}
        <div className="lg:col-span-5">
          <form onSubmit={onSubmit} className="flex flex-col gap-6">
            {error ? (
              <p
                className="border border-black bg-grey-100 px-3 py-2 text-small font-mono text-white [html.light-mode_&]:text-[var(--text-primary)]"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="border border-white/25 bg-zinc-900/55 px-3 py-2 text-small font-mono text-white [html.light-mode_&]:border-[var(--border-default)] [html.light-mode_&]:bg-[var(--bg-secondary)] [html.light-mode_&]:text-[var(--text-primary)]">
                {success}
              </p>
            ) : null}

            <div>
              <label htmlFor="join-space-id" className="etch-field-label mb-1 block">
                Space ID
              </label>
              <input
                id="join-space-id"
                value={spaceId}
                onChange={(e) => setSpaceId(e.target.value)}
                required
                autoComplete="off"
                className={inputClass}
              />
              <p className={`mt-1 ${muted}`}>Paste the space ID or full URL</p>
            </div>

            <div>
              <label htmlFor="join-invite-code" className="etch-field-label mb-1 block">
                Invite code (if required)
              </label>
              <input
                id="join-invite-code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                autoComplete="off"
                className={inputClass}
              />
              <p className={`mt-1 ${muted}`}>Leave blank if the space is open</p>
            </div>

            <button
              type="submit"
              className="w-full border border-[#444444] bg-[#0a0a0a] px-3 py-2.5 font-mono text-sm uppercase tracking-[0.16em] text-white transition-colors duration-150 hover:bg-white hover:text-black [html.light-mode_&]:border-[var(--border-strong)] [html.light-mode_&]:bg-[var(--bg-primary)] [html.light-mode_&]:text-[var(--text-primary)] [html.light-mode_&]:hover:bg-[var(--text-primary)] [html.light-mode_&]:hover:text-[var(--bg-primary)]"
            >
              Join
            </button>
          </form>
        </div>

        {/* RIGHT ~25% */}
        <aside className="lg:col-span-3">
          <h2 className="mb-3 font-mono text-sm uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Access types
          </h2>
          <ul className="m-0 list-none p-0">
            <li className="border-b border-[#1a1a1a] py-2.5 [html.light-mode_&]:border-[var(--border-default)]">
              <p className={rowLabel}>Open</p>
              <p className={`mt-0.5 ${mutedTight}`}>Any node can join without a code.</p>
            </li>
            <li className="border-b border-[#1a1a1a] py-2.5 [html.light-mode_&]:border-[var(--border-default)]">
              <p className={rowLabel}>Invite only</p>
              <p className={`mt-0.5 ${mutedTight}`}>Requires a valid invite code from a space admin.</p>
            </li>
            <li className="border-b border-[#1a1a1a] py-2.5 [html.light-mode_&]:border-[var(--border-default)]">
              <p className={rowLabel}>Application</p>
              <p className={`mt-0.5 ${mutedTight}`}>
                Node requests access, admin approves. (coming soon)
              </p>
            </li>
          </ul>
        </aside>
      </div>
    </AppShell>
  )
}
