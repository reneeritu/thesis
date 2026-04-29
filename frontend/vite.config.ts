import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/** Repo root (parent of frontend/) — read PORT for API proxy target. */
const repoRoot = path.resolve(__dirname, '..')

/**
 * Backend route prefixes that must be forwarded to Express in dev.
 *
 * Several of these (e.g. /projects/:id, /spaces/:id) collide with SPA
 * routes of the same shape. We disambiguate using a `bypass` function:
 * only forward the request to Express if it looks like an API call
 * (XHR/fetch with Accept: application/json, or a POST/PUT/PATCH/DELETE).
 * Plain browser navigations (F5 on /projects/abc) fall through to the
 * SPA and let React Router render the right page.
 */
const API_PREFIXES = [
  '/auth',
  '/nodes',
  '/spaces',
  '/projects',
  '/traces',
  '/vetos',
  '/pivots',
  '/references',
  '/credits',
  '/nfts',
  '/forks',
  '/archives',
  '/mediations',
  '/flags',
  '/governance',
  '/notifications',
  '/sim',
  '/discover',
  '/endorsements',
  '/conversations',
  '/upload',
  '/media',
  '/health',
] as const

function isApiRequest(method?: string, accept?: string): boolean {
  const m = (method || 'GET').toUpperCase()
  if (m !== 'GET' && m !== 'HEAD') return true
  const a = accept || ''
  return a.includes('application/json')
}

/**
 * GET /media/:mongoObjectId serves raw bytes from Express. Browsers request those URLs
 * via <img src> with Accept: image/* — not application/json — so they must still be
 * proxied. Otherwise `isApiRequest` is false and bypass serves index.html, producing
 * broken images in dev.
 */
function isMediaBinaryPath(req: { method?: string; url?: string }): boolean {
  const method = (req.method || 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') return false
  const pathname = (req.url || '').split('?')[0] || ''
  return /^\/media\/[a-fA-F0-9]{24}\/?$/i.test(pathname)
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, '')
  const apiPort = env.PORT?.trim() || '3000'
  const proxyTarget = env.VITE_API_PROXY_TARGET?.trim() || `http://127.0.0.1:${apiPort}`

  const proxy: Record<string, ProxyOptions> = {}
  for (const prefix of API_PREFIXES) {
    proxy[prefix] = {
      target: proxyTarget,
      changeOrigin: false,
      bypass: (req: {
        method?: string
        headers?: { accept?: string | string[] }
        url?: string
      }) => {
        if (prefix === '/media' && isMediaBinaryPath(req)) return undefined
        const accept = Array.isArray(req.headers?.accept)
          ? req.headers!.accept.join(',')
          : req.headers?.accept
        if (isApiRequest(req.method, accept)) return undefined // proxy to Express
        return '/index.html' // browser nav → let the SPA handle it
      },
      configure(proxy) {
        proxy.on('error', (err: NodeJS.ErrnoException) => {
          console.error(
            `[vite] API proxy error → ${proxyTarget} (${err.code ?? err.message}). Is the Express server running?`,
          )
        })
      },
    }
  }

  return {
    plugins: [react()],
    build: {
      /* three.module alone is ~700kB minified; warning is informational */
      chunkSizeWarningLimit: 900,
    },
    server: {
      port: 5173,
      /**
       * Listen on all interfaces (0.0.0.0) so both `http://localhost` and
       * `http://127.0.0.1` work on Windows; default can bind IPv6-only and
       * break bookmarked 127.0.0.1 URLs.
       */
      host: true,
      /**
       * If 5173 is taken, Vite picks the next free port (e.g. 5174).
       * Always use the exact `Local: http://localhost:…` URL printed in the terminal.
       */
      strictPort: false,
      proxy,
    },
  }
})
