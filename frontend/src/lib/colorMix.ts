/** Normalize #RGB / #RRGGBB to #rrggbb */
export function normalizeHex(hex: string): string | null {
  let s = hex.trim().replace(/^#/, '')
  if (s.length === 3 && /^[0-9a-fA-F]{3}$/.test(s)) {
    s = `${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`
  }
  if (s.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(s)) return null
  return `#${s.toLowerCase()}`
}

/** Mix a hex colour toward black. `amount` 0 = unchanged, 1 = black. */
export function mixBlack(hex: string, amount: number): string {
  const n = normalizeHex(hex)
  if (!n) return hex
  const t = Math.max(0, Math.min(1, amount))
  const r = parseInt(n.slice(1, 3), 16)
  const g = parseInt(n.slice(3, 5), 16)
  const b = parseInt(n.slice(5, 7), 16)
  const rr = Math.round(r * (1 - t))
  const gg = Math.round(g * (1 - t))
  const bb = Math.round(b * (1 - t))
  return `#${rr.toString(16).padStart(2, '0')}${gg.toString(16).padStart(2, '0')}${bb.toString(16).padStart(2, '0')}`
}
