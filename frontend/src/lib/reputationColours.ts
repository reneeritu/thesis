/**
 * Shared palette + mapping for reputation categories.
 *
 * Keep CATEGORY_COLOURS in sync with ARM_COLOURS in CrystalRadar3D so users
 * see the same colour language on the radar and everywhere it gets tinted
 * (trace form, trace timeline cards, future dashboards, etc.).
 *
 * Keep ACTIVITY_TO_CATEGORY in sync with:
 *   - src/routes/nodes.ts ACTIVITY_TO_CATEGORY
 *   - src/services/reputationEngine.ts ACTIVITY_CATEGORY_MAP
 */

export type ReputationCategory =
  | 'craft'
  | 'research'
  | 'collaboration'
  | 'pedagogy'
  | 'consistency'
  | 'community'

/** Primary colour per category — jewel-tone palette, one per arm on the 3D radar. */
export const CATEGORY_COLOURS: Record<ReputationCategory, string> = {
  craft:         '#e879f9', // neon lavender — aligns with shell accents / radar craft arm (dark)
  research:      '#4f8ef7', // sapphire blue (hexagonal / quartz)
  collaboration: '#ff4757', // ruby red (tetragonal)
  pedagogy:      '#2ecc71', // emerald green (triclinic)
  consistency:   '#be5bea', // amethyst violet (orthorhombic)
  community:     '#00d2ff', // aquamarine cyan (rhombohedral)
}

/** Short label per category. */
export const CATEGORY_LABELS: Record<ReputationCategory, string> = {
  craft: 'Craft',
  research: 'Research',
  collaboration: 'Collab',
  pedagogy: 'Pedagogy',
  consistency: 'Consist',
  community: 'Community',
}

/**
 * Activity type (as used in the TraceForm + on the Trace model) → the reputation
 * category that trace contributes to. Activities not listed here don't move any
 * specific category — only the generic reputationScore and `consistency` proxy.
 */
export const ACTIVITY_TO_CATEGORY: Record<string, ReputationCategory> = {
  skillwork: 'craft',
  fabrication: 'craft',
  primary_research: 'research',
  secondary_research: 'research',
  brainstorm: 'research',
  iterate: 'research',
  ai_tool: 'research',
  pedagogy: 'pedagogy',
  admin: 'consistency',
  review: 'consistency',
  other: 'consistency',
}

/** "Grows when…" hint per category — mirrors ARM_HINT in CrystalRadar3D. */
export const CATEGORY_GROW_HINTS: Record<ReputationCategory, string> = {
  craft:         'Grows when you log execution traces — making the thing.',
  research:      'Grows when you log reference / study traces — investigating.',
  collaboration: 'Grows when you log group work and co-authored traces.',
  pedagogy:      'Grows when you mentor, teach, or review others.',
  consistency:   'Grows from steady cadence — showing up across time.',
  community:     'Grows from cross-space work and public-facing projects.',
}

/** Looks up the category (or null for unmapped / unknown types). */
export function categoryForActivity(
  activityType: string | null | undefined,
): ReputationCategory | null {
  if (!activityType) return null
  return ACTIVITY_TO_CATEGORY[activityType] ?? null
}

/** Looks up the hex colour for an activity type, or a neutral default if unmapped. */
export function colourForActivity(
  activityType: string | null | undefined,
  fallback = '#737373',
): string {
  const cat = categoryForActivity(activityType)
  return cat ? CATEGORY_COLOURS[cat] : fallback
}
