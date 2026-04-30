/**
 * Shared types for the generative certificate engine.
 *
 * The engine renders a 3D IFS fractal point cloud through Three.js and
 * captures the result as a PNG when the user saves. `GenOptions` is the
 * single source of truth for what the picture looks like.
 */

export const RENDERER_VERSION = 'etch-gen-0.3'
export const MAX_REROLLS = 10

export type GenInput = {
  projectId: string
  title: string
  contributors: { alias: string; weight?: number }[]
  traceCount: number
  pivotCount: number
  referenceCount: number
  dominantActivity?: string
  blockHash?: string
  durationDays?: number
}

export type GenOptions = {
  /** 1–12. Fold symmetry around the IFS attractor centre. */
  symmetry: number
  /** Background + 4-stop density gradient. */
  colors: {
    bg: string
    a: string
    b: string
    c: string
    d: string
  }
  effects: {
    /** Film grain intensity, 0–1. */
    grain: number
    /** Procreate-style scan-band shift, 0–1. */
    glitch: number
    /** Hue rotation, 0–1. */
    colorShift: number
    /** Additive glow intensity on the point cloud, 0–1. */
    bloom: number
  }
  camera: {
    autoRotate: boolean
    /** Orbit speed multiplier, 0.1–3. */
    rotateSpeed: number
  }
  rerollIndex: number
}

export type GenParams = {
  version: string
  input: GenInput
  options: GenOptions
  seed: string
}

export const DEFAULT_OPTIONS: GenOptions = {
  symmetry: 6,
  colors: {
    bg: '#0a0a0f',
    a: '#1a0533',
    b: '#7c3aed',
    c: '#f97316',
    d: '#fef9c3',
  },
  effects: {
    grain: 0.18,
    glitch: 0,
    colorShift: 0,
    bloom: 0.6,
  },
  camera: {
    autoRotate: true,
    rotateSpeed: 0.4,
  },
  rerollIndex: 0,
}
