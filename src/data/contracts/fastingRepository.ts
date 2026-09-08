import type { ActiveFast, FastingPlan } from '../../domain/fasting/models';

/** Local and remote implementations must preserve these same durable records. */
export interface FastingRepository {
  getActiveFast(): Promise<ActiveFast | null>;
  getPlan(id: string): Promise<FastingPlan | null>;
  listPlans(): Promise<FastingPlan[]>;
  savePlan(plan: FastingPlan): Promise<void>;
  saveActiveFast(activeFast: ActiveFast | null): Promise<void>;
}
