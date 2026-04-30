export type MacroSelection =
  | { kind: 'space'; id: string }
  | { kind: 'node'; alias: string }
  | { kind: 'project'; id: string }
  | null
