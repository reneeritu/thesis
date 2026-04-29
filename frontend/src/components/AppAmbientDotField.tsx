import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'

import DotField, { dotFieldPalette } from './dotfield/DotField'
import { useDotFieldBurstContext } from '../context/DotFieldBurstContext'
import { useTheme } from '../context/ThemeContext'

/**
 * Full-viewport dotted field — pointer-events-none, painted under main chrome (same z as content,
 * ordered before the flex column so links/buttons receive events). Mouse coords use viewport rect.
 */
export function AppAmbientDotField() {
  const burst = useDotFieldBurstContext()
  const { pathname } = useLocation()
  const { theme } = useTheme()
  const colours = useMemo(() => dotFieldPalette(theme === 'light' ? 'light' : 'dark'), [theme])

  const burstSignal = burst?.burstSignal ?? 0

  return (
    <div className="pointer-events-none fixed inset-0 z-[1] opacity-[0.76] mix-blend-multiply contrast-[1.02] dark:opacity-[0.88]">
      <DotField
        dotRadius={1.5}
        dotSpacing={12}
        bulgeStrength={91}
        glowRadius={100}
        sparkle={false}
        waveAmplitude={2}
        cursorForce={0.03}
        {...colours}
        burstSignal={burstSignal}
        maskMode={pathname === '/dashboard' ? 'fadeCenter' : 'none'}
      />
    </div>
  )
}
