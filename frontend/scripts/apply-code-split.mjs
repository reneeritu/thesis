/**
 * One-shot: improve Vite chunking (manualChunks + lazy hero + dynamic Theatre init).
 * Uses PowerShell Move-Item when direct writes fail (Windows file mapping).
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(fileURLToPath(new URL('.', import.meta.url)), '..')

function psQuote(p) {
  return p.replace(/'/g, "''")
}

function writeAtomic(target, content) {
  const tmp = `${target}.split-tmp-${process.pid}`
  fs.writeFileSync(tmp, content, 'utf8')
  try {
    execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Move-Item -LiteralPath '${psQuote(tmp)}' -Destination '${psQuote(target)}' -Force`,
      ],
      { stdio: 'inherit' },
    )
  } catch (e) {
    try {
      fs.unlinkSync(tmp)
    } catch {
      /* ignore */
    }
    throw e
  }
}

// --- vite.config.ts ---
const vitePath = path.join(root, 'vite.config.ts')
let vite = fs.readFileSync(vitePath, 'utf8').replace(/\r\n/g, '\n')
const viteOld = `    build: {
      /* three.module alone is ~700kB minified; warning is informational */
      chunkSizeWarningLimit: 900,
    },`
const viteNew = `    build: {
      /* three + R3F: single async vendor chunk, kept out of index */
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (
              /node_modules\\/three\\//.test(id) ||
              /node_modules\\/@react-three\\//.test(id) ||
              /node_modules\\/three-stdlib\\//.test(id) ||
              /node_modules\\/postprocessing\\//.test(id)
            ) {
              return 'vendor-three'
            }
            return undefined
          },
        },
      },
    },`
if (!vite.includes(viteOld)) {
  console.error('vite.config.ts: expected build block not found')
  process.exit(1)
}
vite = vite.split(viteOld).join(viteNew)
writeAtomic(vitePath, vite)
console.log('OK vite.config.ts')

// --- main.tsx ---
const mainPath = path.join(root, 'src', 'main.tsx')
let main = fs.readFileSync(mainPath, 'utf8').replace(/\r\n/g, '\n')
const mainOld = `import App from './App.tsx'
import { initEtchStudio } from './theatre/initEtchStudio'

/** Dev-only: single Studio bundle + R3F extension (see \`initEtchStudio.ts\`). */
initEtchStudio()
`
const mainNew = `import App from './App.tsx'

/** Dev-only: dynamic import keeps \`@theatre/*\` out of the initial JS graph. */
if (import.meta.env.DEV) {
  void import('./theatre/initEtchStudio').then(({ initEtchStudio }) => initEtchStudio())
}
`
if (!main.includes(mainOld)) {
  console.error('main.tsx: expected block not found')
  process.exit(1)
}
main = main.split(mainOld).join(mainNew)
writeAtomic(mainPath, main)
console.log('OK main.tsx')

// --- WelcomeLanding.tsx ---
const welcomePath = path.join(root, 'src', 'pages', 'WelcomeLanding.tsx')
let w = fs.readFileSync(welcomePath, 'utf8').replace(/\r\n/g, '\n')
const wOldImports = `import { useCallback, useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { HeroSection } from '../components/HeroSection'
import { initWelcomeLenis } from '../lib/welcomeLenis'
import { applyScrollProgressToTheatreSequence } from '../theatre/etchTheatre'
import { logEtchTheatreSaveJson } from '../theatre/initEtchStudio'
`
const wNewImports = `import { lazy, Suspense, useCallback, useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { initWelcomeLenis } from '../lib/welcomeLenis'
import { applyScrollProgressToTheatreSequence } from '../theatre/etchTheatre'

const HeroSection = lazy(() =>
  import('../components/HeroSection').then((m) => ({ default: m.HeroSection })),
)
`
if (!w.includes(wOldImports)) {
  console.error('WelcomeLanding.tsx: expected imports not found')
  process.exit(1)
}
w = w.split(wOldImports).join(wNewImports)

const wOldHero = `        <HeroSection onWelcomeTheatreIntroComplete={onWelcomeTheatreIntroComplete} />
`
const wNewHero = `        <Suspense
          fallback={
            <div
              className="min-h-screen w-full bg-[#18101F]"
              aria-hidden
            />
          }
        >
          <HeroSection onWelcomeTheatreIntroComplete={onWelcomeTheatreIntroComplete} />
        </Suspense>
`
if (!w.includes(wOldHero)) {
  console.error('WelcomeLanding.tsx: expected HeroSection JSX not found')
  process.exit(1)
}
w = w.split(wOldHero).join(wNewHero)

const wOldBtn = `            onClick={() => logEtchTheatreSaveJson()}
`
const wNewBtn = `            onClick={() =>
              void import('../theatre/initEtchStudio').then((m) => m.logEtchTheatreSaveJson())
            }
`
if (!w.includes(wOldBtn)) {
  console.error('WelcomeLanding.tsx: expected log button not found')
  process.exit(1)
}
w = w.split(wOldBtn).join(wNewBtn)

writeAtomic(welcomePath, w)
console.log('OK WelcomeLanding.tsx')
console.log('Done.')
