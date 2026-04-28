import { SimulationEvent, SimulationScenario, TimelineBeat, ArcId } from '../types';
import { RunState } from '../store';

export type ArcContext = {
  state: RunState;
  scenario: SimulationScenario;
  emit: (event: SimulationEvent) => void;
  now: () => string;
};

export type ArcHandler = (ctx: ArcContext, beat: TimelineBeat) => Promise<void>;

export type ArcHandlerRegistry = Record<ArcId, ArcHandler>;
