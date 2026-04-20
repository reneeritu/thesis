export function heroGlbUrl(): string {
  const base = import.meta.env.BASE_URL
  const root = base.endsWith('/') ? base : `${base}/`
  return `${root}models/Etch_Logo.glb`
}
