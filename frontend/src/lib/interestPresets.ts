/**
 * Comprehensive interest taxonomy with categories + subcategories,
 * plus 50+ tools/mediums for filtering on discover page.
 */

export const MIN_PROFILE_INTERESTS = 3

/** Category key for typed references */
export type InterestCategory = 
  | 'research'
  | 'creation'
  | 'systems'
  | 'community'
  | 'craft'

/** Interest category groups with subcategories */
export const INTEREST_CATEGORIES: Record<InterestCategory, { label: string; subcategories: readonly string[] }> = {
  research: {
    label: 'Research & knowledge',
    subcategories: [
      'Primary research',
      'Secondary research',
      'Design research',
      'Science communication',
      'Archives & memory',
      'Research methods',
    ],
  },
  creation: {
    label: 'Creation & craft',
    subcategories: [
      'Visual art',
      'Music & sound',
      'Writing',
      'Game design',
      'Animation & motion',
      'Photography & imaging',
      '3D & modeling',
      'Fabrication & making',
      'Textiles & fiber arts',
    ],
  },
  systems: {
    label: 'Systems & infrastructure',
    subcategories: [
      'Open source',
      'Systems design',
      'UX & interface design',
      'Frontend development',
      'Backend development',
      'Database & data',
      'DevOps & infrastructure',
      'Information architecture',
    ],
  },
  community: {
    label: 'Community & culture',
    subcategories: [
      'Community building',
      'Community infrastructure',
      'Teaching & pedagogy',
      'Accessibility',
      'Governance',
      'Climate & sustainability',
      'Social justice',
      'Cultural practices',
    ],
  },
  craft: {
    label: 'Craft & technique',
    subcategories: [
      'Woodworking',
      'Metalworking',
      'Ceramics & pottery',
      'Jewelry making',
      'Printmaking',
      'Bookbinding',
      'Conservation & restoration',
      'Traditional techniques',
    ],
  },
}

/** Flat list of all interests (for backward compatibility + presets display) */
export const INTEREST_PRESETS: readonly string[] = Object.values(INTEREST_CATEGORIES)
  .flatMap((cat) => cat.subcategories)
  .sort()

/** Tool/medium list for discover page filtering (50+ items) */
export const TOOLS_AND_MEDIUMS = {
  tools: [
    'Figma',
    'Adobe XD',
    'Sketch',
    'Blender',
    'Maya',
    'Cinema 4D',
    'Unreal Engine',
    'Unity',
    'Godot',
    'Processing',
    'p5.js',
    'Three.js',
    'React',
    'Vue.js',
    'Node.js',
    'Python',
    'JavaScript',
    'TypeScript',
    'Rust',
    'Go',
    'Git',
    'Docker',
    'Kubernetes',
    'AWS',
    'Google Cloud',
    'Vercel',
    'Netlify',
    'GitHub',
    'GitLab',
    'Notion',
    'Airtable',
    'Zapier',
    'IFTTT',
    'Make',
    'n8n',
    'Retool',
    'OpenAI API',
    'Claude API',
    'GPT-4',
    'Stable Diffusion',
    'Midjourney',
    'ChatGPT',
    'Hugging Face',
  ],
  mediums: [
    'Photography',
    'Digital painting',
    'Vector art',
    'Sculpture',
    'Installation',
    'Video',
    'Animation',
    'Audio',
    'Sound design',
    'Music composition',
    'Film',
    'Drawing',
    'Painting',
    'Printmaking',
    'Woodworking',
    'Metalworking',
    'Ceramics',
    'Textiles',
    'Fiber arts',
    'Glass blowing',
    'Jewelry',
    'Leather work',
    'Paper arts',
    'Book arts',
    'Web design',
    'Graphic design',
    'Typography',
    'Illustration',
    'Concept art',
    'Character design',
    'UI/UX design',
    'Industrial design',
    'Architecture',
    'Landscape design',
    'Game design',
    'Interactive media',
    'Virtual reality',
    'Augmented reality',
    'Projection mapping',
    'Performance art',
    'Theater',
    'Dance',
    'Data visualization',
    'Information design',
    '3D printing',
    'CNC machining',
    'Laser cutting',
    'Welding',
    'Embroidery',
    'Knitting & crochet',
  ],
}

export type Tool = string
export type Medium = string
