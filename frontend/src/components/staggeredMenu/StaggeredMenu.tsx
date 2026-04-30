/**
 * GSAP staggered slide panel (React Bits pattern).
 * `variant="dropdown"` matches Etch `.floating-glass-panel` width (~min(14rem, 42vw), min 200px).
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { useChromeBackdropWhileOpen } from '../../context/ChromeBackdropContext'

import './StaggeredMenu.css'

export type StaggeredMenuItem = {
  label: string
  ariaLabel: string
  link: string
}

export type StaggeredMenuSocialItem = {
  label: string
  link: string
}

export type StaggeredMenuVariant = 'fullscreen' | 'dropdown'

/** `variant="dropdown"` only; fullscreen wipes ignore this. */
export type DropdownEntrance = 'fromSide' | 'fromTriggerBelow'

export type StaggeredMenuProps = {
  position?: 'left' | 'right'
  colors?: string[]
  items?: StaggeredMenuItem[]
  socialItems?: StaggeredMenuSocialItem[]
  displaySocials?: boolean
  displayItemNumbering?: boolean
  className?: string
  panelClassName?: string
  logoUrl?: string
  showLogo?: boolean
  menuButtonColor?: string
  openMenuButtonColor?: string
  accentColor?: string
  changeMenuColorOnOpen?: boolean
  isFixed?: boolean
  closeOnClickAway?: boolean
  onMenuOpen?: () => void
  onMenuClose?: () => void
  variant?: StaggeredMenuVariant
  /**
   * When `variant="dropdown"`: horizontal slide (`fromSide`, default, e.g. app nav) vs
   * vertical reveal from under the toggle only (`fromTriggerBelow`, e.g. preference rows).
   */
  dropdownEntrance?: DropdownEntrance
  shuffleToggleText?: boolean
  toggleLabels?: { closed: string; open: string }
  /** Merged onto the menu toggle (e.g. shell `navBtn`). */
  toggleClassName?: string
}

function isInternalPath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) return false
  // Static `.html` or hash-only legacy mounts need a full navigation, not SPA client routing.
  if (path.includes('.html')) return false
  return true
}

/** Fullscreen wipe (large type). */
const PRINT_INK_DROP_Y = 96
const PRINT_INK_SKEW_X = 10
/** App shell dropdown (narrow column). */
const PRINT_INK_DD_Y = 32
const PRINT_INK_DD_SKEW_X = 5

/** After GSAP, release inline transforms so CSS controls static misregistration + hover buzz. */
function settlePrintInk(panel: HTMLElement) {
  gsap.set(panel.querySelectorAll('.sm-print-main, .sm-print-ink'), { clearProps: 'transform' })
  panel.querySelectorAll('.sm-print-register').forEach((el) => {
    el.classList.add('sm-print--settled')
  })
}

function unsettlePrintInk(panel: HTMLElement) {
  panel.querySelectorAll('.sm-print-register').forEach((el) => {
    el.classList.remove('sm-print--settled')
  })
}

function resetPrintInkForNextOpen(panel: HTMLElement, dropdown: boolean) {
  unsettlePrintInk(panel)
  const y = dropdown ? PRINT_INK_DD_Y : PRINT_INK_DROP_Y
  const pull = dropdown ? 12 : 20
  const sx = dropdown ? PRINT_INK_DD_SKEW_X : PRINT_INK_SKEW_X
  gsap.set(panel.querySelectorAll('.sm-print-main'), { y })
  gsap.set(panel.querySelectorAll('.sm-print-cyan'), { y: y + pull, x: -sx })
  gsap.set(panel.querySelectorAll('.sm-print-magenta'), { y: y + pull, x: sx })
}

const panelLinkClass =
  'sm-panel-item etch-float-menu-item block w-full !border-b !border-grey-100/20 text-left outline-none ring-0 hover:text-yellow-400'

/** Spider-Verse style CMY misregistration (fullscreen wipe only). */
function PrintMisregistrationLabel({ text }: { text: string }) {
  return (
    <span className="sm-panel-itemLabel sm-print-register">
      <span className="sm-print-ink sm-print-magenta magenta-layer" aria-hidden>
        {text}
      </span>
      <span className="sm-print-ink sm-print-cyan cyan-layer" aria-hidden>
        {text}
      </span>
      <span className="sm-print-main">{text}</span>
    </span>
  )
}

function PanelLink({
  it,
  onNavigate,
  displayNumbering,
  index,
  printMisregistration = true,
}: {
  it: StaggeredMenuItem
  onNavigate: () => void
  displayNumbering: boolean
  index: number
  printMisregistration?: boolean
}) {
  const label = printMisregistration ? (
    <PrintMisregistrationLabel text={it.label} />
  ) : (
    <span className="sm-panel-itemLabel">{it.label}</span>
  )
  const dataIndexProps = displayNumbering ? ({ 'data-index': index + 1 } as const) : {}

  if (isInternalPath(it.link)) {
    return (
      <Link
        to={it.link}
        className={panelLinkClass}
        aria-label={it.ariaLabel}
        onClick={onNavigate}
        {...dataIndexProps}
      >
        {label}
      </Link>
    )
  }

  return (
    <a
      href={it.link}
      className={panelLinkClass}
      aria-label={it.ariaLabel}
      onClick={onNavigate}
      target={it.link.startsWith('http') ? '_blank' : undefined}
      rel={it.link.startsWith('http') ? 'noopener noreferrer' : undefined}
      {...dataIndexProps}
    >
      {label}
    </a>
  )
}

export function StaggeredMenu({
  position = 'right',
  colors = ['#6a4580', '#1a1430'],
  items = [],
  socialItems = [],
  displaySocials = false,
  displayItemNumbering = false,
  className = '',
  panelClassName = '',
  logoUrl,
  showLogo,
  menuButtonColor = 'rgba(255,255,255,0.9)',
  openMenuButtonColor = '#facc15',
  accentColor = '#facc15',
  changeMenuColorOnOpen = true,
  isFixed = false,
  closeOnClickAway = true,
  onMenuOpen,
  onMenuClose,
  variant = 'fullscreen',
  shuffleToggleText = true,
  toggleLabels = { closed: 'Menu', open: 'Close' },
  toggleClassName = '',
  dropdownEntrance = 'fromSide',
}: StaggeredMenuProps) {
  const dropdown = variant === 'dropdown'
  const dropFromBelow = dropdown && dropdownEntrance === 'fromTriggerBelow'
  /** Top-down wipe; shell dropdown uses `dropdownEntrance` for motion. */
  const verticalWipe = !dropdown

  const [open, setOpen] = useState(false)
  const openRef = useRef(false)
  const panelRef = useRef<HTMLElement>(null)
  const preLayersRef = useRef<HTMLDivElement>(null)
  const preLayerElsRef = useRef<HTMLElement[]>([])
  const plusHRef = useRef<HTMLSpanElement>(null)
  const plusVRef = useRef<HTMLSpanElement>(null)
  const iconRef = useRef<HTMLSpanElement>(null)
  const textInnerRef = useRef<HTMLSpanElement>(null)
  const textWrapRef = useRef<HTMLSpanElement>(null)

  /** Shuffle mode only; Navigate/Close mode derives lines from `open` + `toggleLabels`. */
  const [shuffleTextLines, setShuffleTextLines] = useState<string[]>(() =>
    shuffleToggleText ? ['Menu', 'Close'] : [],
  )

  const displayToggleLines = shuffleToggleText
    ? shuffleTextLines
    : [open ? toggleLabels.open : toggleLabels.closed]

  const displayToggleLinesVisible = displayToggleLines.filter((l) => l.trim().length > 0)

  useEffect(() => {
    openRef.current = open
  }, [open])

  useChromeBackdropWhileOpen(dropdown && open)

  const openTlRef = useRef<gsap.core.Timeline | null>(null)
  const closeTweenRef = useRef<gsap.core.Tween | null>(null)
  const spinTweenRef = useRef<gsap.core.Tween | null>(null)
  const textCycleAnimRef = useRef<gsap.core.Tween | null>(null)
  const colorTweenRef = useRef<gsap.core.Tween | null>(null)
  const toggleBtnRef = useRef<HTMLButtonElement>(null)
  const busyRef = useRef(false)

  const defaultsLogo = logoUrl ?? '/favicon.svg'
  const showLogoResolved = typeof showLogo === 'boolean' ? showLogo : !dropdown

  const wrapperClass = useMemo(() => {
    const bits = ['staggered-menu-wrapper', className]
    if (isFixed && !dropdown) bits.push('fixed-wrapper')
    if (dropdown) {
      bits.push('sm-variant-dropdown')
      if (dropFromBelow) bits.push('sm-dropdown-from-trigger')
    }
    return bits.filter(Boolean).join(' ')
  }, [className, dropFromBelow, dropdown, isFixed])

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const panel = panelRef.current
      const plusH = plusHRef.current
      const plusV = plusVRef.current
      const icon = iconRef.current
      const textInner = textInnerRef.current
      const preContainer = preLayersRef.current
      if (!panel || !plusH || !plusV || !icon || !textInner) return

      let preLayers: HTMLElement[] = []
      if (preContainer && !dropdown) {
        preLayers = Array.from(preContainer.querySelectorAll('.sm-prelayer')) as HTMLElement[]
      }
      preLayerElsRef.current = preLayers

      if (verticalWipe) {
        gsap.set([panel, ...preLayers], { yPercent: -100, xPercent: 0, opacity: 1 })
        if (preContainer) gsap.set(preContainer, { xPercent: 0, yPercent: 0, opacity: 1 })
      } else {
        const offscreen = position === 'left' ? -100 : 100
        gsap.set([panel, ...preLayers], { xPercent: offscreen, yPercent: 0, opacity: 1 })
        if (preContainer) gsap.set(preContainer, { xPercent: 0, yPercent: 0, opacity: 1 })
        if (dropdown && dropdownEntrance === 'fromTriggerBelow') {
          gsap.set(panel, { xPercent: 0, yPercent: -100, opacity: 1 })
        }
      }
      gsap.set(plusH, { transformOrigin: '50% 50%', rotate: 0 })
      gsap.set(plusV, { transformOrigin: '50% 50%', rotate: 90 })
      gsap.set(icon, { rotate: 0, transformOrigin: '50% 50%' })
      gsap.set(textInner, { yPercent: 0 })
      if (toggleBtnRef.current) gsap.set(toggleBtnRef.current, { color: menuButtonColor })

      if (dropdown) {
        gsap.set(panel, { autoAlpha: 0 })
      }
    })
    return () => ctx.revert()
  }, [dropdown, dropdownEntrance, menuButtonColor, position, verticalWipe])

  const buildOpenTimeline = useCallback(() => {
    const panel = panelRef.current
    const layers = preLayerElsRef.current
    if (!panel) return null

    gsap.set(panel, { visibility: 'visible', autoAlpha: 1 })

    openTlRef.current?.kill()
    if (closeTweenRef.current) {
      closeTweenRef.current.kill()
      closeTweenRef.current = null
    }

    const itemLabelsPlain = Array.from(panel.querySelectorAll('.sm-panel-itemLabel:not(.sm-print-register)'))
    const itemLabelsLegacy = Array.from(panel.querySelectorAll('.sm-panel-itemLabel'))
    const printMains = Array.from(panel.querySelectorAll('.sm-print-main'))
    const printCyans = Array.from(panel.querySelectorAll('.sm-print-cyan'))
    const printMags = Array.from(panel.querySelectorAll('.sm-print-magenta'))
    const hasPrintMisregistration =
      printMains.length > 0 &&
      printMains.length === printCyans.length &&
      printMains.length === printMags.length

    const numberEls = Array.from(
      panel.querySelectorAll('.sm-panel-list[data-numbering] .sm-panel-item'),
    )
    const socialTitle = panel.querySelector('.sm-socials-title')
    const socialLinks = Array.from(panel.querySelectorAll('.sm-socials-link'))

    if (numberEls.length) gsap.set(numberEls, { '--sm-num-opacity': 0 } as gsap.TweenVars)
    if (socialTitle) gsap.set(socialTitle, { opacity: 0 })
    if (socialLinks.length) gsap.set(socialLinks, { y: 25, opacity: 0 })

    const tl = gsap.timeline({
      paused: true,
      onComplete: () => {
        if (hasPrintMisregistration) settlePrintInk(panel)
        busyRef.current = false
      },
    })

    if (verticalWipe) {
      const offY = -100
      const layerStates = layers.map((el) => ({ el, start: offY }))

      if (!hasPrintMisregistration && itemLabelsLegacy.length)
        gsap.set(itemLabelsLegacy, { yPercent: 140, rotate: 8 })

      layerStates.forEach((ls, i) => {
        tl.fromTo(
          ls.el,
          { yPercent: ls.start, xPercent: 0 },
          { yPercent: 0, xPercent: 0, duration: 0.6, ease: 'power4.out' },
          i * 0.1,
        )
      })

      tl.fromTo(
        panel,
        { yPercent: -100, xPercent: 0 },
        { yPercent: 0, xPercent: 0, duration: 0.8, ease: 'power4.out' },
        '-=0.4',
      )

      if (hasPrintMisregistration) {
        unsettlePrintInk(panel)
        gsap.set(printMains, { y: PRINT_INK_DROP_Y })
        gsap.set(printCyans, { y: PRINT_INK_DROP_Y + 20, x: -PRINT_INK_SKEW_X })
        gsap.set(printMags, { y: PRINT_INK_DROP_Y + 20, x: PRINT_INK_SKEW_X })

        tl.to(
          printMains,
          {
            y: 0,
            duration: 0.82,
            ease: 'power4.out',
            stagger: { each: 0.08, from: 'start' },
          },
          '-=0.35',
        )
        tl.to(
          printCyans,
          {
            y: 0,
            x: -0.5,
            duration: 1.06,
            ease: 'power3.out',
            stagger: { each: 0.08, from: 'start' },
          },
          '<0.1',
        )
        tl.to(
          printMags,
          {
            y: 0,
            x: 0.5,
            duration: 1.06,
            ease: 'power3.out',
            stagger: { each: 0.08, from: 'start' },
          },
          '<',
        )

        if (numberEls.length) {
          tl.to(
            numberEls,
            {
              duration: 0.5,
              ease: 'power2.out',
              '--sm-num-opacity': 1,
              stagger: { each: 0.07, from: 'start' },
            } as gsap.TweenVars,
            '-=0.5',
          )
        }
      } else if (itemLabelsPlain.length) {
        tl.to(
          itemLabelsPlain,
          {
            yPercent: 0,
            rotate: 0,
            duration: 0.9,
            ease: 'power4.out',
            stagger: { each: 0.08, from: 'start' },
          },
          '-=0.35',
        )
        if (numberEls.length) {
          tl.to(
            numberEls,
            {
              duration: 0.5,
              ease: 'power2.out',
              '--sm-num-opacity': 1,
              stagger: { each: 0.07, from: 'start' },
            } as gsap.TweenVars,
            '-=0.45',
          )
        }
      }
    } else {
      if (!hasPrintMisregistration && itemLabelsLegacy.length)
        gsap.set(itemLabelsLegacy, { yPercent: 140, rotate: dropdown ? 0 : 10 })

      let panelInsertTime = 0
      let panelDuration = dropdown ? 0.4 : 0.65

      if (dropFromBelow) {
        panelInsertTime = 0
        panelDuration = 0.4
        tl.fromTo(
          panel,
          { xPercent: 0, yPercent: -100 },
          {
            xPercent: 0,
            yPercent: 0,
            duration: panelDuration,
            ease: 'power3.out',
          },
          panelInsertTime,
        )
      } else {
        const offscreen = position === 'left' ? -100 : 100
        const layerStates = layers.map((el) => ({ el, start: offscreen }))
        const panelStart = offscreen

        layerStates.forEach((ls, i) => {
          tl.fromTo(
            ls.el,
            { xPercent: ls.start, yPercent: 0 },
            { xPercent: 0, yPercent: 0, duration: 0.45, ease: 'power4.out' },
            i * 0.05,
          )
        })
        const lastTime = layerStates.length ? (layerStates.length - 1) * 0.05 : 0
        panelInsertTime = lastTime + (layerStates.length ? 0.06 : 0)
        panelDuration = dropdown ? 0.4 : 0.65

        tl.fromTo(
          panel,
          { xPercent: panelStart, yPercent: 0, y: dropdown ? -5 : 0 },
          {
            xPercent: 0,
            yPercent: 0,
            y: 0,
            duration: panelDuration,
            ease: dropdown ? 'power3.out' : 'power4.out',
          },
          panelInsertTime,
        )
      }

      if (itemLabelsLegacy.length) {
        const itemsStartRatio = 0.12
        const itemsStart = panelInsertTime + panelDuration * itemsStartRatio

        if (hasPrintMisregistration) {
          unsettlePrintInk(panel)
          gsap.set(printMains, { y: PRINT_INK_DD_Y })
          gsap.set(printCyans, { y: PRINT_INK_DD_Y + 12, x: -PRINT_INK_DD_SKEW_X })
          gsap.set(printMags, { y: PRINT_INK_DD_Y + 12, x: PRINT_INK_DD_SKEW_X })

          tl.to(
            printMains,
            {
              y: 0,
              duration: 0.36,
              ease: 'power4.out',
              stagger: { each: 0.04, from: 'start' },
            },
            itemsStart,
          )
          tl.to(
            printCyans,
            {
              y: 0,
              x: -0.35,
              duration: 0.52,
              ease: 'power3.out',
              stagger: { each: 0.04, from: 'start' },
            },
            '<0.08',
          )
          tl.to(
            printMags,
            {
              y: 0,
              x: 0.35,
              duration: 0.52,
              ease: 'power3.out',
              stagger: { each: 0.04, from: 'start' },
            },
            '<',
          )
        } else {
          tl.to(
            itemLabelsLegacy,
            {
              yPercent: 0,
              rotate: 0,
              duration: dropdown ? 0.45 : 1,
              ease: 'power4.out',
              stagger: { each: dropdown ? 0.05 : 0.1, from: 'start' },
            },
            itemsStart,
          )
        }
        if (numberEls.length) {
          tl.to(
            numberEls,
            {
              duration: 0.45,
              ease: 'power2.out',
              '--sm-num-opacity': 1,
              stagger: { each: 0.06, from: 'start' },
            } as gsap.TweenVars,
            itemsStart + 0.08,
          )
        }
      }
    }

    openTlRef.current = tl
    return tl
  }, [dropdown, dropFromBelow, position, verticalWipe])

  const playOpen = useCallback(() => {
    if (busyRef.current) return
    busyRef.current = true
    const tl = buildOpenTimeline()
    if (tl) tl.play(0)
    else busyRef.current = false
  }, [buildOpenTimeline])

  const playClose = useCallback(() => {
    openTlRef.current?.kill()
    openTlRef.current = null

    const panel = panelRef.current
    const layers = preLayerElsRef.current
    if (!panel) return

    const all = [...layers, panel]
    closeTweenRef.current?.kill()

    if (verticalWipe) {
      closeTweenRef.current = gsap.to(all, {
        yPercent: -100,
        xPercent: 0,
        duration: 0.36,
        ease: 'power3.in',
        overwrite: 'auto',
        onComplete: () => {
          const hasPrintInk = panel.querySelectorAll('.sm-print-main').length > 0
          if (hasPrintInk) resetPrintInkForNextOpen(panel, false)
          else {
            const labels = panel.querySelectorAll('.sm-panel-itemLabel')
            if (labels.length) gsap.set(labels, { yPercent: 140, rotate: 8 })
          }
          const numberEls = Array.from(
            panel.querySelectorAll('.sm-panel-list[data-numbering] .sm-panel-item'),
          )
          if (numberEls.length)
            gsap.set(numberEls, { '--sm-num-opacity': 0 } as gsap.TweenVars)
          gsap.set(panel, { autoAlpha: 0 })
          busyRef.current = false
        },
      })
    } else {
      const offscreen = position === 'left' ? -100 : 100
      const closeVars =
        dropFromBelow ?
          { xPercent: 0, yPercent: -100, duration: dropdown ? 0.22 : 0.32, ease: 'power3.in' as const }
        : { xPercent: offscreen, yPercent: 0, duration: dropdown ? 0.2 : 0.32, ease: 'power3.in' as const }
      closeTweenRef.current = gsap.to(all, {
        ...closeVars,
        overwrite: 'auto',
        onComplete: () => {
          const hasPrintInk = panel.querySelectorAll('.sm-print-main').length > 0
          if (hasPrintInk) resetPrintInkForNextOpen(panel, true)
          else {
            const itemEls = Array.from(panel.querySelectorAll('.sm-panel-itemLabel'))
            if (itemEls.length) gsap.set(itemEls, { yPercent: 140, rotate: dropdown ? 0 : 10 })
          }
          const numberEls = Array.from(
            panel.querySelectorAll('.sm-panel-list[data-numbering] .sm-panel-item'),
          )
          if (numberEls.length)
            gsap.set(numberEls, { '--sm-num-opacity': 0 } as gsap.TweenVars)
          gsap.set(panel, { autoAlpha: 0 })
          busyRef.current = false
        },
      })
    }
  }, [dropdown, dropFromBelow, position, verticalWipe])

  const animateIcon = useCallback(
    (opening: boolean) => {
      const icon = iconRef.current
      if (!icon) return
      spinTweenRef.current?.kill()
      spinTweenRef.current = gsap.to(icon, {
        rotate: opening ? 225 : 0,
        duration: opening ? 0.55 : 0.3,
        ease: opening ? 'power4.out' : 'power3.inOut',
        overwrite: 'auto',
      })
    },
    [],
  )

  const animateColor = useCallback(
    (opening: boolean) => {
      const btn = toggleBtnRef.current
      if (!btn) return
      colorTweenRef.current?.kill()
      if (changeMenuColorOnOpen) {
        const targetColor = opening ? openMenuButtonColor : menuButtonColor
        colorTweenRef.current = gsap.to(btn, {
          color: targetColor,
          delay: dropdown ? 0.05 : 0.18,
          duration: 0.26,
          ease: 'power2.out',
        })
      } else gsap.set(btn, { color: menuButtonColor })
    },
    [changeMenuColorOnOpen, dropdown, menuButtonColor, openMenuButtonColor],
  )

  useEffect(() => {
    if (!toggleBtnRef.current) return
    const targetColor = changeMenuColorOnOpen
      ? openRef.current
        ? openMenuButtonColor
        : menuButtonColor
      : menuButtonColor
    gsap.set(toggleBtnRef.current, { color: targetColor })
  }, [changeMenuColorOnOpen, menuButtonColor, openMenuButtonColor])

  const animateText = useCallback(
    (opening: boolean) => {
      const inner = textInnerRef.current
      if (!inner) return
      textCycleAnimRef.current?.kill()

      if (!shuffleToggleText) {
        gsap.set(inner, { yPercent: 0 })
        return
      }

      const currentLabel = opening ? 'Menu' : 'Close'
      const targetLabel = opening ? 'Close' : 'Menu'
      const cycles = 3
      const seq: string[] = [currentLabel]
      let last = currentLabel
      for (let i = 0; i < cycles; i++) {
        last = last === 'Menu' ? 'Close' : 'Menu'
        seq.push(last)
      }
      if (last !== targetLabel) seq.push(targetLabel)
      seq.push(targetLabel)
      setShuffleTextLines(seq)

      gsap.set(inner, { yPercent: 0 })
      const lineCount = seq.length
      const finalShift = ((lineCount - 1) / lineCount) * 100
      textCycleAnimRef.current = gsap.to(inner, {
        yPercent: -finalShift,
        duration: 0.5 + lineCount * 0.07,
        ease: 'power4.out',
      })
    },
    [shuffleToggleText],
  )

  const closeMenuInternal = useCallback(() => {
    if (!openRef.current) return
    openRef.current = false
    setOpen(false)
    onMenuClose?.()
    playClose()
    animateIcon(false)
    animateColor(false)
    animateText(false)
  }, [animateColor, animateIcon, animateText, onMenuClose, playClose])

  const toggleMenu = useCallback(() => {
    const target = !openRef.current
    openRef.current = target
    setOpen(target)
    if (target) {
      onMenuOpen?.()
      playOpen()
    } else {
      onMenuClose?.()
      playClose()
    }
    animateIcon(target)
    animateColor(target)
    animateText(target)
  }, [animateColor, animateIcon, animateText, onMenuClose, onMenuOpen, playClose, playOpen])

  useEffect(() => {
    if (!closeOnClickAway || !open) return

    function handleMouseDown(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        toggleBtnRef.current &&
        !toggleBtnRef.current.contains(e.target as Node)
      ) {
        closeMenuInternal()
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [closeOnClickAway, closeMenuInternal, open])

  const accentStyle: CSSProperties | undefined = accentColor
    ? { ['--sm-accent' as keyof CSSProperties & string]: accentColor }
    : undefined

  return (
    <div
      className={wrapperClass}
      style={accentStyle}
      data-position={position}
      data-open={open || undefined}
      data-sm-wipe={verticalWipe ? 'vertical' : 'horizontal'}
      data-dropdown-entrance={
        dropdown ? (dropFromBelow ? 'from-trigger-below' : 'from-side') : undefined
      }
    >
      {!dropdown && (
        <div ref={preLayersRef} className="sm-prelayers" aria-hidden="true">
          {(() => {
            const raw = colors?.length ? colors.slice(0, 4) : ['#1e1e22', '#35353c']
            const arr = [...raw]
            if (arr.length >= 3) {
              arr.splice(Math.floor(arr.length / 2), 1)
            }
            return arr.map((c, i) => <div key={i} className="sm-prelayer" style={{ background: c }} />)
          })()}
        </div>
      )}

      <header className="staggered-menu-header">
        {showLogoResolved ? (
          <div className="sm-logo" aria-hidden>
            <img
              src={defaultsLogo}
              alt=""
              className="sm-logo-img"
              draggable={false}
              width={110}
              height={24}
            />
          </div>
        ) : (
          <span className="min-w-[1px]" aria-hidden />
        )}
        <button
          ref={toggleBtnRef}
          type="button"
          data-label-empty={open && toggleLabels.open.trim().length === 0 ? 'true' : undefined}
          className={`sm-toggle etch-float-caps flex min-w-0 items-center gap-1 ${toggleClassName}`.trim()}
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={open}
          aria-controls="staggered-menu-panel"
          onClick={toggleMenu}
        >
          <span ref={textWrapRef} className="sm-toggle-textWrap" aria-hidden="true">
            <span ref={textInnerRef} className="sm-toggle-textInner">
              {displayToggleLinesVisible.map((l, i) => (
                <span className="sm-toggle-line" key={`${String(i)}-${l}`}>
                  {l}
                </span>
              ))}
            </span>
          </span>
          <span ref={iconRef} className="sm-icon" aria-hidden="true">
            <span ref={plusHRef} className="sm-icon-line" />
            <span ref={plusVRef} className="sm-icon-line sm-icon-line-v" />
          </span>
        </button>
      </header>

      <aside
        id="staggered-menu-panel"
        ref={panelRef}
        className={`staggered-menu-panel floating-glass-panel contour-border-cool overflow-y-auto px-0 py-0 ${panelClassName}`.trim()}
        aria-hidden={!open}
      >
        <div className="sm-panel-inner">
          <ul
            className="sm-panel-list"
            role="list"
            data-numbering={displayItemNumbering || undefined}
          >
            {items.length ? (
              items.map((it, idx) => (
                <li className="sm-panel-itemWrap" key={`${it.label}-${idx}`}>
                  <PanelLink
                    it={it}
                    onNavigate={closeMenuInternal}
                    displayNumbering={displayItemNumbering}
                    index={idx}
                  />
                </li>
              ))
            ) : (
              <li className="sm-panel-itemWrap" aria-hidden="true">
                <span className="etch-float-menu-item text-white/50">No routes</span>
              </li>
            )}
          </ul>
          {displaySocials && socialItems?.length ? (
            <div className="sm-socials" aria-label="Social links">
              <h3 className="sm-socials-title">Socials</h3>
              <ul className="sm-socials-list" role="list">
                {socialItems.map((s, i) => (
                  <li key={`${s.label}-${String(i)}`} className="sm-socials-item">
                    <a
                      href={s.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sm-socials-link"
                    >
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  )
}

/** Same behavior as `<StaggeredMenu variant="dropdown" dropdownEntrance="fromTriggerBelow" />` for anchored form rows. */
export function EtchAnchoredDropdownMenu(
  props: Omit<StaggeredMenuProps, 'variant' | 'dropdownEntrance'>,
) {
  return <StaggeredMenu {...props} variant="dropdown" dropdownEntrance="fromTriggerBelow" />
}

export default StaggeredMenu
