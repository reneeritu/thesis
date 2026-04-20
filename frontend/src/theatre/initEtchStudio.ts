/**
 * Theatre Studio UI — dev only. Keyframe objects on sheet "Main" in project {@link ETCH_THEATRE_PROJECT_ID}.
 * Registers `@theatre/r3f` so the 3D snapshot / editable tree works.
 *
 * Call once from `main.tsx`. Do not also `import studio from '@theatre/studio'` elsewhere — a second
 * bundle/instance breaks Studio (missing Export UI, "pending" projects, WebGL context issues).
 */
import type { IExtension, IStudio } from '@theatre/studio'

import { ETCH_THEATRE_PROJECT_ID } from './etchTheatre'

/** CJS/ESM interop: `import()` sometimes yields `{ default: { default: x } }`. */
function unwrapDefault<T>(mod: { default: unknown }): T {
  const d = mod.default as { default?: unknown }
  if (d && typeof d === 'object' && 'default' in d && d.default != null) {
    return d.default as T
  }
  return mod.default as T
}

/** Set after {@link initEtchStudio} finishes (dev only). */
let studioSingleton: IStudio | null = null

/**
 * Programmatic export (same JSON as Studio’s “Export …” when it’s working).
 * In the browser console: `window.__etchLogTheatreSaveJson()` or click the dev button on `/welcome`.
 */
export function logEtchTheatreSaveJson(): void {
  if (!import.meta.env.DEV) return
  const studio = studioSingleton ?? (typeof window !== 'undefined' ? getStudioFromWindow() : null)
  if (!studio?.createContentOfSaveFile) {
    console.warn(
      '[Theatre] Studio is not ready — wait for initEtchStudio(), then try again. If this persists, hard-refresh (single @theatre/studio bundle).',
    )
    return
  }
  const json = studio.createContentOfSaveFile(ETCH_THEATRE_PROJECT_ID)
  console.log(`[Theatre] createContentOfSaveFile("${ETCH_THEATRE_PROJECT_ID}"):`)
  console.log(JSON.stringify(json, null, 2))
}

function getStudioFromWindow(): IStudio | null {
  const w = window as unknown as { __THEATREJS_STUDIO__?: IStudio }
  return w.__THEATREJS_STUDIO__ ?? null
}

function attachStudioToWindow(studio: IStudio): void {
  if (typeof window === 'undefined') return
  const w = window as unknown as {
    __THEATREJS_STUDIO__?: IStudio
    __ETCH_THEATRE_PROJECT_ID__?: typeof ETCH_THEATRE_PROJECT_ID
    __etchLogTheatreSaveJson?: typeof logEtchTheatreSaveJson
  }
  w.__THEATREJS_STUDIO__ = studio
  w.__ETCH_THEATRE_PROJECT_ID__ = ETCH_THEATRE_PROJECT_ID
  w.__etchLogTheatreSaveJson = logEtchTheatreSaveJson
}

export function initEtchStudio(): void {
  if (!import.meta.env.DEV) return

  void Promise.all([import('@theatre/studio'), import('@theatre/r3f/dist/extension')]).then(
    ([studioMod, r3fMod]) => {
      const studio = unwrapDefault<IStudio>(studioMod as { default: unknown })
      const r3fExtension = unwrapDefault<IExtension>(r3fMod as { default: unknown })

      studio.initialize({
        persistenceKey: 'theatre:etch:main',
        usePersistentStorage: true,
      })
      studio.extend(r3fExtension)

      studioSingleton = studio
      attachStudioToWindow(studio)
    },
  )
}
