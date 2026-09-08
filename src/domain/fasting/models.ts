/**
 * Durable fasting records. These are intentionally UI- and backend-agnostic so
 * local storage and a future API use the same source-of-truth shapes.
 */
export type FastingPhaseKind = 'fast' | 'refeed';
export type FastStatus = 'scheduled' | 'active' | 'completed' | 'endedEarly' | 'cancelled';

export type FastingPhase = {
  id: string;
  kind: FastingPhaseKind;
  plannedDurationMs: number;
  startedAt: string | null;
  endsAt: string | null;
  completedAt: string | null;
  status: FastStatus;
};

export type FastingPlan = {
  id: string;
  ownerId: string | null;
  name: string;
  createdAt: string;
  phases: FastingPhase[];
  status: FastStatus;
  revision: number;
  updatedAt: string;
};

export type ActiveFast = {
  planId: string;
  phaseId: string;
  phaseKind: FastingPhaseKind;
  startedAt: string;
  endsAt: string;
};
