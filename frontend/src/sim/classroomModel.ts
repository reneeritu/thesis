/** Pure classroom simulation engine — no React dependencies. */

export const NUM_STUDENTS = 6
const PROJECT_PERIOD = 4
const STUDENT_ACTIVITY_RATE = 0.7
const MENTOR_SESSION_THRESHOLD = 2
const CRAFT_SESSION_THRESHOLD = 1

function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type StudentState = {
  alias: string
  tracesLogged: number
  tracesThisPeriod: number
  projectsCompleted: number
}

export type ClassroomProject = {
  id: number
  completedAtWeek: number
  contributorAliases: string[]
  /** Credit when documentation is on — includes mentor/craftsperson if thresholds met. */
  creditWithDoc: Record<string, number>
  /** Credit when documentation is off — students only. */
  creditWithoutDoc: Record<string, number>
  mentorCredited: boolean
  craftspersonCredited: boolean
}

export type ClassroomState = {
  week: number
  semesterLength: number
  seed: number
  mentor: {
    alias: string
    guidanceSessions: number
    curriculumDecisions: number
    crisisInterventions: number
    sessionsThisPeriod: number
    /** Accumulated sessions with each student (length NUM_STUDENTS). */
    sessionsByStudent: number[]
  }
  craftsperson: {
    alias: string
    fabricationSessions: number
    materialConsultations: number
    toolsSetup: number
    sessionsThisPeriod: number
    sessionsByStudent: number[]
  }
  students: StudentState[]
  projects: ClassroomProject[]
  done: boolean
}

export type ClassroomTickMeta = {
  week: number
  activeStudentIndices: number[]
  mentorTargetIndices: number[]
  craftspersonTargetIndices: number[]
  completedProject: ClassroomProject | null
}

export type ClassroomParams = {
  semesterLength: number
  mentorAvailability: number
  craftspersonAvailability: number
}

export function initClassroomState(
  params: ClassroomParams,
  seed = 0xc1a55,
): ClassroomState {
  const students: StudentState[] = Array.from({ length: NUM_STUDENTS }, (_, i) => ({
    alias: `student_0${i + 1}`,
    tracesLogged: 0,
    tracesThisPeriod: 0,
    projectsCompleted: 0,
  }))

  return {
    week: 0,
    semesterLength: params.semesterLength,
    seed,
    mentor: {
      alias: 'prof_k',
      guidanceSessions: 0,
      curriculumDecisions: 0,
      crisisInterventions: 0,
      sessionsThisPeriod: 0,
      sessionsByStudent: new Array(NUM_STUDENTS).fill(0) as number[],
    },
    craftsperson: {
      alias: 'maker_v',
      fabricationSessions: 0,
      materialConsultations: 0,
      toolsSetup: 0,
      sessionsThisPeriod: 0,
      sessionsByStudent: new Array(NUM_STUDENTS).fill(0) as number[],
    },
    students,
    projects: [],
    done: false,
  }
}

export function classroomTick(
  state: ClassroomState,
  params: ClassroomParams,
): { state: ClassroomState; meta: ClassroomTickMeta } {
  if (state.done) {
    return {
      state,
      meta: {
        week: state.week,
        activeStudentIndices: [],
        mentorTargetIndices: [],
        craftspersonTargetIndices: [],
        completedProject: null,
      },
    }
  }

  const rng = mulberry32(state.seed + state.week * 997 + 1)
  const newWeek = state.week + 1

  const mentor = {
    ...state.mentor,
    sessionsByStudent: [...state.mentor.sessionsByStudent],
  }
  const craftsperson = {
    ...state.craftsperson,
    sessionsByStudent: [...state.craftsperson.sessionsByStudent],
  }
  const students = state.students.map((s) => ({ ...s }))

  // 1. Students become active
  const activeIndices: number[] = []
  for (let i = 0; i < NUM_STUDENTS; i++) {
    if (rng() < STUDENT_ACTIVITY_RATE) {
      activeIndices.push(i)
      const traces = 2 + Math.floor(rng() * 4)
      students[i]!.tracesLogged += traces
      students[i]!.tracesThisPeriod += traces
    }
  }

  // 2. Mentor sessions
  const mentorTargets: number[] = []
  if (activeIndices.length > 0 && rng() < params.mentorAvailability) {
    const count = rng() < 0.55 ? 1 : 2
    const pool = [...activeIndices]
    for (let i = 0; i < count && pool.length > 0; i++) {
      const idx = Math.floor(rng() * pool.length)
      const target = pool.splice(idx, 1)[0]!
      mentorTargets.push(target)
      mentor.sessionsByStudent[target] = (mentor.sessionsByStudent[target] ?? 0) + 1
      mentor.sessionsThisPeriod++
      mentor.guidanceSessions++
    }
    if (rng() < 0.3) mentor.curriculumDecisions++
    if (rng() < 0.12) mentor.crisisInterventions++
  }

  // 3. Craftsperson sessions
  const craftTargets: number[] = []
  if (activeIndices.length > 0 && rng() < params.craftspersonAvailability) {
    const count = rng() < 0.7 ? 1 : 2
    const pool = [...activeIndices]
    for (let i = 0; i < count && pool.length > 0; i++) {
      const idx = Math.floor(rng() * pool.length)
      const target = pool.splice(idx, 1)[0]!
      craftTargets.push(target)
      craftsperson.sessionsByStudent[target] = (craftsperson.sessionsByStudent[target] ?? 0) + 1
      craftsperson.sessionsThisPeriod++
      if (rng() < 0.55) {
        craftsperson.fabricationSessions++
      } else {
        craftsperson.materialConsultations++
      }
      if (rng() < 0.2) craftsperson.toolsSetup++
    }
  }

  // 4. Project completion every PROJECT_PERIOD weeks
  let completedProject: ClassroomProject | null = null
  if (newWeek % PROJECT_PERIOD === 0 && newWeek <= params.semesterLength) {
    const projectId = state.projects.length

    const contributors = students.filter((s) => s.tracesThisPeriod > 0)
    const contributorAliases = contributors.map((s) => s.alias)
    const totalTraces = contributors.reduce((sum, c) => sum + c.tracesThisPeriod, 0) || 1

    // --- WITHOUT doc: students only, proportional to traces ---
    const creditWithoutDoc: Record<string, number> = {}
    for (const c of contributors) {
      creditWithoutDoc[c.alias] = Math.round((c.tracesThisPeriod / totalTraces) * 100)
    }

    // --- WITH doc: students + mentor + craftsperson if thresholds met ---
    const mentorCredited = mentor.sessionsThisPeriod >= MENTOR_SESSION_THRESHOLD
    const craftCredited = craftsperson.sessionsThisPeriod >= CRAFT_SESSION_THRESHOLD

    const MENTOR_SHARE = 15
    const CRAFT_SHARE = 10
    const studentPool = 100 - (mentorCredited ? MENTOR_SHARE : 0) - (craftCredited ? CRAFT_SHARE : 0)

    const creditWithDoc: Record<string, number> = {}
    for (const c of contributors) {
      creditWithDoc[c.alias] = Math.round((c.tracesThisPeriod / totalTraces) * studentPool)
    }
    if (mentorCredited) creditWithDoc[mentor.alias] = MENTOR_SHARE
    if (craftCredited) creditWithDoc[craftsperson.alias] = CRAFT_SHARE

    completedProject = {
      id: projectId,
      completedAtWeek: newWeek,
      contributorAliases,
      creditWithDoc,
      creditWithoutDoc,
      mentorCredited,
      craftspersonCredited: craftCredited,
    }

    for (const s of students) {
      if (s.tracesThisPeriod > 0) s.projectsCompleted++
      s.tracesThisPeriod = 0
    }

    mentor.sessionsThisPeriod = 0
    craftsperson.sessionsThisPeriod = 0
  }

  const done = newWeek >= params.semesterLength

  return {
    state: {
      ...state,
      week: newWeek,
      mentor,
      craftsperson,
      students,
      projects: completedProject
        ? [...state.projects, completedProject]
        : state.projects,
      done,
    },
    meta: {
      week: newWeek,
      activeStudentIndices: activeIndices,
      mentorTargetIndices: mentorTargets,
      craftspersonTargetIndices: craftTargets,
      completedProject,
    },
  }
}
