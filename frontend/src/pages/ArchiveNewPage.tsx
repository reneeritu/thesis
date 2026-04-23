import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { api } from '../lib/api'
import { EVIDENCE_TYPES, type EvidenceType } from '../lib/evidenceTypes'
import { sha256HexFromString } from '../lib/hash'
import { getAlias } from '../lib/session'
import { uploadArchiveEvidence } from '../lib/upload'

type SpaceOpt = { id: string; name: string }
type NodeProfile = { spacesWithNames?: SpaceOpt[] }

export default function ArchiveNewPage() {
  const [searchParams] = useSearchParams()
  const [spaces, setSpaces] = useState<SpaceOpt[]>([])
  const [spaceId, setSpaceId] = useState('')
  const [title, setTitle] = useState('')
  const [medium, setMedium] = useState('')
  const [approxDate, setApproxDate] = useState('')
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('photos_of_work')
  const [source, setSource] = useState<'file' | 'url'>('file')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [otherDescription, setOtherDescription] = useState('')
  const [contextNote, setContextNote] = useState('')
  const [originalWork, setOriginalWork] = useState(false)
  const [reconstruction, setReconstruction] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const alias = getAlias()
        const me = await api<NodeProfile>('/nodes/' + encodeURIComponent(alias))
        const sns = me.spacesWithNames ?? []
        if (!cancelled) {
          setSpaces(sns)
          const qSpace = searchParams.get('space')
          setSpaceId((prev) => {
            if (qSpace && sns.some((s) => s.id === qSpace)) return qSpace
            if (prev) return prev
            return sns[0]?.id ?? ''
          })
        }
      } catch {
        /* handled on submit */
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [searchParams])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setDone(null)
    if (!spaceId) {
      setError('Choose a space.')
      return
    }
    if (!originalWork) {
      setError('You must confirm this is your original work.')
      return
    }
    if (!reconstruction) {
      setError('You must acknowledge this is a self-reported reconstruction.')
      return
    }
    if (evidenceType === 'other' && !otherDescription.trim()) {
      setError('Describe “other” evidence.')
      return
    }

    setSubmitting(true)
    try {
      let evidenceHash: string
      let mediaId: string | undefined

      if (source === 'file') {
        if (!file) {
          setError('Choose a file.')
          setSubmitting(false)
          return
        }
        const up = await uploadArchiveEvidence(spaceId, file)
        evidenceHash = up.hash
        mediaId = up.mediaId
      } else {
        const u = url.trim()
        if (!u) {
          setError('Enter a URL.')
          setSubmitting(false)
          return
        }
        evidenceHash = await sha256HexFromString(u)
      }

      const evidence: {
        evidenceType: EvidenceType
        evidenceHash: string
        otherDescription?: string
        mediaId?: string
      }[] = [
        {
          evidenceType,
          evidenceHash,
          ...(evidenceType === 'other' ? { otherDescription: otherDescription.trim() } : {}),
          ...(mediaId ? { mediaId } : {}),
        },
      ]

      const res = await api<{ project?: { _id: string } }>('/archives', {
        method: 'POST',
        body: {
          title: title.trim(),
          medium: medium.trim(),
          approxDate: approxDate.trim(),
          spaceId,
          evidence,
          reconstructionFlag: reconstruction,
          originalWorkDeclaration: true,
          contextNote: contextNote.trim() || undefined,
        },
      })

      const pid = res.project?._id
      setDone(pid ? `Archive created. Project: ${pid}` : 'Archive created.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Archive failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell title="Archive past work">
      <div className="max-w-2xl space-y-6">
        <p className="text-body text-white">
          Document work that predates the chain. Evidence is anchored by SHA-256 hashes on-chain; file
          uploads are stored on the server and linked in the database.
        </p>

        {error ? (
          <p className="border border-black bg-grey-100 px-3 py-2 text-small font-mono text-white" role="alert">
            {error}
          </p>
        ) : null}
        {done ? (
          <p className="border border-white/25 bg-zinc-900/55 px-3 py-2 text-small font-mono text-white">
            {done}{' '}
            <Link to="/projects" className="underline underline-offset-4">
              View projects
            </Link>
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4 text-small">
          <div>
            <label className="block font-mono uppercase tracking-[0.18em] text-white mb-1">Space</label>
            <select
              value={spaceId}
              onChange={(e) => setSpaceId(e.target.value)}
              required
              className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 text-body"
            >
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {spaces.length === 0 ? (
              <p className="mt-1 text-small text-white">
                Join or create a space first.{' '}
                <Link to="/spaces" className="underline">
                  Spaces
                </Link>
              </p>
            ) : null}
          </div>

          <div>
            <label className="block font-mono uppercase tracking-[0.18em] text-white mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 text-body"
            />
          </div>
          <div>
            <label className="block font-mono uppercase tracking-[0.18em] text-white mb-1">Medium</label>
            <input
              value={medium}
              onChange={(e) => setMedium(e.target.value)}
              required
              className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 text-body"
            />
          </div>
          <div>
            <label className="block font-mono uppercase tracking-[0.18em] text-white mb-1">
              Approx. date (text)
            </label>
            <input
              value={approxDate}
              onChange={(e) => setApproxDate(e.target.value)}
              required
              placeholder="March 2022"
              className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 text-body"
            />
          </div>

          <div>
            <label className="block font-mono uppercase tracking-[0.18em] text-white mb-1">
              Evidence type
            </label>
            <select
              value={evidenceType}
              onChange={(e) => setEvidenceType(e.target.value as EvidenceType)}
              className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 text-body"
            >
              {EVIDENCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {evidenceType === 'other' ? (
            <div>
              <label className="block font-mono uppercase tracking-[0.18em] text-white mb-1">
                Other description
              </label>
              <input
                value={otherDescription}
                onChange={(e) => setOtherDescription(e.target.value)}
                className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 text-body"
              />
            </div>
          ) : null}

          <div className="flex gap-4 font-mono text-small">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={source === 'file'} onChange={() => setSource('file')} />
              File (photo / video / audio)
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={source === 'url'} onChange={() => setSource('url')} />
              URL (hash of URL string)
            </label>
          </div>

          {source === 'file' ? (
            <div>
              <label className="block font-mono uppercase tracking-[0.18em] text-white mb-1">File</label>
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-body"
              />
            </div>
          ) : (
            <div>
              <label className="block font-mono uppercase tracking-[0.18em] text-white mb-1">URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 text-body"
              />
            </div>
          )}

          <div>
            <label className="block font-mono uppercase tracking-[0.18em] text-white mb-1">
              Context (optional)
            </label>
            <textarea
              value={contextNote}
              onChange={(e) => setContextNote(e.target.value)}
              rows={3}
              className="w-full border border-white/25 bg-zinc-900/55 px-3 py-2 text-body"
            />
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={originalWork}
              onChange={(e) => setOriginalWork(e.target.checked)}
              required
            />
            <span>I declare this is my original work.</span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={reconstruction}
              onChange={(e) => setReconstruction(e.target.checked)}
              required
            />
            <span>I acknowledge this is a self-reported reconstruction.</span>
          </label>

          <button
            type="submit"
            disabled={submitting || spaces.length === 0}
            className="border border-black bg-yellow-400 px-6 py-2 font-mono text-small uppercase tracking-[0.2em] text-white hover:bg-black hover:text-yellow-400 transition disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Archive'}
          </button>
        </form>
      </div>
    </AppShell>
  )
}
