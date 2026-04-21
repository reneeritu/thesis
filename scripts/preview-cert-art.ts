/**
 * Contact sheet for the provenance-certificate generative engine.
 *
 * Renders a grid of every motif × palette combination using the *same* project
 * facts, so you can tell the motifs and palettes apart at a glance. Then
 * renders a "reroll sheet" for each motif showing what a few rerolls look
 * like on the house palette.
 *
 * Output: previews/cert-art/index.html — open it in a browser.
 *
 * Run:  npx tsx scripts/preview-cert-art.ts
 */
import { writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import {
  DEFAULT_OPTIONS,
  MOTIFS,
  PALETTES,
  renderSvg,
  type GenInput,
  type GenOptions,
  type Motif,
} from '../frontend/src/lib/provenanceArt'

// A single "representative" project used for the palette grid.
const HEAVY_INPUT: GenInput = {
  projectId: 'demo-heavy',
  title: 'Cathode & Cedar',
  contributors: [
    { alias: 'ren', weight: 1.5 },
    { alias: 'qwerty', weight: 1 },
    { alias: 'check1', weight: 1 },
    { alias: 'acc4', weight: 0.5 },
    { alias: '123456789', weight: 0.7 },
  ],
  traceCount: 64,
  pivotCount: 3,
  referenceCount: 11,
  blockHash: '1b3f7ac9e2d4b81c0a6f95c7d2c1e4a0d8f3a6b2e5c4d6f7a8b9c1d0e2f3a4b5',
  durationDays: 87,
  dominantActivity: 'iterate',
}

const LIGHT_INPUT: GenInput = {
  ...HEAVY_INPUT,
  projectId: 'demo-light',
  title: 'Short Sketch',
  contributors: [{ alias: 'ren' }, { alias: 'check1' }],
  traceCount: 8,
  pivotCount: 0,
  referenceCount: 2,
}

// Four different inputs, one per motif row on the reroll sheet, so the caption
// shows how project facts translate into visual density.
const VARIATIONS: { label: string; input: GenInput }[] = [
  { label: 'solo sketch (8 traces, 1 ctb)', input: { ...LIGHT_INPUT, contributors: [{ alias: 'ren' }] } },
  { label: 'duo iterating (24 traces, 2 ctb)', input: { ...LIGHT_INPUT, traceCount: 24, contributors: [{ alias: 'ren' }, { alias: 'acc4' }] } },
  { label: 'team build (64 traces, 5 ctb)', input: HEAVY_INPUT },
  { label: 'year-long collab (180 traces, 7 ctb)', input: { ...HEAVY_INPUT, projectId: 'demo-epic', title: 'Harbour Lights', traceCount: 180, pivotCount: 6, referenceCount: 18, contributors: [...HEAVY_INPUT.contributors, { alias: 'iris' }, { alias: 'jun' }] } },
]

function tile(svg: string, caption: string, widthPx = 260): string {
  return `<figure style="margin:0;display:flex;flex-direction:column;gap:6px;">
    <div style="width:${widthPx}px;aspect-ratio:1/1;border:1px solid #111;background:#fff;overflow:hidden;">${svg.replace(/width="\d+"|height="\d+"/g, '')}</div>
    <figcaption style="font:10px/1.35 ui-monospace,monospace;letter-spacing:0.14em;text-transform:uppercase;color:#555;">${caption}</figcaption>
  </figure>`
}

function paletteGrid(input: GenInput): string {
  const rows: string[] = []
  for (const motif of MOTIFS) {
    const cells = PALETTES.map((palette) => {
      const opts: GenOptions = { ...DEFAULT_OPTIONS, motif: motif as Motif, palette }
      const svg = renderSvg(input, opts)
      return tile(svg, `${motif} · ${palette}`, 220)
    }).join('')
    rows.push(`<div style="display:grid;grid-template-columns:repeat(${PALETTES.length},1fr);gap:14px;">${cells}</div>`)
  }
  return rows.join('<div style="height:22px"></div>')
}

function rerollSheet(): string {
  const rows: string[] = []
  for (const motif of MOTIFS) {
    const cells = VARIATIONS.map((v) => {
      const opts: GenOptions = { ...DEFAULT_OPTIONS, motif: motif as Motif, palette: 'cream_primaries' }
      const svg = renderSvg(v.input, opts)
      return tile(svg, `${motif} · ${v.label}`, 230)
    }).join('')
    rows.push(
      `<h3 style="font:11px/1.4 ui-monospace,monospace;letter-spacing:0.22em;text-transform:uppercase;color:#111;margin:24px 0 8px;">Input variety — ${motif}</h3>` +
        `<div style="display:grid;grid-template-columns:repeat(${VARIATIONS.length},1fr);gap:14px;">${cells}</div>`,
    )
  }
  return rows.join('')
}

function rerollLadder(): string {
  const rows: string[] = []
  for (const motif of MOTIFS) {
    const cells: string[] = []
    for (let i = 0; i < 6; i++) {
      const opts: GenOptions = { ...DEFAULT_OPTIONS, motif: motif as Motif, palette: 'cream_primaries', rerollIndex: i }
      const svg = renderSvg(HEAVY_INPUT, opts)
      cells.push(tile(svg, `${motif} · reroll #${i}`, 180))
    }
    rows.push(
      `<h3 style="font:11px/1.4 ui-monospace,monospace;letter-spacing:0.22em;text-transform:uppercase;color:#111;margin:24px 0 8px;">Reroll ladder — ${motif}</h3>` +
        `<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;">${cells.join('')}</div>`,
    )
  }
  return rows.join('')
}

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Provenance certificate — motif contact sheet</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 32px 40px 64px;
      font: 13px/1.55 -apple-system, "Segoe UI", Inter, sans-serif;
      background: #f5efe1;
      color: #0a0a0a;
    }
    h1 { font: 14px/1.4 ui-monospace, monospace; letter-spacing: 0.24em; text-transform: uppercase; margin: 0 0 4px; }
    p.lede { font: 11px/1.5 ui-monospace, monospace; color: #555; margin: 0 0 28px; max-width: 60ch; }
    h2 { font: 12px/1.4 ui-monospace, monospace; letter-spacing: 0.24em; text-transform: uppercase; margin: 36px 0 12px; }
  </style>
</head>
<body>
  <h1>Etch · Provenance certificate · Contact sheet</h1>
  <p class="lede">Every motif × palette rendered on the same project (${HEAVY_INPUT.contributors.length} ctb, ${HEAVY_INPUT.traceCount} traces, ${HEAVY_INPUT.pivotCount} pivots, ${HEAVY_INPUT.referenceCount} refs). Same seed, four different motifs, six palettes each.</p>

  <h2>Palette grid — heavy project</h2>
  ${paletteGrid(HEAVY_INPUT)}

  <h2>Palette grid — light project</h2>
  ${paletteGrid(LIGHT_INPUT)}

  <h2>Input variety (cream + primaries)</h2>
  ${rerollSheet()}

  <h2>Reroll ladder (cream + primaries)</h2>
  ${rerollLadder()}
</body>
</html>
`

const outDir = resolve(__dirname, '..', 'previews', 'cert-art')
mkdirSync(outDir, { recursive: true })
const outPath = resolve(outDir, 'index.html')
writeFileSync(outPath, html, 'utf8')
console.log('Wrote contact sheet →', outPath)
console.log('Open it with:')
console.log('  start "" "' + outPath + '"')
