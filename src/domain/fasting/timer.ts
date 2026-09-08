import type { ActiveFast } from './models';

/** The derived timer state used by the UI; it is never persisted as a running counter. */
export type TimerSnapshot = {
  activeFast: ActiveFast;
  now: string;
  remainingMs: number;
  progress: number;
  isComplete: boolean;
};
