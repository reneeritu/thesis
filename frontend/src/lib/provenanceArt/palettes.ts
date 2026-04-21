import type { PaletteId } from './types'

export type Palette = {
  id: PaletteId
  label: string
  background: string
  outline: string
  /** 4 fills, used in order by the engine. */
  fills: [string, string, string, string]
  /** Darker/lighter values of the same primaries for nested shapes. */
  fillsDeep: [string, string, string, string]
  accent: string
}

/**
 * Default house palette, matching the locked direction for the 3D radar:
 *   cream background, uneven charcoal outline, primaries at different values.
 */
const creamPrimaries: Palette = {
  id: 'cream_primaries',
  label: 'Cream + primaries',
  background: '#faf7ef',
  outline: '#1b1814',
  fills: ['#dc2626', '#facc15', '#0891b2', '#0a0a0a'],
  fillsDeep: ['#7f1d1d', '#ca8a04', '#155e75', '#404040'],
  accent: '#c8963e',
}

const creamJewel: Palette = {
  id: 'cream_jewel',
  label: 'Cream + jewel',
  background: '#f3e6cb',
  outline: '#1a0d08',
  fills: ['#b91c1c', '#16a34a', '#1e3a8a', '#7c2d12'],
  fillsDeep: ['#7f1d1d', '#14532d', '#0c1e4a', '#431407'],
  accent: '#c8963e',
}

const charcoalNeon: Palette = {
  id: 'charcoal_neon',
  label: 'Charcoal + neon',
  background: '#12100f',
  outline: '#f8fafc',
  fills: ['#f472b6', '#a3e635', '#22d3ee', '#fde047'],
  fillsDeep: ['#be185d', '#4d7c0f', '#0e7490', '#a16207'],
  accent: '#f472b6',
}

const navySpray: Palette = {
  id: 'navy_spray',
  label: 'Navy + spray',
  background: '#0b1320',
  outline: '#fef3c7',
  fills: ['#fda4af', '#fbbf24', '#60a5fa', '#34d399'],
  fillsDeep: ['#e11d48', '#d97706', '#2563eb', '#059669'],
  accent: '#fbbf24',
}

const monochrome: Palette = {
  id: 'monochrome',
  label: 'Monochrome',
  background: '#faf7ef',
  outline: '#0a0a0a',
  fills: ['#0a0a0a', '#404040', '#737373', '#a3a3a3'],
  fillsDeep: ['#000000', '#262626', '#525252', '#737373'],
  accent: '#0a0a0a',
}

const cmyk: Palette = {
  id: 'cmyk',
  label: 'CMYK',
  background: '#ffffff',
  outline: '#0a0a0a',
  fills: ['#00aeef', '#ec008c', '#fff200', '#0a0a0a'],
  fillsDeep: ['#0077a3', '#9e0060', '#a89d00', '#000000'],
  accent: '#ec008c',
}

export const PALETTE_BY_ID: Record<PaletteId, Palette> = {
  cream_primaries: creamPrimaries,
  cream_jewel: creamJewel,
  charcoal_neon: charcoalNeon,
  navy_spray: navySpray,
  monochrome,
  cmyk,
}

export const PALETTE_LIST: Palette[] = [
  creamPrimaries,
  creamJewel,
  charcoalNeon,
  navySpray,
  monochrome,
  cmyk,
]
