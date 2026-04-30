import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { getToken } from '../lib/session'
import { GuestBrowseBanner } from './GuestBrowseBanner'

function guestBannerEligible(pathname: string): boolean {
  if (
    pathname === '/' ||
    pathname === '/welcome' ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/recover'
  ) {
    return false
  }
  const prefixes = ['/discover', '/nodes/', '/node/', '/spaces/', '/projects/', '/nfts/', '/provenance/']
  return prefixes.some((p) => pathname === p || pathname.startsWith(p))
}

/**
 * 150ms cross-fade between routes (soft cut, no layout slide).
 */
export function PageTransitionLayout() {
  const location = useLocation()
  const showGuestBanner = !getToken() && guestBannerEligible(location.pathname)

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname + location.search}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className={`flex min-h-0 min-w-0 flex-1 flex-col ${showGuestBanner ? 'pb-9' : ''}`}
      >
        <Outlet />
        {showGuestBanner ? <GuestBrowseBanner /> : null}
      </motion.div>
    </AnimatePresence>
  )
}
