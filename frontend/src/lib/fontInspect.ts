import './fontInspect.css'

const TEXT_SCALE_RE = /\btext-(h1|h2|h3|body|small)\b/
const FONT_ROLE_RE = /\bfont-(sans|heading|mono)\b/

let toastEl: HTMLDivElement | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null

function targetElement(e: MouseEvent): Element | null {
  const raw = e.target
  if (raw instanceof Element) return raw
  if (raw instanceof Text) return raw.parentElement
  return null
}

function elementClassString(n: Element): string {
  if (n instanceof HTMLElement && typeof n.className === 'string') return n.className
  if (n instanceof SVGElement && n.className && typeof n.className.baseVal === 'string') {
    return n.className.baseVal
  }
  return n.getAttribute('class') ?? ''
}

function collectAncestors(el: Element | null): {
  scale?: string
  fontRole?: string
  headingTag?: string
} {
  let scale: string | undefined
  let fontRole: string | undefined
  let headingTag: string | undefined
  for (let n: Element | null = el; n; n = n.parentElement) {
    const tag = n.tagName?.toLowerCase()
    if (!headingTag && /^h[1-6]$/.test(tag)) {
      headingTag = tag.toUpperCase()
    }
    const cls = elementClassString(n)
    if (!scale) {
      const m = cls.match(TEXT_SCALE_RE)
      if (m) scale = m[1]
    }
    if (!fontRole) {
      const m = cls.match(FONT_ROLE_RE)
      if (m) fontRole = m[1]
    }
  }
  return { scale, fontRole, headingTag }
}

function inferScaleFromPx(px: number): string {
  if (px <= 13.5) return 'small (inferred ~14px scale)'
  if (px <= 17.5) return 'body (inferred ~16px scale)'
  if (px <= 22) return 'h3 (inferred from size)'
  if (px <= 32) return 'h2 (inferred from size)'
  return 'h1 (inferred from size)'
}

function removeToast() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  toastEl?.remove()
  toastEl = null
}

function showToast(clientX: number, clientY: number, html: string) {
  removeToast()
  const el = document.createElement('div')
  el.className = 'etch-font-inspect-toast'
  el.setAttribute('role', 'status')
  el.innerHTML = html
  document.body.appendChild(el)
  toastEl = el

  const pad = 12
  const vw = window.innerWidth
  const vh = window.innerHeight
  const rect = el.getBoundingClientRect()
  let x = clientX + pad
  let y = clientY + pad
  if (x + rect.width > vw - pad) x = Math.max(pad, vw - rect.width - pad)
  if (y + rect.height > vh - pad) y = Math.max(pad, vh - rect.height - pad)
  el.style.left = `${x}px`
  el.style.top = `${y}px`

  hideTimer = setTimeout(removeToast, 6000)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function onContextMenu(e: MouseEvent) {
  const el = targetElement(e)
  if (!el || el.closest('.etch-font-inspect-toast')) return

  const cs = getComputedStyle(el)
  const fontFamily = cs.fontFamily || ''
  const fontSize = cs.fontSize || ''
  const fontWeight = cs.fontWeight || ''
  const { scale, fontRole, headingTag } = collectAncestors(el)

  const scaleLine = scale
    ? `text-${scale} (Tailwind)`
    : (() => {
        const px = parseFloat(fontSize)
        return Number.isFinite(px) ? inferScaleFromPx(px) : 'unknown (no text-* on ancestors)'
      })()

  const tagLine = headingTag ?? '—'
  const roleLine = fontRole ? `font-${fontRole}` : '—'

  const html = `
    <div class="etch-font-inspect-toast__title">Typography</div>
    <div class="etch-font-inspect-toast__row"><span class="etch-font-inspect-toast__k">Scale</span> ${escapeHtml(scaleLine)}</div>
    <div class="etch-font-inspect-toast__row"><span class="etch-font-inspect-toast__k">Tag</span> ${escapeHtml(tagLine)}</div>
    <div class="etch-font-inspect-toast__row"><span class="etch-font-inspect-toast__k">Role</span> ${escapeHtml(roleLine)}</div>
    <div class="etch-font-inspect-toast__row"><span class="etch-font-inspect-toast__k">Family</span> ${escapeHtml(fontFamily)}</div>
    <div class="etch-font-inspect-toast__row"><span class="etch-font-inspect-toast__k">Size</span> ${escapeHtml(fontSize)} · ${escapeHtml(fontWeight)}</div>
  `

  showToast(e.clientX, e.clientY, html)
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') removeToast()
}

let listenersAttached = false

/** Right-click any text to show computed font + scale (Tailwind text-* / heading tag / inferred). */
export function initFontInspect() {
  if (listenersAttached) return
  listenersAttached = true
  document.addEventListener('contextmenu', onContextMenu, true)
  document.addEventListener('keydown', onKeyDown, true)
}
