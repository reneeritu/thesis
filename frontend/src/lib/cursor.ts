let loadingCount = 0

export function beginLoading(): void {
  loadingCount++
  if (loadingCount === 1) document.body.classList.add('is-loading')
}

export function endLoading(): void {
  loadingCount = Math.max(0, loadingCount - 1)
  if (loadingCount === 0) document.body.classList.remove('is-loading')
}

/** Brief success feedback before navigation or next step */
export function flashDone(): void {
  document.body.classList.add('is-done')
  window.setTimeout(() => document.body.classList.remove('is-done'), 900)
}
