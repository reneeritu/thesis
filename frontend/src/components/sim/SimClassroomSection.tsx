import { useCallback, useEffect, useRef, useState } from 'react'
import {
  classroomTick,
  initClassroomState,
  NUM_STUDENTS,
  type ClassroomParams,
  type ClassroomState,
  type ClassroomTickMeta,
} from '../../sim/classroomModel'

// ─── Layout constants ─────────────────────────────────────────────────────────

const SVG_W = 400
const SVG_H = 380
const MENTOR_POS = { x: 200, y: 170 }
const CRAFT_POS = { x: 290, y: 252 }

const STUDENT_POSITIONS = Array.from({ length: NUM_STUDENTS }, (_, i) => {
  const angle = -Math.PI / 2 + (i / NUM_STUDENTS) * 2 * Math.PI
  return {
    x: Math.round(200 + 148 * Math.cos(angle)),
    y: Math.round(170 + 148 * Math.sin(angle)),
  }
})

const DEFAULT_PARAMS: ClassroomParams = {
  semesterLength: 16,
  mentorAvailability: 0.8,
  craftspersonAvailability: 0.6,
}

// ─── Toggle switch ─────────────────────────────────────────────────────────────

function ToggleSwitch({
  on,
  onChange,
}: {
  on: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <button
        type="button"
        onClick={() => onChange(!on)}
        className="flex items-center gap-5"
        aria-pressed={on}
      >
        <span
          className="font-mono text-[length:var(--text-xs)] uppercase tracking-[0.22em]"
          style={{ color: on ? 'var(--text-ghost)' : '#ef4444', minWidth: '3rem', textAlign: 'right' }}
        >
          OFF
        </span>

        <div
          className="relative h-8 w-[4.5rem] rounded-full transition-colors duration-500"
          style={{
            backgroundColor: on ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${on ? '#4ade80' : '#2a2a4a'}`,
            boxShadow: on ? '0 0 12px rgba(74,222,128,0.2)' : 'none',
          }}
        >
          <div
            className="absolute top-[5px] h-[22px] w-[22px] rounded-full transition-transform duration-300"
            style={{
              left: '5px',
              transform: on ? 'translateX(38px)' : 'translateX(0)',
              backgroundColor: on ? '#4ade80' : '#3a3a5a',
              boxShadow: on ? '0 0 8px rgba(74,222,128,0.5)' : 'none',
            }}
          />
        </div>

        <span
          className="font-mono text-[length:var(--text-xs)] uppercase tracking-[0.22em]"
          style={{ color: on ? '#4ade80' : 'var(--text-ghost)', minWidth: '3rem' }}
        >
          ON
        </span>
      </button>

      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--text-ghost)]">
        DOCUMENTATION — flip this to see what etch changes
      </p>
    </div>
  )
}

// ─── SVG Diagram ─────────────────────────────────────────────────────────────

function ClassroomDiagram({
  state,
  meta,
  documentationOn,
  flashStudents,
}: {
  state: ClassroomState
  meta: ClassroomTickMeta | null
  documentationOn: boolean
  flashStudents: number[]
}) {
  const mentorSessions = state.mentor.sessionsByStudent
  const craftSessions = state.craftsperson.sessionsByStudent
  const maxMentor = Math.max(1, ...mentorSessions)
  const maxCraft = Math.max(1, ...craftSessions)

  const projectFlash = meta?.completedProject !== null && !!meta?.completedProject

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      width={SVG_W}
      height={SVG_H}
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* Subtle outer glow background for active nodes area */}
      {documentationOn && (
        <circle
          cx={MENTOR_POS.x}
          cy={MENTOR_POS.y}
          r={170}
          fill="none"
          stroke="rgba(74,222,128,0.04)"
          strokeWidth={80}
        />
      )}

      {/* ── Accumulated mentor connections (doc on only) ── */}
      {STUDENT_POSITIONS.map((pos, i) => {
        const count = mentorSessions[i] ?? 0
        if (!documentationOn || count === 0) return null
        const opacity = Math.min(0.7, 0.12 + (count / maxMentor) * 0.58)
        return (
          <line
            key={`m-acc-${i}`}
            x1={MENTOR_POS.x}
            y1={MENTOR_POS.y}
            x2={pos.x}
            y2={pos.y}
            stroke="#4ade80"
            strokeOpacity={opacity}
            strokeWidth={1.5}
          />
        )
      })}

      {/* ── Accumulated craftsperson connections (doc on only) ── */}
      {STUDENT_POSITIONS.map((pos, i) => {
        const count = craftSessions[i] ?? 0
        if (!documentationOn || count === 0) return null
        const opacity = Math.min(0.65, 0.12 + (count / maxCraft) * 0.53)
        return (
          <line
            key={`c-acc-${i}`}
            x1={CRAFT_POS.x}
            y1={CRAFT_POS.y}
            x2={pos.x}
            y2={pos.y}
            stroke="#fb923c"
            strokeOpacity={opacity}
            strokeWidth={1.5}
          />
        )
      })}

      {/* ── Current-tick mentor connections ── */}
      {(meta?.mentorTargetIndices ?? []).map((i) => {
        const pos = STUDENT_POSITIONS[i]!
        return (
          <line
            key={`m-tick-${i}`}
            x1={MENTOR_POS.x}
            y1={MENTOR_POS.y}
            x2={pos.x}
            y2={pos.y}
            stroke={documentationOn ? '#4ade80' : '#2a2a3a'}
            strokeOpacity={documentationOn ? 0.9 : 0.3}
            strokeWidth={documentationOn ? 2.5 : 1}
            strokeDasharray={documentationOn ? undefined : '5 4'}
          />
        )
      })}

      {/* ── Current-tick craftsperson connections ── */}
      {(meta?.craftspersonTargetIndices ?? []).map((i) => {
        const pos = STUDENT_POSITIONS[i]!
        return (
          <line
            key={`c-tick-${i}`}
            x1={CRAFT_POS.x}
            y1={CRAFT_POS.y}
            x2={pos.x}
            y2={pos.y}
            stroke={documentationOn ? '#fb923c' : '#2a2a3a'}
            strokeOpacity={documentationOn ? 0.9 : 0.3}
            strokeWidth={documentationOn ? 2.5 : 1}
            strokeDasharray={documentationOn ? undefined : '5 4'}
          />
        )
      })}

      {/* ── Project completion arcs ── */}
      {projectFlash &&
        (meta!.completedProject!.contributorAliases ?? []).map((alias) => {
          const idx = state.students.findIndex((s) => s.alias === alias)
          const pos = idx >= 0 ? STUDENT_POSITIONS[idx] : null
          if (!pos) return null
          return (
            <line
              key={`proj-${alias}`}
              x1={pos.x}
              y1={pos.y}
              x2={MENTOR_POS.x}
              y2={MENTOR_POS.y}
              stroke={documentationOn ? '#a78bfa' : '#3a3a3a'}
              strokeOpacity={0.5}
              strokeWidth={1}
              strokeDasharray={documentationOn ? '2 3' : '3 5'}
            />
          )
        })}

      {/* ── Student nodes ── */}
      {STUDENT_POSITIONS.map((pos, i) => {
        const student = state.students[i]!
        const isActive = meta?.activeStudentIndices.includes(i) ?? false
        const isFlashing = flashStudents.includes(i)
        const r = isFlashing ? 17 : isActive ? 15 : 13
        return (
          <g key={`s-${i}`} style={{ transition: 'all 300ms' }}>
            {isFlashing && (
              <circle
                cx={pos.x}
                cy={pos.y}
                r={22}
                fill="none"
                stroke="#a78bfa"
                strokeOpacity={0.4}
                strokeWidth={2}
              />
            )}
            <circle
              cx={pos.x}
              cy={pos.y}
              r={r}
              fill={isActive || isFlashing ? '#6d4fc2' : '#2a1f4a'}
              stroke={isFlashing ? '#a78bfa' : isActive ? '#7c5ad4' : '#3a2a5a'}
              strokeWidth={1.5}
            />
            <text
              x={pos.x}
              y={pos.y + r + 11}
              textAnchor="middle"
              fontSize={7.5}
              fill="#888"
              fontFamily="monospace"
              letterSpacing="0.5"
            >
              {student.alias.toUpperCase()}
            </text>
          </g>
        )
      })}

      {/* ── Craftsperson node ── */}
      {(() => {
        const isActive = (meta?.craftspersonTargetIndices.length ?? 0) > 0
        return (
          <g>
            {isActive && documentationOn && (
              <circle
                cx={CRAFT_POS.x}
                cy={CRAFT_POS.y}
                r={30}
                fill="none"
                stroke="#fb923c"
                strokeOpacity={0.2}
                strokeWidth={8}
              />
            )}
            <circle
              cx={CRAFT_POS.x}
              cy={CRAFT_POS.y}
              r={20}
              fill={isActive ? '#7a3a0a' : '#2a1a08'}
              stroke={isActive && documentationOn ? '#fb923c' : '#4a2a10'}
              strokeWidth={1.5}
            />
            <text
              x={CRAFT_POS.x}
              y={CRAFT_POS.y - 2}
              textAnchor="middle"
              fontSize={7}
              fill={documentationOn ? '#fb923c' : '#555'}
              fontFamily="monospace"
              fontWeight="bold"
              letterSpacing="0.5"
            >
              MAKER_V
            </text>
            <text
              x={CRAFT_POS.x}
              y={CRAFT_POS.y + 9}
              textAnchor="middle"
              fontSize={6}
              fill="#666"
              fontFamily="monospace"
              letterSpacing="0.3"
            >
              CRAFTSPERSON
            </text>
          </g>
        )
      })()}

      {/* ── Mentor node (center, largest) ── */}
      {(() => {
        const isActive = (meta?.mentorTargetIndices.length ?? 0) > 0
        return (
          <g>
            {documentationOn && (
              <circle
                cx={MENTOR_POS.x}
                cy={MENTOR_POS.y}
                r={42}
                fill="none"
                stroke="#4ade80"
                strokeOpacity={isActive ? 0.25 : 0.1}
                strokeWidth={10}
              />
            )}
            <circle
              cx={MENTOR_POS.x}
              cy={MENTOR_POS.y}
              r={28}
              fill={isActive ? '#0e3320' : '#091a12'}
              stroke={isActive && documentationOn ? '#4ade80' : '#1a3a22'}
              strokeWidth={2}
            />
            <text
              x={MENTOR_POS.x}
              y={MENTOR_POS.y - 3}
              textAnchor="middle"
              fontSize={8}
              fill={documentationOn ? '#4ade80' : '#5a5a5a'}
              fontFamily="monospace"
              fontWeight="bold"
              letterSpacing="0.8"
            >
              PROF_K
            </text>
            <text
              x={MENTOR_POS.x}
              y={MENTOR_POS.y + 9}
              textAnchor="middle"
              fontSize={6.5}
              fill="#666"
              fontFamily="monospace"
              letterSpacing="0.3"
            >
              MENTOR
            </text>
          </g>
        )
      })()}

      {/* Week label */}
      <text
        x={SVG_W - 8}
        y={SVG_H - 8}
        textAnchor="end"
        fontSize={8}
        fill="#444"
        fontFamily="monospace"
        letterSpacing="1"
      >
        WEEK {state.week} / {state.semesterLength}
      </text>
    </svg>
  )
}

// ─── Ledger ───────────────────────────────────────────────────────────────────

function Ledger({
  state,
  documentationOn,
}: {
  state: ClassroomState
  documentationOn: boolean
}) {
  const totalProjects = state.projects.length
  const mentorCreditedCount = state.projects.filter((p) => p.mentorCredited).length
  const craftCreditedCount = state.projects.filter((p) => p.craftspersonCredited).length

  const showMentor = documentationOn ? mentorCreditedCount : 0
  const showCraft = documentationOn ? craftCreditedCount : 0

  return (
    <div className="flex flex-1 flex-col gap-1 pl-6">
      <p className="mb-3 font-mono text-[length:var(--text-xs)] uppercase tracking-[0.18em] text-[var(--text-ghost)]">
        LEDGER
      </p>

      {/* Header */}
      <div
        className="grid gap-2 border-b border-[#1a1a2e] pb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-ghost)]"
        style={{ gridTemplateColumns: '1fr 80px 100px' }}
      >
        <span>CONTRIBUTOR</span>
        <span className="text-right">SESSIONS</span>
        <span className="text-right">CREDITED IN</span>
      </div>

      {/* Mentor row */}
      <div
        className="grid gap-2 border-b border-[#1a1a2e] py-2.5"
        style={{ gridTemplateColumns: '1fr 80px 100px' }}
      >
        <div>
          <p className="font-mono text-[length:var(--text-xs)] text-[var(--text-primary)]">
            prof_k
          </p>
          <p className="font-mono text-[10px] text-[var(--text-ghost)]">mentor</p>
        </div>
        <p className="self-center text-right font-mono text-[length:var(--text-xs)] text-[var(--text-secondary)]">
          {state.mentor.guidanceSessions}
        </p>
        <div className="self-center text-right">
          {documentationOn ? (
            <span className="font-mono text-[length:var(--text-xs)] text-[#4ade80]">
              ✓ {showMentor} / {totalProjects}
            </span>
          ) : (
            <span className="font-mono text-[length:var(--text-xs)] text-[#ef4444]">
              ✗ 0 / {totalProjects}
            </span>
          )}
        </div>
      </div>

      {/* Craftsperson row */}
      <div
        className="grid gap-2 border-b border-[#1a1a2e] py-2.5"
        style={{ gridTemplateColumns: '1fr 80px 100px' }}
      >
        <div>
          <p className="font-mono text-[length:var(--text-xs)] text-[var(--text-primary)]">
            maker_v
          </p>
          <p className="font-mono text-[10px] text-[var(--text-ghost)]">craftsperson</p>
        </div>
        <p className="self-center text-right font-mono text-[length:var(--text-xs)] text-[var(--text-secondary)]">
          {state.craftsperson.fabricationSessions + state.craftsperson.materialConsultations}
        </p>
        <div className="self-center text-right">
          {documentationOn ? (
            <span className="font-mono text-[length:var(--text-xs)] text-[#4ade80]">
              ✓ {showCraft} / {totalProjects}
            </span>
          ) : (
            <span className="font-mono text-[length:var(--text-xs)] text-[#ef4444]">
              ✗ 0 / {totalProjects}
            </span>
          )}
        </div>
      </div>

      {/* Students (collapsed) */}
      <details className="mt-1">
        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-ghost)] hover:text-[var(--text-primary)]">
          + {NUM_STUDENTS} students
        </summary>
        <div className="mt-2 flex flex-col gap-1">
          {state.students.map((s) => (
            <div
              key={s.alias}
              className="grid gap-2 py-1"
              style={{ gridTemplateColumns: '1fr 80px 100px' }}
            >
              <span className="font-mono text-[10px] text-[var(--text-secondary)]">{s.alias}</span>
              <span className="text-right font-mono text-[10px] text-[var(--text-ghost)]">
                {s.tracesLogged} tr
              </span>
              <span className="text-right font-mono text-[10px] text-[#67e8f9]">
                ✓ {s.projectsCompleted} / {totalProjects}
              </span>
            </div>
          ))}
        </div>
      </details>

      {/* Ledger note */}
      <p
        className="mt-4 font-mono text-[10px] italic leading-relaxed"
        style={{ color: documentationOn ? '#4ade80' : '#ef4444' }}
      >
        {documentationOn
          ? 'every session that crossed a threshold was cited'
          : 'their sessions are not on the record'}
      </p>
    </div>
  )
}

// ─── Counters ─────────────────────────────────────────────────────────────────

function CounterRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-3">
      <span
        className="inline-block min-w-[3rem] rounded border border-[#1a1a2e] px-2 py-0.5 text-center font-mono text-[length:var(--text-sm)] tabular-nums text-[var(--text-primary)]"
      >
        {value}
      </span>
      <span className="font-mono text-[length:var(--text-xs)] text-[var(--text-ghost)]">
        {label}
      </span>
    </div>
  )
}

function ContributorCounters({
  state,
  documentationOn,
}: {
  state: ClassroomState
  documentationOn: boolean
}) {
  const totalProjects = state.projects.length
  const mentorCredited = state.projects.filter((p) => p.mentorCredited).length
  const craftCredited = state.projects.filter((p) => p.craftspersonCredited).length

  return (
    <div className="mt-6 flex flex-wrap gap-10">
      {/* Mentor */}
      <div className="flex flex-col gap-3">
        <p className="font-mono text-[length:var(--text-xs)] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          PROF_K HAS CONTRIBUTED:
        </p>
        <CounterRow label="guidance sessions" value={state.mentor.guidanceSessions} />
        <CounterRow label="curriculum decisions" value={state.mentor.curriculumDecisions} />
        <CounterRow label="crisis interventions" value={state.mentor.crisisInterventions} />
        <div className="mt-1 flex flex-col gap-1">
          <p className="font-mono text-[10px] text-[#ef4444]">
            CREDITED FOR: {0} of {totalProjects} ← documentation off
          </p>
          <p className="font-mono text-[10px] text-[#4ade80]">
            CREDITED FOR: {documentationOn ? mentorCredited : mentorCredited} of {totalProjects} ← documentation on
          </p>
        </div>
      </div>

      {/* Craftsperson */}
      <div className="flex flex-col gap-3">
        <p className="font-mono text-[length:var(--text-xs)] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          MAKER_V HAS CONTRIBUTED:
        </p>
        <CounterRow label="fabrication sessions" value={state.craftsperson.fabricationSessions} />
        <CounterRow label="material consultations" value={state.craftsperson.materialConsultations} />
        <CounterRow label="tools configured" value={state.craftsperson.toolsSetup} />
        <div className="mt-1 flex flex-col gap-1">
          <p className="font-mono text-[10px] text-[#ef4444]">
            CREDITED FOR: {0} of {totalProjects} ← documentation off
          </p>
          <p className="font-mono text-[10px] text-[#4ade80]">
            CREDITED FOR: {documentationOn ? craftCredited : craftCredited} of {totalProjects} ← documentation on
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Semester end statement ───────────────────────────────────────────────────

function SemesterEnd({
  state,
  documentationOn,
}: {
  state: ClassroomState
  documentationOn: boolean
}) {
  if (!state.done) return null

  const n = state.projects.length
  const mentorCredited = state.projects.filter((p) => p.mentorCredited).length
  const craftCredited = state.projects.filter((p) => p.craftspersonCredited).length

  return (
    <div
      className="mt-8 border border-[#1a1a2e] p-8 transition-all duration-500"
      style={{
        backgroundColor: documentationOn
          ? 'rgba(74, 222, 128, 0.04)'
          : 'rgba(239, 68, 68, 0.04)',
      }}
    >
      <p
        className="font-mono text-[length:var(--text-base)] uppercase leading-[2] tracking-[0.2em]"
        style={{ color: documentationOn ? '#4ade80' : '#ef4444' }}
      >
        THE SEMESTER IS OVER.
        <br />
        {n} PROJECTS COMPLETED.
        <br />
        <br />
        PROF_K APPEARS IN:{' '}
        {documentationOn ? (
          <span className="text-[#4ade80]">
            {mentorCredited} OF {n} FINAL RECORDS.
          </span>
        ) : (
          <span className="text-[#ef4444]">0 OF {n} FINAL RECORDS.</span>
        )}
        <br />
        MAKER_V APPEARS IN:{' '}
        {documentationOn ? (
          <span className="text-[#4ade80]">
            {craftCredited} OF {n} FINAL RECORDS.
          </span>
        ) : (
          <span className="text-[#ef4444]">0 OF {n} FINAL RECORDS.</span>
        )}
        <br />
        <br />
        THEIR WORK SHAPED EVERYTHING HERE.
        <br />
        {documentationOn ? 'THE RECORD AGREES.' : 'THE RECORD SHOWS STRANGERS.'}
      </p>
    </div>
  )
}

// ─── Controls ─────────────────────────────────────────────────────────────────

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  display?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[length:var(--text-xs)] uppercase tracking-[0.14em] text-[var(--text-ghost)]">
          {label}
        </span>
        <span className="font-mono text-[length:var(--text-xs)] text-[var(--text-muted)]">
          {display ?? value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#4ade80]"
      />
    </div>
  )
}

function ClassroomControls({
  params,
  setParams,
  running,
  setRunning,
  fast,
  setFast,
  onReset,
}: {
  params: ClassroomParams
  setParams: (p: ClassroomParams) => void
  running: boolean
  setRunning: (v: boolean) => void
  fast: boolean
  setFast: (v: boolean) => void
  onReset: () => void
}) {
  return (
    <div className="mx-auto mt-6 flex w-full max-w-[1600px] flex-col gap-5 border border-[#1a1a2e] bg-black/20 px-4 py-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <SliderControl
          label="SEMESTER LENGTH"
          value={params.semesterLength}
          min={8}
          max={24}
          step={4}
          onChange={(v) => setParams({ ...params, semesterLength: v })}
          display={`${params.semesterLength} weeks`}
        />
        <SliderControl
          label="MENTOR AVAILABILITY"
          value={params.mentorAvailability}
          min={0.4}
          max={1.0}
          step={0.1}
          onChange={(v) => setParams({ ...params, mentorAvailability: v })}
        />
        <SliderControl
          label="HOW OFTEN CRAFTSPERSON IS CONSULTED"
          value={params.craftspersonAvailability}
          min={0.3}
          max={0.9}
          step={0.1}
          onChange={(v) => setParams({ ...params, craftspersonAvailability: v })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={onReset}
          className="cursor-target rounded border border-white/25 bg-transparent px-5 py-2 font-mono text-[length:var(--text-xs)] uppercase tracking-[0.2em] text-[var(--text-primary)] hover:bg-white/5"
        >
          RESTART
        </button>
        <button
          type="button"
          onClick={() => setRunning(!running)}
          className="cursor-target rounded border border-white/25 bg-transparent px-5 py-2 font-mono text-[length:var(--text-xs)] uppercase tracking-[0.2em] text-[var(--text-primary)] hover:bg-white/5"
        >
          {running ? 'PAUSE' : 'RESUME'}
        </button>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[length:var(--text-xs)] uppercase tracking-[0.14em] text-[var(--text-ghost)]">
            SPEED
          </span>
          <button
            type="button"
            onClick={() => setFast(false)}
            className={`font-mono text-[length:var(--text-xs)] uppercase tracking-[0.14em] ${!fast ? 'text-[var(--text-primary)]' : 'text-[var(--text-ghost)]'}`}
          >
            SLOW
          </button>
          <span className="text-[var(--text-ghost)]">/</span>
          <button
            type="button"
            onClick={() => setFast(true)}
            className={`font-mono text-[length:var(--text-xs)] uppercase tracking-[0.14em] ${fast ? 'text-[#4ade80]' : 'text-[var(--text-ghost)]'}`}
          >
            FAST
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main section ─────────────────────────────────────────────────────────────

export function SimClassroomSection() {
  const [params, setParams] = useState<ClassroomParams>(DEFAULT_PARAMS)
  const [state, setState] = useState<ClassroomState>(() =>
    initClassroomState(DEFAULT_PARAMS),
  )
  const [lastMeta, setLastMeta] = useState<ClassroomTickMeta | null>(null)
  const [documentationOn, setDocumentationOn] = useState(false)
  const [running, setRunning] = useState(true)
  const [fast, setFast] = useState(false)
  const [flashStudents, setFlashStudents] = useState<number[]>([])

  const stateRef = useRef(state)
  stateRef.current = state

  const paramsRef = useRef(params)
  paramsRef.current = params

  const handleReset = useCallback(() => {
    setState(initClassroomState(paramsRef.current))
    setLastMeta(null)
    setFlashStudents([])
    setRunning(true)
  }, [])

  useEffect(() => {
    if (!running || state.done) return

    const interval = fast ? 420 : 1300
    const id = window.setInterval(() => {
      const { state: next, meta } = classroomTick(stateRef.current, paramsRef.current)
      setState(next)
      setLastMeta(meta)

      if (meta.completedProject) {
        const contributing = meta.completedProject.contributorAliases
        const indices = next.students
          .map((s, i) => (contributing.includes(s.alias) ? i : -1))
          .filter((i) => i >= 0)
        setFlashStudents(indices)
        window.setTimeout(() => setFlashStudents([]), 800)
      }
    }, interval)

    return () => window.clearInterval(id)
  }, [running, state.done, fast])

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 pb-8 pt-6">
      {/* Header */}
      <div className="mb-2">
        <h2 className="font-mono text-[length:var(--text-lg)] uppercase tracking-[0.28em] text-[var(--text-muted)]">
          SIM 03 — THE INVISIBLE TEACHER & THE UNCREDITED HAND
        </h2>
        <p className="mt-2 max-w-2xl font-mono text-[length:var(--text-sm)] italic text-[var(--text-ghost)]">
          The person who teaches you, and the person who builds it with their
          hands — they rarely appear on what you made.
        </p>
      </div>

      {/* Toggle */}
      <ToggleSwitch on={documentationOn} onChange={setDocumentationOn} />

      {/* Main visual area */}
      <div className="flex flex-col gap-6 border-y border-[#1a1a2e] py-6 lg:flex-row">
        {/* SVG diagram */}
        <div className="flex shrink-0 justify-center lg:justify-start">
          <ClassroomDiagram
            state={state}
            meta={lastMeta}
            documentationOn={documentationOn}
            flashStudents={flashStudents}
          />
        </div>

        {/* Ledger */}
        <div className="flex min-w-0 flex-1 flex-col justify-start py-2">
          <Ledger state={state} documentationOn={documentationOn} />
        </div>
      </div>

      {/* Counters */}
      <ContributorCounters state={state} documentationOn={documentationOn} />

      {/* Semester end */}
      <SemesterEnd state={state} documentationOn={documentationOn} />

      {/* Controls */}
      <ClassroomControls
        params={params}
        setParams={(p) => {
          setParams(p)
          setState(initClassroomState(p))
          setLastMeta(null)
          setFlashStudents([])
        }}
        running={running}
        setRunning={setRunning}
        fast={fast}
        setFast={setFast}
        onReset={handleReset}
      />
    </section>
  )
}
