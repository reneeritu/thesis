import { SimulationScenario } from './types';
import {
  RunState,
  pushEvent,
  setStatus,
  setRunScenario,
  bumpCounter,
} from './store';
import { getArcHandler } from './arcs';
import { ArcContext } from './arcs/types';
import { recomputeCounters } from './snapshot';

const TICK_DELAY_MS = 250; // visible pacing for the demo

export type SeedFn = (state: RunState) => Promise<void>;

/**
 * Drive a scenario from start to finish in the background.
 * The seedFn (provided by caller, implemented by W2B) runs first to populate
 * spaces, hero nodes, tokens, and projectIds onto the run state.
 */
export async function runScenario(
  state: RunState,
  scenario: SimulationScenario,
  seedFn: SeedFn,
): Promise<void> {
  setRunScenario(state, scenario);
  try {
    setStatus(state, 'seeding');
    pushEvent(state, {
      tick: 0,
      type: 'world:seed_start',
      human: `Seeding world for ${scenario.simRunId}`,
    });

    await seedFn(state);

    pushEvent(state, {
      tick: 0,
      type: 'world:seed_complete',
      human: `World seeded with ${state.heroNodeAliases.length} hero nodes and ${state.spaceIds.length} spaces`,
    });

    setStatus(state, 'running');

    const beats = [...scenario.beats].sort((a, b) => a.tick - b.tick);

    for (const beat of beats) {
      while (state.pause) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 250));
      }
      state.currentTick = beat.tick;

      const ctx: ArcContext = {
        state,
        scenario,
        emit: (ev) => pushEvent(state, ev),
        now: () => new Date().toISOString(),
      };

      const handler = getArcHandler(beat.arcId);
      try {
        await handler(ctx, beat);
      } catch (err) {
        pushEvent(state, {
          tick: beat.tick,
          type: 'arc:error',
          human: `Beat ${beat.arcId}:${beat.action} failed — ${err instanceof Error ? err.message : 'unknown'}`,
        });
        bumpCounter(state, 'flagsFiled', 0);
      }

      try {
        const c = await recomputeCounters(state);
        state.counters = c;
      } catch {
        // ignore
      }

      await new Promise((r) => setTimeout(r, TICK_DELAY_MS));
    }

    setStatus(state, 'complete');
    pushEvent(state, {
      tick: state.currentTick + 1,
      type: 'world:complete',
      human: 'Simulation complete',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    setStatus(state, 'failed', msg);
    pushEvent(state, {
      tick: state.currentTick,
      type: 'world:failed',
      human: `Simulation failed: ${msg}`,
    });
  }
}
