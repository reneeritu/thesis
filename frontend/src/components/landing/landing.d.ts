declare module '*/DecryptedText' {
  import { CSSProperties } from 'react'
  interface DecryptedTextProps {
    text?: string
    speed?: number
    maxIterations?: number | null
    characters?: string
    sequential?: boolean
    revealDirection?: 'start' | 'end' | 'center' | 'random'
    animateOn?: 'view' | 'load'
    className?: string
    encryptedClassName?: string
    style?: CSSProperties
    onAnimationComplete?: () => void
  }
  export default function DecryptedText(props: DecryptedTextProps): JSX.Element
}

declare module '*/FaultyTerminal' {
  import { CSSProperties } from 'react'
  interface FaultyTerminalProps {
    scale?: number
    gridMul?: [number, number]
    digitSize?: number
    timeScale?: number
    pause?: boolean
    scanlineIntensity?: number
    glitchAmount?: number
    flickerAmount?: number
    noiseAmp?: number
    chromaticAberration?: number
    dither?: number | boolean
    curvature?: number
    tint?: string
    mouseReact?: boolean
    mouseStrength?: number
    dpr?: number
    brightness?: number
    pageLoadAnimation?: boolean
    className?: string
    style?: CSSProperties
  }
  export default function FaultyTerminal(props: FaultyTerminalProps): JSX.Element
}

declare module '*/ASCIIText' {
  interface ASCIITextProps {
    text?: string
    enableWaves?: boolean
    asciiFontSize?: number
    textFontSize?: number
    textColor?: string
    planeBaseHeight?: number
  }
  export default function ASCIIText(props: ASCIITextProps): JSX.Element
}

declare module '*/PixelBlast' {
  interface PixelBlastProps {
    variant?: string
    pixelSize?: number
    color?: string
    patternScale?: number
    patternDensity?: number
    enableRipples?: boolean
    rippleSpeed?: number
    rippleThickness?: number
    liquid?: boolean
    speed?: number
    edgeFade?: number
    transparent?: boolean
  }
  export default function PixelBlast(props: PixelBlastProps): JSX.Element
}
