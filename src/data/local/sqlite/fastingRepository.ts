import { getDatabase } from './database';
import type { ActiveTimerRecord } from '../../../domain/fasting/engine';
import type { PhaseKind, ProtocolSnapshot } from '../../../domain/fasting/protocol';

export type HistoryItem = {
  id: string;
  name: string;
  protocol: ProtocolSnapshot;
  status: string;
  startedAt: number;
  endedAt: number | null;
  currentCycle: number;
  completedCycles: number;
  durationMs: number;
};
export type PendingPhase = { id: string; kind: PhaseKind; planId: string; planName: string; protocol: ProtocolSnapshot; cycleNumber: number; durationMs: number };

type ActiveRow = { plan_id: string; phase_id: string; kind: PhaseKind; name: string; protocol_json: string; cycle_number: number; started_at: number; target_at: number };
const id = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

async function event(planId: string, phaseId: string | null, type: string, now: number) {
  const db = await getDatabase();
  await db.runAsync('INSERT INTO timer_events (id, plan_id, phase_id, type, occurred_at) VALUES (?, ?, ?, ?, ?)', id('event'), planId, phaseId, type, now);
}

export async function getActiveTimer(): Promise<ActiveTimerRecord | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ActiveRow>(`SELECT p.id AS plan_id, ph.id AS phase_id, ph.kind, p.name, p.protocol_json, ph.cycle_number, ph.started_at, ph.target_at
    FROM active_timer a JOIN phase_runs ph ON ph.id = a.phase_id JOIN plan_runs p ON p.id = ph.plan_id WHERE a.slot = 1`);
  if (!row) return null;
  return { planId: row.plan_id, phaseId: row.phase_id, phaseKind: row.kind, planName: row.name, protocol: JSON.parse(row.protocol_json), cycleNumber: row.cycle_number, startedAt: row.started_at, targetAt: row.target_at };
}

export async function getActiveNotificationId() {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ notification_id: string | null }>('SELECT notification_id FROM active_timer WHERE slot = 1');
  return row?.notification_id ?? null;
}

export async function setActiveNotificationId(notificationId: string | null) {
  const db = await getDatabase();
  await db.runAsync('UPDATE active_timer SET notification_id = ?, updated_at = ? WHERE slot = 1', notificationId, Date.now());
}

export async function startPlan(protocol: ProtocolSnapshot, now = Date.now()) {
  const db = await getDatabase();
  if (await getActiveTimer()) throw new Error('Finish the current phase before starting another fast.');
  const planId = id('plan'); const phaseId = id('phase'); const targetAt = now + protocol.fastDurationMs;
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('INSERT INTO plan_runs (id, protocol_json, name, status, current_cycle, started_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', planId, JSON.stringify(protocol), protocol.name, 'active', 1, now, now, now);
    await tx.runAsync('INSERT INTO phase_runs (id, plan_id, cycle_number, phase_index, kind, planned_duration_ms, status, started_at, target_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', phaseId, planId, 1, 0, 'fast', protocol.fastDurationMs, 'active', now, targetAt, now, now);
    await tx.runAsync('INSERT INTO active_timer (slot, phase_id, updated_at) VALUES (1, ?, ?)', phaseId, now);
    await tx.runAsync('INSERT INTO timer_events (id, plan_id, phase_id, type, occurred_at) VALUES (?, ?, ?, ?, ?)', id('event'), planId, phaseId, 'fast_started', now);
  });
  return getActiveTimer();
}

export async function endActivePhase(now = Date.now()): Promise<PendingPhase | null> {
  const active = await getActiveTimer();
  if (!active) return null;
  const db = await getDatabase();
  const reachedTarget = now >= active.targetAt;
  let pending: PendingPhase | null = null;
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('UPDATE phase_runs SET status = ?, ended_at = ?, end_reason = ?, updated_at = ? WHERE id = ?', 'ended', now, reachedTarget ? 'completedAtOrAfterTarget' : 'endedEarly', now, active.phaseId);
    await tx.runAsync('DELETE FROM active_timer WHERE slot = 1');
    const nextKind: PhaseKind | null = active.phaseKind === 'fast' && active.protocol.refeedDurationMs ? 'refeed' : active.phaseKind === 'refeed' && (active.protocol.repeatCount === null || active.cycleNumber < active.protocol.repeatCount) ? 'fast' : null;
    if (!nextKind) {
      await tx.runAsync('UPDATE plan_runs SET status = ?, ended_at = ?, updated_at = ? WHERE id = ?', 'completed', now, now, active.planId);
    } else {
      const nextCycle = nextKind === 'fast' ? active.cycleNumber + 1 : active.cycleNumber;
      const durationMs = nextKind === 'fast' ? active.protocol.fastDurationMs : active.protocol.refeedDurationMs!;
      const phaseId = id('phase');
      await tx.runAsync('INSERT INTO phase_runs (id, plan_id, cycle_number, phase_index, kind, planned_duration_ms, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', phaseId, active.planId, nextCycle, nextKind === 'fast' ? 0 : 1, nextKind, durationMs, 'pending', now, now);
      await tx.runAsync('UPDATE plan_runs SET status = ?, current_cycle = ?, updated_at = ? WHERE id = ?', 'awaitingNextPhase', nextCycle, now, active.planId);
      pending = { id: phaseId, kind: nextKind, planId: active.planId, planName: active.planName, protocol: active.protocol, cycleNumber: nextCycle, durationMs };
    }
    await tx.runAsync('INSERT INTO timer_events (id, plan_id, phase_id, type, occurred_at) VALUES (?, ?, ?, ?, ?)', id('event'), active.planId, active.phaseId, 'phase_ended', now);
  });
  return pending;
}

export async function cancelActivePlan(now = Date.now()) {
  const active = await getActiveTimer();
  const pending = active ? null : await getPendingPhase();
  const planId = active?.planId ?? pending?.planId;
  if (!planId) return;
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    if (active) {
      await tx.runAsync('UPDATE phase_runs SET status = ?, ended_at = ?, end_reason = ?, updated_at = ? WHERE id = ?', 'cancelled', now, 'planCancelled', now, active.phaseId);
      await tx.runAsync('DELETE FROM active_timer WHERE slot = 1');
    }
    await tx.runAsync(`UPDATE phase_runs SET status = ?, updated_at = ? WHERE plan_id = ? AND status = 'pending'`, 'cancelled', now, planId);
    await tx.runAsync('UPDATE plan_runs SET status = ?, ended_at = ?, updated_at = ? WHERE id = ?', 'cancelled', now, now, planId);
    await tx.runAsync('INSERT INTO timer_events (id, plan_id, phase_id, type, occurred_at) VALUES (?, ?, ?, ?, ?)', id('event'), planId, active?.phaseId ?? null, 'plan_cancelled', now);
  });
}

export async function getPendingPhase(): Promise<PendingPhase | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ id: string; plan_id: string; kind: PhaseKind; name: string; protocol_json: string; cycle_number: number; planned_duration_ms: number }>(`SELECT ph.id, ph.plan_id, ph.kind, p.name, p.protocol_json, ph.cycle_number, ph.planned_duration_ms FROM phase_runs ph JOIN plan_runs p ON p.id = ph.plan_id WHERE ph.status = 'pending' ORDER BY ph.created_at ASC LIMIT 1`);
  return row ? { id: row.id, planId: row.plan_id, kind: row.kind, planName: row.name, protocol: JSON.parse(row.protocol_json), cycleNumber: row.cycle_number, durationMs: row.planned_duration_ms } : null;
}

export async function startPendingPhase(now = Date.now()) {
  const pending = await getPendingPhase();
  if (!pending) return null;
  const db = await getDatabase(); const targetAt = now + pending.durationMs;
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('UPDATE phase_runs SET status = ?, started_at = ?, target_at = ?, updated_at = ? WHERE id = ?', 'active', now, targetAt, now, pending.id);
    await tx.runAsync('INSERT INTO active_timer (slot, phase_id, updated_at) VALUES (1, ?, ?)', pending.id, now);
    await tx.runAsync('UPDATE plan_runs SET status = ?, updated_at = ? WHERE id = ?', 'active', now, pending.planId);
    await tx.runAsync('INSERT INTO timer_events (id, plan_id, phase_id, type, occurred_at) VALUES (?, ?, ?, ?, ?)', id('event'), pending.planId, pending.id, `${pending.kind}_started`, now);
  });
  return getActiveTimer();
}

export async function listHistory(): Promise<HistoryItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string; name: string; protocol_json: string; status: string; started_at: number; ended_at: number | null; current_cycle: number; completed_cycles: number; duration_ms: number }>(`SELECT p.id, p.name, p.protocol_json, p.status, p.started_at, p.ended_at, p.current_cycle,
    COALESCE(SUM(CASE WHEN ph.kind = 'refeed' AND ph.status = 'ended' THEN 1 WHEN ph.kind = 'fast' AND ph.status = 'ended' AND json_extract(p.protocol_json, '$.refeedDurationMs') IS NULL THEN 1 ELSE 0 END), 0) AS completed_cycles,
    COALESCE(SUM(CASE WHEN ph.ended_at IS NOT NULL AND ph.started_at IS NOT NULL THEN ph.ended_at - ph.started_at ELSE 0 END), 0) AS duration_ms
    FROM plan_runs p LEFT JOIN phase_runs ph ON ph.plan_id = p.id
    WHERE p.status != 'active' AND p.status != 'awaitingNextPhase'
    GROUP BY p.id ORDER BY p.started_at DESC`);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    protocol: JSON.parse(row.protocol_json) as ProtocolSnapshot,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    currentCycle: row.current_cycle,
    completedCycles: row.completed_cycles,
    durationMs: row.duration_ms,
  }));
}
