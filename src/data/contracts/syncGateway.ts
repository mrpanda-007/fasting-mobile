import type { FastingPlan } from '../../domain/fasting/models';

export type SyncResult = { plans: FastingPlan[]; cursor: string | null };

/** A future API adapter. Queueing and retry live behind this boundary. */
export interface SyncGateway {
  pull(cursor: string | null): Promise<SyncResult>;
  push(plans: FastingPlan[]): Promise<SyncResult>;
}
