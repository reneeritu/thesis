/**
 * Space settings.privacyDefault — which modes allow anonymous full browse
 * (members list, projects, activity feed) vs summary-only public cards.
 */
export function spacePrivacyAllowsPublicFullBrowse(privacy?: string | null): boolean {
  return privacy === 'public' || privacy === 'process_visible';
}
