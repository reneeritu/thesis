import { useCallback, useEffect, useRef, useState } from 'react'

type Mode = 'photo' | 'video' | 'audio'

type Props = {
  /** Called once the user accepts the captured clip / photo. */
  onCapture: (file: File) => void
  disabled?: boolean
}

const MODE_LABEL: Record<Mode, string> = {
  photo: 'Photo',
  video: 'Video',
  audio: 'Audio',
}

function pickVideoMime(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ]
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c
  }
  return ''
}

function pickAudioMime(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
    'audio/mp4;codecs=aac',
  ]
  if (typeof MediaRecorder !== 'undefined') {
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c)) return c
    }
  }
  /** Browser default — often works when no explicit MIME matches */
  return ''
}

/** Milliseconds — periodic chunks avoid empty blobs when `.stop()` fires before the encoder flushes (common with audio-only WebM). */
const RECORD_TIMESLICE_MS = 120

function extFromMime(m: string): string {
  if (m.includes('webm')) return 'webm'
  if (m.includes('mp4')) return 'mp4'
  if (m.includes('ogg')) return 'ogg'
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg'
  if (m.includes('png')) return 'png'
  return 'bin'
}

function formatCoords(lat: number, lon: number, acc?: number): string {
  const fmt = (n: number) => n.toFixed(5)
  const parts = [`${fmt(lat)}, ${fmt(lon)}`]
  if (acc && Number.isFinite(acc)) parts.push(`±${Math.round(acc)}m`)
  return parts.join(' ')
}

function getGeolocation(): Promise<GeolocationPosition | null> {
  if (!navigator.geolocation) return Promise.resolve(null)
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p),
      () => resolve(null),
      { maximumAge: 60_000, timeout: 8_000 },
    )
  })
}

function drawStamp(ctx: CanvasRenderingContext2D, w: number, h: number, lines: string[]) {
  const padX = Math.round(w * 0.015)
  const padY = Math.round(h * 0.018)
  const lineH = Math.max(14, Math.round(h * 0.028))
  const font = `${Math.max(12, Math.round(h * 0.022))}px "JetBrains Mono", ui-monospace, monospace`

  ctx.save()
  ctx.font = font
  ctx.textBaseline = 'bottom'
  const longest = lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0)
  const boxW = longest + padX * 2
  const boxH = lineH * lines.length + padY
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(padX / 2, h - boxH - padY / 2, boxW, boxH)
  ctx.fillStyle = '#FACC15'
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(
      lines[i],
      padX + padX / 2,
      h - padY - (lines.length - 1 - i) * lineH,
    )
  }
  ctx.restore()
}

/**
 * In-browser capture widget: photo snapshot, video recording, or audio only.
 * Produces a File object that callers can pass to their upload endpoint.
 */
export function LiveCapture({ onCapture, disabled = false }: Props) {
  const [mode, setMode] = useState<Mode>('photo')
  const [active, setActive] = useState(false)
  const [recording, setRecording] = useState(false)
  const [preview, setPreview] = useState<{ url: string; file: File; mime: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [stampTime, setStampTime] = useState(true)
  const [stampLocation, setStampLocation] = useState(false)
  const [geoBusy, setGeoBusy] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  useEffect(() => () => stopStream(), [stopStream])

  async function start() {
    setError(null)
    setPreview(null)
    try {
      const constraints: MediaStreamConstraints =
        mode === 'audio'
          ? { audio: true }
          : { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: mode === 'video' }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (mode !== 'audio' && videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }
      setActive(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not access camera / mic')
    }
  }

  function stopAll() {
    stopStream()
    recorderRef.current = null
    chunksRef.current = []
    setActive(false)
    setRecording(false)
  }

  async function takePhoto() {
    const stream = streamRef.current
    const video = videoRef.current
    if (!stream || !video) return
    const w = video.videoWidth || 1280
    const h = video.videoHeight || 720
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, w, h)

    const lines: string[] = []
    if (stampTime) lines.push(new Date().toLocaleString())
    if (stampLocation) {
      setGeoBusy(true)
      const pos = await getGeolocation()
      setGeoBusy(false)
      if (pos) {
        lines.push(formatCoords(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy))
      } else {
        lines.push('location unavailable')
      }
    }
    if (lines.length > 0) drawStamp(ctx, w, h, lines)

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const mime = blob.type || 'image/jpeg'
        const file = new File([blob], `snapshot-${Date.now()}.${extFromMime(mime)}`, { type: mime })
        setPreview({ url: URL.createObjectURL(blob), file, mime })
      },
      'image/jpeg',
      0.92,
    )
  }

  function startRecording() {
    const stream = streamRef.current
    if (!stream) return
    if (typeof MediaRecorder === 'undefined') {
      setError('Recording is not supported in this browser.')
      return
    }
    if (recording || recorderRef.current?.state === 'recording') return

    const mime = mode === 'audio' ? pickAudioMime() : pickVideoMime()
    let recorder: MediaRecorder
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
    } catch (e) {
      /** Retry without mime — some builds reject explicit audio MIME but accept default */
      try {
        recorder = new MediaRecorder(stream)
      } catch (e2) {
        setError(e instanceof Error ? e.message : 'Recording not supported')
        return
      }
    }
    chunksRef.current = []
    recorder.ondataavailable = (ev) => {
      /** Include tiny chunks — filtering size>0 dropped valid trailing packets on some Edge builds */
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data)
    }
    recorder.onstop = () => {
      const outMime =
        recorder.mimeType ||
        mime ||
        (mode === 'audio' ? pickAudioMime() || 'audio/webm' : 'video/webm')
      const blob = new Blob(chunksRef.current, { type: outMime })
      if (blob.size === 0) {
        setError(
          mode === 'audio'
            ? 'Recording came back empty. Allow microphone access, record at least 1–2 seconds, then stop — or try Chrome/Firefox if Safari preview stays silent.'
            : 'Recording came back empty — try a slightly longer clip.',
        )
        setRecording(false)
        recorderRef.current = null
        return
      }
      const file = new File(
        [blob],
        `${mode}-${Date.now()}.${extFromMime(outMime)}`,
        { type: outMime },
      )
      setPreview({ url: URL.createObjectURL(blob), file, mime: outMime })
      setRecording(false)
      recorderRef.current = null
    }
    /** Timeslice forces regular dataavailable events so Stop doesn’t flush before any encoded audio exists */
    try {
      recorder.start(RECORD_TIMESLICE_MS)
    } catch {
      recorder.start()
    }
    recorderRef.current = recorder
    setRecording(true)
  }

  function stopRecording() {
    recorderRef.current?.stop()
  }

  function accept() {
    if (!preview) return
    onCapture(preview.file)
    URL.revokeObjectURL(preview.url)
    setPreview(null)
    stopAll()
  }

  function discard() {
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }

  const showVideoTag = mode !== 'audio'
  const btn =
    'border border-black px-3 py-1 font-mono text-small uppercase tracking-[0.14em] transition disabled:opacity-60'

  return (
    <div className="space-y-2 border border-grey-200 p-3">
      <div className="flex flex-wrap items-center gap-1">
        {(['photo', 'video', 'audio'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              if (active) stopAll()
              setMode(m)
              setPreview(null)
              setError(null)
            }}
            disabled={disabled}
            className={`${btn} ${mode === m ? 'bg-black text-yellow-400' : 'bg-zinc-800/60 hover:bg-black hover:text-yellow-400'}`}
          >
            {MODE_LABEL[m]}
          </button>
        ))}
        <span className="ml-auto font-mono text-small uppercase tracking-[0.14em] text-white">
          Record directly
        </span>
      </div>

      {error ? (
        <p className="border border-black bg-grey-100 px-2 py-1 font-mono text-small text-white">{error}</p>
      ) : null}

      {showVideoTag ? (
        <video
          ref={videoRef}
          muted
          playsInline
          className={`w-full bg-black ${active ? 'block' : 'hidden'} max-h-64 object-contain`}
        />
      ) : null}

      {active && !preview && mode === 'photo' ? (
        <div className="flex flex-wrap gap-3 text-small font-mono uppercase tracking-[0.14em] text-white">
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={stampTime}
              onChange={(e) => setStampTime(e.target.checked)}
            />
            Timestamp
          </label>
          <label className="flex items-center gap-1 cursor-pointer" title="Requests your GPS location at capture time">
            <input
              type="checkbox"
              checked={stampLocation}
              onChange={(e) => setStampLocation(e.target.checked)}
            />
            Location
          </label>
          {geoBusy ? <span className="text-white">(getting location…)</span> : null}
        </div>
      ) : null}

      {active && !preview ? (
        <div className="flex flex-wrap gap-1">
          {mode === 'photo' ? (
            <button type="button" onClick={() => { void takePhoto() }} className={`${btn} bg-yellow-400 hover:bg-black hover:text-yellow-400`}>
              Snapshot
            </button>
          ) : !recording ? (
            <button type="button" onClick={startRecording} className={`${btn} bg-yellow-400 hover:bg-black hover:text-yellow-400`}>
              ● Start
            </button>
          ) : (
            <button type="button" onClick={stopRecording} className={`${btn} bg-red-600 text-white hover:bg-black hover:text-yellow-400`}>
              ■ Stop
            </button>
          )}
          <button type="button" onClick={stopAll} className={`${btn} bg-zinc-800/60 hover:bg-black hover:text-yellow-400`}>
            Cancel
          </button>
        </div>
      ) : null}

      {!active && !preview ? (
        <button type="button" onClick={start} disabled={disabled} className={`${btn} bg-zinc-800/60 hover:bg-black hover:text-yellow-400`}>
          {mode === 'audio' ? 'Enable microphone' : 'Enable camera'}
        </button>
      ) : null}

      {preview ? (
        <div className="space-y-2">
          <p className="font-mono text-small uppercase tracking-[0.14em] text-white">Preview</p>
          {preview.mime.startsWith('image/') ? (
            <img src={preview.url} alt="capture preview" className="max-h-64 w-auto border border-grey-200" />
          ) : preview.mime.startsWith('video/') ? (
            <video src={preview.url} controls className="max-h-64 w-full bg-black" />
          ) : (
            <audio src={preview.url} controls className="w-full" />
          )}
          <div className="flex gap-1">
            <button type="button" onClick={accept} className={`${btn} bg-black text-yellow-400 hover:bg-yellow-400 hover:text-white`}>
              Use this
            </button>
            <button type="button" onClick={discard} className={`${btn} bg-zinc-800/60 hover:bg-black hover:text-yellow-400`}>
              Retake
            </button>
          </div>
          <p className="font-mono text-small text-white">
            {preview.file.name} · {(preview.file.size / 1024).toFixed(1)} KB · {preview.mime}
          </p>
        </div>
      ) : null}
    </div>
  )
}
