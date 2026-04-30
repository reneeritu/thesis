import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'

/**
 * 150ms cross-fade between routes (soft cut, no layout slide).
 */
export function PageTransitionLayout() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname + location.search}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  )
}
