export type ProjectItem = {
  id: string
  title: string
  description: string
  /** Public URL (under `public/`) or absolute URL */
  image: string
}

function publicAsset(path: string): string {
  const base = import.meta.env.BASE_URL
  const root = base.endsWith('/') ? base : `${base}/`
  return `${root}${path.replace(/^\//, '')}`
}

/**
 * Data layer for hero work cards — drives hidden SEO DOM + WebGL planes.
 */
export const PROJECTS_DATA: ProjectItem[] = [
  {
    id: 'chain-ledger',
    title: 'Chain ledger',
    description:
      'Document what making actually looks like — a tactile pause between studio depth and page clarity.',
    image: publicAsset('works/p1.svg'),
  },
  {
    id: 'radial-index',
    title: 'Radial index',
    description:
      'Spatial navigation for long-form craft records, indexed by time and material lineage.',
    image: publicAsset('works/p2.svg'),
  },
  {
    id: 'studio-atlas',
    title: 'Studio atlas',
    description:
      'A living map of tools, benches, and unfinished objects — entropy made legible.',
    image: publicAsset('works/p3.svg'),
  },
  {
    id: 'return-vector',
    title: 'Return vector',
    description:
      'Closing the loop from artifact back to intent: exports, editions, and the next handoff.',
    image: publicAsset('works/p4.svg'),
  },
  {
    id: 'fifth-orbit',
    title: 'Fifth orbit',
    description:
      'Reserve slot for the next project — same ring, same hand-drawn cadence, new artifact.',
    image: publicAsset('works/p5.svg'),
  },
]

export const PROJECT_COUNT = PROJECTS_DATA.length
