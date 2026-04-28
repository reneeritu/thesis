import {
  SimulationCounters,
  SimulationEvent,
  SimulationScenario,
  SimulationSnapshot,
  SimulationStatus,
} from './types';

export type RunState = {
  simRunId: string;
  scenario: SimulationScenario | null;
  status: SimulationStatus;
  currentTick: number;
  events: SimulationEvent[];
  counters: SimulationCounters;
  spaceIds: string[];
  projectIds: string[];
  heroNodeAliases: string[];
  pause: boolean;
  startedAt?: string;
  updatedAt: string;
  tokensByAlias: Map<string, string>;
  spaceIdByKey: Map<string, string>;
  projectIdByKey: Map<string, string>;
  errorMessage?: string;
};

const runs = new Map<string, RunState>();

export function createRun(simRunId: string): RunState {
  const now = new Date().toISOString();
  const state: RunState = {
    simRunId,
    scenario: null,
    status: 'idle',
    currentTick: 0,
    events: [],
    counters: {
      blocksWritten: 0,
      tracesLogged: 0,
      flagsFiled: 0,
      mediationsResolved: 0,
      nftsMinted: 0,
      governancePassed: 0,
    },
    spaceIds: [],
    projectIds: [],
    heroNodeAliases: [],
    pause: false,
    startedAt: now,
    updatedAt: now,
    tokensByAlias: new Map(),
    spaceIdByKey: new Map(),
    projectIdByKey: new Map(),
    errorMessage: undefined,
  };
  runs.set(simRunId, state);
  return state;
}

export function getRun(simRunId: string): RunState | undefined {
  return runs.get(simRunId);
}

export function deleteRun(simRunId: string): void {
  runs.delete(simRunId);
}

export function listRuns(): RunState[] {
  return Array.from(runs.values());
}

export function setRunScenario(state: RunState, scenario: SimulationScenario): void {
  state.scenario = scenario;
  state.updatedAt = new Date().toISOString();
}

export function setStatus(state: RunState, status: SimulationStatus, error?: string): void {
  state.status = status;
  state.updatedAt = new Date().toISOString();
  if (error !== undefined) {
    state.errorMessage = error;
  } else if (status !== 'failed') {
    state.errorMessage = undefined;
  }
}

export function pushEvent(state: RunState, event: SimulationEvent): void {
  state.events.push(event);
  state.updatedAt = new Date().toISOString();
}

export function bumpCounter(state: RunState, key: keyof SimulationCounters, by = 1): void {
  const delta = by ?? 1;
  state.counters[key] += delta;
  state.updatedAt = new Date().toISOString();
}

export function recordSpace(state: RunState, key: string, mongoId: string): void {
  state.spaceIdByKey.set(key, mongoId);
  if (!state.spaceIds.includes(mongoId)) {
    state.spaceIds.push(mongoId);
  }
  state.updatedAt = new Date().toISOString();
}

export function recordProject(state: RunState, key: string, mongoId: string): void {
  state.projectIdByKey.set(key, mongoId);
  if (!state.projectIds.includes(mongoId)) {
    state.projectIds.push(mongoId);
  }
  state.updatedAt = new Date().toISOString();
}

export function setHeroAliases(state: RunState, aliases: string[]): void {
  state.heroNodeAliases = aliases;
  state.updatedAt = new Date().toISOString();
}

export function setToken(state: RunState, alias: string, token: string): void {
  state.tokensByAlias.set(alias, token);
  state.updatedAt = new Date().toISOString();
}

export function getToken(state: RunState, alias: string): string | undefined {
  return state.tokensByAlias.get(alias);
}

export function snapshot(state: RunState): SimulationSnapshot {
  return {
    simRunId: state.simRunId,
    currentTick: state.currentTick,
    status: state.status,
    events: state.events.slice(-200),
    counters: { ...state.counters },
    spaceIds: [...state.spaceIds],
    projectIds: [...state.projectIds],
    heroNodeAliases: [...state.heroNodeAliases],
    startedAt: state.startedAt,
    updatedAt: state.updatedAt,
  };
}

export function emptySnapshot(simRunId: string): SimulationSnapshot {
  return {
    simRunId,
    currentTick: 0,
    status: 'idle',
    events: [],
    counters: {
      blocksWritten: 0,
      tracesLogged: 0,
      flagsFiled: 0,
      mediationsResolved: 0,
      nftsMinted: 0,
      governancePassed: 0,
    },
    spaceIds: [],
    projectIds: [],
    heroNodeAliases: [],
    updatedAt: new Date().toISOString(),
  };
}
