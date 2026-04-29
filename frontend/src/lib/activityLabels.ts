/** Human-readable labels for trace activity types */
export const ACTIVITY_LABEL: Record<string, string> = {
  brainstorm: 'Brainstorm',
  primary_research: 'Primary research',
  secondary_research: 'Secondary research',
  iterate: 'Iterate',
  skillwork: 'Skill work',
  fabrication: 'Fabrication',
  pedagogy: 'Pedagogy',
  admin: 'Admin',
  review: 'Review',
  ai_tool: 'AI tool',
  other: 'Other',
}

export function activityLabel(type: string): string {
  return ACTIVITY_LABEL[type] ?? type.replace(/_/g, ' ')
}
