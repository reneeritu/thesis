let loadingCount = 0

const loadingListeners = new Set<() => void>()

function notifyLoadingListeners(): void {
  loadingListeners.forEach((fn) => fn())
}

/** True while any `beginLoading` is active (pairs with `endLoading`). */
export function getGlobalLoading(): boolean {
  return loadingCount > 0
}

/** Subscribe to global loading count for React `useSyncExternalStore`. */
export function subscribeGlobalLoading(onStoreChange: () => void): () => void {
  loadingListeners.add(onStoreChange)
  return () => {
    loadingListeners.delete(onStoreChange)
  }
}

export function beginLoading(): void {
  loadingCount++
  if (loadingCount === 1) document.body.classList.add('is-loading')
  notifyLoadingListeners()
}

export function endLoading(): void {
  loadingCount = Math.max(0, loadingCount - 1)
  if (loadingCount === 0) document.body.classList.remove('is-loading')
  notifyLoadingListeners()
}

/** Brief success feedback before navigation or next step */
export function flashDone(): void {
  document.body.classList.add('is-done')
  window.setTimeout(() => document.body.classList.remove('is-done'), 900)
}
