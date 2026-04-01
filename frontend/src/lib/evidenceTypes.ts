/** Mirrors `EVIDENCE_TYPES` in server `models/Archive.ts` */
export const EVIDENCE_TYPES = [
  'photos_of_work',
  'process_photos',
  'sketches',
  'dated_files',
  'social_post',
  'videos',
  'voice_recordings',
  'audio',
  'exhibit_record',
  'institution_record',
  'url',
  'portfolio_link',
  'other',
] as const

export type EvidenceType = (typeof EVIDENCE_TYPES)[number]
