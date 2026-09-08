import type { PhaseKind, ProtocolSnapshot } from './protocol';

export type ActiveTimerRecord = {
  planId: string;
  phaseId: string;
  phaseKind: PhaseKind;
  planName: string;
  protocol: ProtocolSnapshot;
  cycleNumber: number;
  startedAt: number;
  targetAt: number;
};

export type TimerSnapshot = ActiveTimerRecord & {
  now: number;
  elapsedMs: number;
  remainingMs: number;
  progress: number;
  targetReached: boolean;
};

export function snapshotTimer(timer: ActiveTimerRecord, now = Date.now()): TimerSnapshot {
  const duration = Math.max(1, timer.targetAt - timer.startedAt);
  const elapsedMs = Math.max(0, now - timer.startedAt);
  const remainingMs = timer.targetAt - now;
  return { ...timer, now, elapsedMs, remainingMs, progress: Math.min(1, elapsedMs / duration), targetReached: remainingMs <= 0 };
}

export function formatDuration(milliseconds: number) {
  const seconds = Math.floor(Math.abs(milliseconds) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return { primary: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`, seconds: `:${String(remainder).padStart(2, '0')}` };
}
