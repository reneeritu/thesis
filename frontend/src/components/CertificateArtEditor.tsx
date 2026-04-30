/**
 * Editor for attaching artwork to a provenance certificate.
 *
 * Renders a live 3D IFS fractal scene driven by project facts and exposes
 * controls for colour stops, fold symmetry, rotation speed, and the post
 * effects (bloom, grain, glitch, colour shift). When the user clicks
 * "Capture this view", the current WebGL frame is read back via
 * `toDataURL()`, uploaded to /upload/cert-artwork, and bound to the NFT
 * via PUT /nfts/:id/artwork as an `uploaded` PNG.
 */

import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { uploadCertArtwork } from '../lib/upload'
import { createIFSScene, type IFSSceneHandle } from '../lib/provenanceArt/render'
import {
  DEFAULT_OPTIONS,
  type GenInput,
  type GenOptions,
} from '../lib/provenanceArt/types'

type Props = {
  nftId: string
  input: GenInput
  onSaved?: () => void
}

export function CertificateArtEditor({ nftId, input, onSaved }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<IFSSceneHandle | null>(null)
  const [options, setOptions] = useState<GenOptions>(DEFAULT_OPTIONS)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)

  // Build Three.js scene exactly once on mount. Option changes after this
  // go through `setOptions` in the next effect to avoid tearing down the
  // renderer on every slider tick.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const scene = createIFSScene(container, input, options)
    sceneRef.current = scene
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Push the live options into the running scene whenever they change.
  useEffect(() => {
    sceneRef.current?.setOptions(options)
  }, [options])

  function updateColors(key: keyof GenOptions['colors'], value: string) {
    setOptions((o) => ({ ...o, colors: { ...o.colors, [key]: value } }))
  }

  function updateEffects(key: keyof GenOptions['effects'], value: number) {
    setOptions((o) => ({ ...o, effects: { ...o.effects, [key]: value } }))
  }

  async function onCapture() {
    const scene = sceneRef.current
    if (!scene) return
    setCapturing(true)
    setBusy(true)
    setError(null)
    setSaved(null)
    try {
      const dataUrl = scene.capture()
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const file = new File([blob], 'ifs-certificate.png', {
        type: 'image/png',
      })
      const up = await uploadCertArtwork(nftId, file)
      await api(`/nfts/${encodeURIComponent(nftId)}/artwork`, {
        method: 'PUT',
        body: { type: 'uploaded', mediaId: up.mediaId },
      })
      setSaved('Captured and saved.')
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setBusy(false)
      setCapturing(false)
    }
  }

  const sliderClass = 'flex items-center gap-3'
  const labelClass =
    'w-28 shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-white/50'
  const valClass = 'w-8 text-right font-mono text-[10px] text-white/35'

  return (
    <div className="flex flex-col gap-4">
      {/* 3D canvas — explicit pixel height so WebGL can size the renderer. */}
      <div
        ref={containerRef}
        className="w-full border border-white/15"
        style={{ height: 520, background: options.colors.bg }}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_300px]">
        {/* Left — canvas controls + capture action */}
        <div className="space-y-3">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/40">
            Drag to orbit · scroll to zoom · right-drag to pan
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                setOptions((o) => ({
                  ...o,
                  camera: { ...o.camera, autoRotate: !o.camera.autoRotate },
                }))
              }
              className="cursor-target border border-white/25 px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] transition hover:border-white/50"
            >
              {options.camera.autoRotate ? 'Stop rotation' : 'Auto rotate'}
            </button>
            <button
              type="button"
              onClick={() =>
                setOptions((o) => ({ ...o, rerollIndex: o.rerollIndex + 1 }))
              }
              className="cursor-target border border-white/25 px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] transition hover:border-white/50"
            >
              Reroll
            </button>
          </div>

          <button
            type="button"
            onClick={onCapture}
            disabled={busy}
            className="cursor-target w-full border border-white/60 px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] transition hover:bg-white hover:text-black disabled:opacity-40"
          >
            {capturing
              ? 'Capturing…'
              : busy
              ? 'Saving…'
              : 'Capture this view → save to certificate'}
          </button>
          {error ? (
            <p className="font-mono text-xs text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          {saved ? (
            <p className="font-mono text-xs text-green-400">{saved}</p>
          ) : null}
        </div>

        {/* Right — customise panel */}
        <div className="space-y-5">
          {/* Colours */}
          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/60">
              Colours
            </p>
            <div className="flex flex-wrap gap-3">
              {(
                [
                  { key: 'bg', label: 'BG' },
                  { key: 'a', label: 'LOW' },
                  { key: 'b', label: 'MID' },
                  { key: 'c', label: 'HIGH' },
                  { key: 'd', label: 'CORE' },
                ] as const
              ).map(({ key, label }) => (
                <label
                  key={key}
                  className="flex cursor-pointer flex-col items-center gap-1"
                >
                  <div
                    className="relative h-9 w-9 border border-white/25"
                    style={{ background: options.colors[key] }}
                  >
                    <input
                      type="color"
                      value={options.colors[key]}
                      onChange={(e) => updateColors(key, e.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/40">
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Symmetry */}
          <div className="space-y-1">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/60">
              Symmetry —{' '}
              {options.symmetry === 1 ? 'none' : `${options.symmetry}-fold`}
            </p>
            <input
              type="range"
              min={1}
              max={12}
              step={1}
              value={options.symmetry}
              onChange={(e) =>
                setOptions((o) => ({
                  ...o,
                  symmetry: parseInt(e.target.value, 10),
                }))
              }
              className="h-[2px] w-full cursor-pointer accent-white"
            />
          </div>

          {/* Rotation speed */}
          <div className={sliderClass}>
            <span className={labelClass}>Rotate speed</span>
            <input
              type="range"
              min={0.1}
              max={3}
              step={0.1}
              value={options.camera.rotateSpeed}
              onChange={(e) =>
                setOptions((o) => ({
                  ...o,
                  camera: {
                    ...o.camera,
                    rotateSpeed: parseFloat(e.target.value),
                  },
                }))
              }
              className="h-[2px] flex-1 cursor-pointer accent-white"
            />
            <span className={valClass}>
              {options.camera.rotateSpeed.toFixed(1)}
            </span>
          </div>

          {/* Effects */}
          <div className="space-y-3">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/60">
              Effects
            </p>
            {(
              [
                { key: 'bloom', label: 'Bloom' },
                { key: 'grain', label: 'Grain' },
                { key: 'glitch', label: 'Glitch' },
                { key: 'colorShift', label: 'Colour shift' },
              ] as const
            ).map(({ key, label }) => (
              <div key={key} className={sliderClass}>
                <span className={labelClass}>{label}</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={options.effects[key]}
                  onChange={(e) =>
                    updateEffects(key, parseFloat(e.target.value))
                  }
                  className="h-[2px] flex-1 cursor-pointer accent-white"
                />
                <span className={valClass}>
                  {options.effects[key].toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
