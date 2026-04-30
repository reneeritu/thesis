import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { api } from '../lib/api'
import { EVIDENCE_TYPES, type EvidenceType } from '../lib/evidenceTypes'
import { sha256HexFromString } from '../lib/hash'
import { getAlias } from '../lib/session'
import { uploadArchiveEvidence } from '../lib/upload'

type SpaceOpt = { id: string; name: string }
type NodeProfile = { spacesWithNames?: SpaceOpt[] }

const inputBase = 'etch-control'

const selectClass = 'etch-select'

function SelectChevron() {
  return (
    <span
      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs leading-none text-white/35"
      aria-hidden
    >
      ▾
    </span>
  )
}

function parseAliases(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(/[,\s]+/)) {
    const a = part.trim()
    if (!a || seen.has(a)) continue
    seen.add(a)
    out.push(a)
  }
  return out
}

/** Legend breaks the top border; bg matches shell so the line does not show through. */
const fieldsetShell =
  'relative isolate min-w-0 space-y-4 rounded-sm border border-[#2a2a2a] bg-black/20 px-4 pb-4 pt-6'

const legendShell =
  'absolute left-4 top-0 z-[1] -translate-y-1/2 bg-[#0a0a0f] px-2 py-0 etch-section-rule'

function CustomRadio({
  checked,
  onChange,
  name,
  id,
  label,
}: {
  checked: boolean
  onChange: () => void
  name: string
  id: string
  label: string
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 font-mono text-base text-white/72">
      <input
        id={id}
        type="radio"
        name={name}
        checked={checked}
        onChange={() => onChange()}
        className="h-[10px] w-[10px] shrink-0 cursor-pointer appearance-none rounded-full border border-solid border-[#555] bg-transparent checked:border-white checked:bg-white focus:outline-none focus-visible:ring-1 focus-visible:ring-white/25"
      />
      {label}
    </label>
  )
}

function CustomCheckbox({
  checked,
  onChange,
  id,
  label,
  required,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  id: string
  label: string
  required?: boolean
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 font-mono text-base leading-snug text-white/72">
      <span className="relative mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center border border-[#555] bg-[#0a0a0f]">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          required={required}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="font-mono text-xs leading-none text-white opacity-0 peer-checked:opacity-100">✓</span>
      </span>
      <span>{label}</span>
    </label>
  )
}

export default function ArchiveNewPage() {
  const [searchParams] = useSearchParams()
  const fileRef = useRef<HTMLInputElement>(null)
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

  const [collaboratorAliases, setCollaboratorAliases] = useState('')
  const [witnessAliases, setWitnessAliases] = useState('')
  const [mentorAliases, setMentorAliases] = useState('')
  const [institutionalAliases, setInstitutionalAliases] = useState('')

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

  const attestorPanelEmpty =
    !collaboratorAliases.trim() && !witnessAliases.trim() && !mentorAliases.trim() && !institutionalAliases.trim()

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

      const collaborators = parseAliases(collaboratorAliases)

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
          ...(collaborators.length > 0 ? { collaborators } : {}),
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
      <div className="min-h-0 min-w-0 font-mono text-white">
        <div className="grid min-h-0 w-full max-w-full grid-cols-1 gap-8 lg:grid-cols-[minmax(0,25%)_minmax(0,50%)_minmax(0,25%)] lg:gap-x-6 lg:gap-y-8 lg:items-start">
          {/* LEFT ~25% */}
          <aside className="flex min-w-0 flex-col gap-5">
            <div>
              <p className="etch-page-header m-0">Archive</p>
              <p className="mt-2 font-mono text-base font-normal leading-relaxed text-[var(--text-muted)]">
                Past work documented with evidence. Lower base reputation than live traced work. Self-attestation only
                is weakest — cross-attestation strengthens the record.
              </p>
            </div>
            <div className="border-t border-white/10 pt-4">
              <p className="m-0 font-mono text-base font-normal leading-relaxed text-[var(--text-muted)]">
                Evidence is anchored by SHA-256 hash on-chain. The file lives on the server. The fingerprint lives
                forever.
              </p>
            </div>
          </aside>

          {/* MIDDLE ~50% (column capped at half the row) */}
          <main className="min-w-0 max-w-full overflow-x-hidden" data-target-cursor-exclude>
            <div className="min-w-0 w-full max-w-full">
            <div className="border-t border-white/12 border-b border-[#2a2a2a] pt-1 pb-2">
              <h1 className="etch-region-title m-0">Document archive</h1>
            </div>

            {error ? (
              <p
                className="mt-5 border border-[#2a2a2a] border-l-[3px] border-l-rose-700/80 bg-[#06060a] px-3 py-2.5 font-mono text-base text-rose-100/80"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            {done ? (
              <div
                className="mt-5 space-y-2 border border-[#2a2a2a] border-l-[3px] border-l-[#1a4a2a] bg-[#06060a] px-3 py-2.5 font-mono text-base text-white/55"
                role="status"
              >
                <p className="m-0">{done}</p>
                <Link to="/projects" className="inline-block text-base text-white/45 underline decoration-white/25 underline-offset-4 hover:text-white/65">
                  View projects
                </Link>
              </div>
            ) : null}

            <form onSubmit={onSubmit} className="mt-5 space-y-5 font-mono text-base">
              <fieldset className={fieldsetShell}>
                <legend className={legendShell}>Work</legend>
                <div>
                  <label className="etch-field-label">
                    Space
                  </label>
                  <div className="relative">
                    <select
                      value={spaceId}
                      onChange={(e) => setSpaceId(e.target.value)}
                      required
                      className={selectClass}
                    >
                      {spaces.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <SelectChevron />
                  </div>
                  {spaces.length === 0 ? (
                    <p className="etch-field-help mt-1.5">
                      Join or create a space first.{' '}
                      <Link to="/spaces" className="text-white/50 underline decoration-white/20 underline-offset-2 hover:text-white/70">
                        Spaces
                      </Link>
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="etch-field-label">
                    Title
                  </label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputBase} />
                </div>
                <div>
                  <label className="etch-field-label">
                    Medium
                  </label>
                  <input value={medium} onChange={(e) => setMedium(e.target.value)} required className={inputBase} />
                </div>
                <div>
                  <label className="etch-field-label">
                    Approx. date (text)
                  </label>
                  <input
                    value={approxDate}
                    onChange={(e) => setApproxDate(e.target.value)}
                    required
                    placeholder="March 2022"
                    className={inputBase}
                  />
                </div>
              </fieldset>

              <fieldset className={fieldsetShell}>
                <legend className={legendShell}>Evidence</legend>
                <div>
                  <label className="etch-field-label">
                    Evidence type
                  </label>
                  <div className="relative">
                    <select
                      value={evidenceType}
                      onChange={(e) => setEvidenceType(e.target.value as EvidenceType)}
                      className={selectClass}
                    >
                      {EVIDENCE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                    <SelectChevron />
                  </div>
                </div>

                {evidenceType === 'other' ? (
                  <div>
                    <label className="etch-field-label">
                      Other description
                    </label>
                    <input
                      value={otherDescription}
                      onChange={(e) => setOtherDescription(e.target.value)}
                      className={inputBase}
                    />
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-6 pt-1">
                  <CustomRadio
                    id="src-file"
                    name="evidence-src"
                    checked={source === 'file'}
                    onChange={() => setSource('file')}
                    label="File (photo / video / audio)"
                  />
                  <CustomRadio
                    id="src-url"
                    name="evidence-src"
                    checked={source === 'url'}
                    onChange={() => setSource('url')}
                    label="URL (hash of URL string)"
                  />
                </div>

                {source === 'file' ? (
                  <div>
                    <label className="etch-field-label">
                      File
                    </label>
                    <input
                      ref={fileRef}
                      type="file"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      className="sr-only"
                      aria-label="Choose evidence file"
                    />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const f = e.dataTransfer.files?.[0]
                        if (f) setFile(f)
                      }}
                      className="flex w-full flex-col items-center justify-center rounded-sm border border-dashed border-[#333] bg-[#0a0a0f] px-4 py-8 font-mono text-base text-white/45 transition hover:border-[#555] hover:bg-black/30 hover:text-white/55"
                    >
                      <span>Drag file or click to upload</span>
                      {file ? (
                        <span className="mt-2 text-xs text-white/35">{file.name}</span>
                      ) : null}
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="etch-field-label">
                      URL
                    </label>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://…"
                      className={inputBase}
                    />
                  </div>
                )}
              </fieldset>

              <fieldset className={fieldsetShell}>
                <legend className={legendShell}>Declarations</legend>
                <div>
                  <label className="etch-field-label">
                    Context (optional)
                  </label>
                  <textarea
                    value={contextNote}
                    onChange={(e) => setContextNote(e.target.value)}
                    rows={3}
                    className={`${inputBase} resize-y min-h-[4.5rem]`}
                  />
                </div>

                <div className="space-y-3 pt-1">
                  <CustomCheckbox
                    id="decl-original"
                    checked={originalWork}
                    onChange={setOriginalWork}
                    required
                    label="I declare this is my original work."
                  />
                  <CustomCheckbox
                    id="decl-recon"
                    checked={reconstruction}
                    onChange={setReconstruction}
                    required
                    label="I acknowledge this is a self-reported reconstruction."
                  />
                </div>
              </fieldset>

              <button
                type="submit"
                disabled={submitting || spaces.length === 0}
                className="box-border w-full max-w-full rounded-sm border border-solid border-[#444] bg-transparent py-3 font-mono text-base uppercase tracking-[0.2em] text-white shadow-none ring-0 outline-none transition hover:border-white hover:bg-white hover:text-[#000] focus-visible:ring-0 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45 disabled:hover:border-[#444] disabled:hover:bg-transparent disabled:hover:text-white"
              >
                {submitting ? 'ARCHIVING…' : 'ARCHIVE'}
              </button>
            </form>
            </div>
          </main>

          {/* RIGHT ~25% */}
          <aside className="flex min-w-0 flex-col gap-6">
            <div>
              <h2 className="etch-card-title m-0 border-b border-white/10 pb-1.5 tracking-[0.2em]">
                Who can attest to this work
              </h2>
              <p className="etch-field-help !mt-2">
                Collaborator aliases are saved with the archive. Witness, mentor, and institutional roles attest later
                from the archive record once it exists.
              </p>
              {attestorPanelEmpty ? (
                <p className="etch-field-help !mt-3">No attestors added. Self-attestation only.</p>
              ) : null}
              <div className="mt-4 space-y-3">
                <div>
                  <label className="etch-field-label">
                    Collaborator
                  </label>
                  <input
                    value={collaboratorAliases}
                    onChange={(e) => setCollaboratorAliases(e.target.value)}
                    placeholder="aliases, comma or space separated"
                    className={inputBase}
                  />
                </div>
                <div>
                  <label className="etch-field-label">
                    Witness
                  </label>
                  <input
                    value={witnessAliases}
                    onChange={(e) => setWitnessAliases(e.target.value)}
                    placeholder="aliases (reminder only)"
                    className={inputBase}
                  />
                </div>
                <div>
                  <label className="etch-field-label">
                    Mentor
                  </label>
                  <input
                    value={mentorAliases}
                    onChange={(e) => setMentorAliases(e.target.value)}
                    placeholder="aliases (reminder only)"
                    className={inputBase}
                  />
                </div>
                <div>
                  <label className="etch-field-label">
                    Institutional contact
                  </label>
                  <input
                    value={institutionalAliases}
                    onChange={(e) => setInstitutionalAliases(e.target.value)}
                    placeholder="aliases (reminder only)"
                    className={inputBase}
                  />
                </div>
              </div>
            </div>

            <p className="mt-auto border-t border-white/10 pt-4 font-mono text-xs leading-relaxed text-[var(--text-subtle)]">
              Archive NFTs carry a reconstruction badge. They are weighted lower than live traced work. This is by design.
            </p>
          </aside>
        </div>
      </div>
    </AppShell>
  )
}
