import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Scramble-reveal text animation.
 * Characters cycle through `characters` pool before settling on the real char.
 */
export default function DecryptedText({
  text = '',
  speed = 20,
  maxIterations = null,
  characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*',
  sequential = true,
  revealDirection = 'start',
  animateOn = 'view',
  className = '',
  encryptedClassName = '',
  style = {},
  onAnimationComplete,
}) {
  const [displayText, setDisplayText] = useState(text)
  const [isAnimating, setIsAnimating] = useState(false)
  const containerRef = useRef(null)
  const frameRef = useRef(null)
  const revealedRef = useRef(new Set())
  const startedRef = useRef(false)

  const getRandChar = useCallback(
    () => characters[Math.floor(Math.random() * characters.length)],
    [characters],
  )

  const getRevealOrder = useCallback(
    (len) => {
      const indices = Array.from({ length: len }, (_, i) => i)
      if (revealDirection === 'end') return indices.reverse()
      if (revealDirection === 'center') {
        const mid = Math.floor(len / 2)
        return indices.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))
      }
      if (revealDirection === 'random') {
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[indices[i], indices[j]] = [indices[j], indices[i]]
        }
        return indices
      }
      return indices // 'start'
    },
    [revealDirection],
  )

  const animate = useCallback(() => {
    if (startedRef.current) return
    startedRef.current = true
    setIsAnimating(true)

    const len = text.length
    const revealOrder = getRevealOrder(len)
    revealedRef.current = new Set()

    let orderIdx = 0
    let scrambleCount = 0
    // maxIterations prop wins when provided; otherwise derive from speed
    const scramblePerChar = maxIterations != null
      ? Math.max(1, maxIterations)
      : Math.max(1, Math.round(500 / speed))

    const tick = () => {
      const chars = text.split('')

      if (sequential) {
        // Scramble unrevealed chars, reveal one at a time
        for (let i = 0; i < len; i++) {
          if (revealedRef.current.has(i)) {
            // already settled
          } else if (i === revealOrder[orderIdx]) {
            chars[i] = scrambleCount < scramblePerChar ? getRandChar() : text[i]
            if (scrambleCount >= scramblePerChar) {
              revealedRef.current.add(i)
              scrambleCount = 0
              orderIdx++
            } else {
              scrambleCount++
            }
          } else {
            chars[i] = getRandChar()
          }
        }
      } else {
        // All chars scramble simultaneously, settle over time
        for (let i = 0; i < len; i++) {
          if (revealedRef.current.has(i)) continue
          if (Math.random() < 0.08) {
            revealedRef.current.add(i)
          } else {
            chars[i] = getRandChar()
          }
        }
      }

      setDisplayText(chars.join(''))

      if (revealedRef.current.size < len) {
        frameRef.current = window.setTimeout(tick, 1000 / 60)
      } else {
        setDisplayText(text)
        setIsAnimating(false)
        onAnimationComplete?.()
      }
    }

    frameRef.current = window.setTimeout(tick, 1000 / 60)
  }, [text, speed, sequential, getRandChar, getRevealOrder, onAnimationComplete])

  // Seed display with scrambled text initially
  useEffect(() => {
    if (animateOn === 'view') {
      setDisplayText(
        text
          .split('')
          .map((c) => (c === ' ' ? ' ' : getRandChar()))
          .join(''),
      )
    }
  }, [text, animateOn, getRandChar])

  useEffect(() => {
    if (animateOn === 'load') {
      animate()
    }
  }, [animateOn, animate])

  // IntersectionObserver for animateOn="view"
  useEffect(() => {
    if (animateOn !== 'view') return
    const el = containerRef.current
    if (!el) return

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          animate()
          obs.disconnect()
        }
      },
      { threshold: 0.1 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [animateOn, animate])

  // Reset on text change
  useEffect(() => {
    startedRef.current = false
    revealedRef.current = new Set()
    if (frameRef.current) clearTimeout(frameRef.current)
    setDisplayText(
      text
        .split('')
        .map((c) => (c === ' ' ? ' ' : getRandChar()))
        .join(''),
    )
  }, [text]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span
      ref={containerRef}
      className={className}
      style={{ ...style, fontVariantNumeric: 'tabular-nums' }}
      aria-label={text}
    >
      {displayText.split('').map((char, i) => (
        <span
          key={i}
          className={
            !isAnimating || revealedRef.current.has(i) ? className : encryptedClassName
          }
          style={{ opacity: char === ' ' ? 0 : 1, display: 'inline-block', minWidth: char === ' ' ? '0.35em' : undefined }}
        >
          {char === ' ' ? '\u00a0' : char}
        </span>
      ))}
    </span>
  )
}
