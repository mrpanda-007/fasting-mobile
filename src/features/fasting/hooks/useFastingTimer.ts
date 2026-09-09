import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { snapshotTimer, type ActiveTimerRecord, type TimerSnapshot } from '../../../domain/fasting/engine';
import { protocolForPreset, type ProtocolSnapshot } from '../../../domain/fasting/protocol';
import { cancelActivePlan, endActivePhase, getActiveNotificationId, getActiveTimer, getPendingPhase, listHistory, setActiveNotificationId, startPendingPhase, startPlan, type HistoryItem, type PendingPhase } from '../../../data/local/sqlite/fastingRepository';
import { cancelTargetNotification, scheduleTargetNotification } from '../../../services/notifications/timerNotification';
import { syncFastingWidget } from '../../../services/widgets/fastingWidget';

type FastingStore = { hydrated: boolean; active: TimerSnapshot | null; pending: PendingPhase | null; history: HistoryItem[]; error: string | null };

export function useFastingTimer(darkMode: boolean) {
  const [store, setStore] = useState<FastingStore>({ hydrated: false, active: null, pending: null, history: [], error: null });
  const [isForeground, setIsForeground] = useState(AppState.currentState === 'active');
  const refresh = useCallback(async () => {
    try {
      const [active, pending, history] = await Promise.all([getActiveTimer(), getPendingPhase(), listHistory()]);
      const snapshot = active ? snapshotTimer(active) : null;
      syncFastingWidget(snapshot, pending, darkMode);
      setStore({ hydrated: true, active: snapshot, pending, history, error: null });
    } catch (error) { setStore((current) => ({ ...current, hydrated: true, error: error instanceof Error ? error.message : 'Unable to restore your timer.' })); }
  }, [darkMode]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { syncFastingWidget(store.active, store.pending, darkMode); }, [darkMode]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => { setIsForeground(next === 'active'); if (next === 'active') void refresh(); });
    return () => subscription.remove();
  }, [refresh]);
  useEffect(() => {
    if (!store.active || !isForeground) return;
    const timer = setInterval(() => setStore((current) => current.active ? { ...current, active: snapshotTimer(current.active) } : current), 1000);
    return () => clearInterval(timer);
  }, [isForeground, store.active?.phaseId]);
  const execute = useCallback(async (action: () => Promise<unknown>) => { try { await action(); await refresh(); } catch (error) { setStore((current) => ({ ...current, error: error instanceof Error ? error.message : 'Something went wrong.' })); } }, [refresh]);
  const start = useCallback((protocol: ProtocolSnapshot) => execute(async () => {
    const active = await startPlan(protocol);
    if (active) await setActiveNotificationId(await scheduleTargetNotification(active.targetAt, active.phaseKind));
  }), [execute]);
  const end = useCallback(() => execute(async () => {
    const notificationId = await getActiveNotificationId();
    await cancelTargetNotification(notificationId);
    await endActivePhase();
  }), [execute]);
  const startPending = useCallback(() => execute(async () => {
    const active = await startPendingPhase();
    if (active) await setActiveNotificationId(await scheduleTargetNotification(active.targetAt, active.phaseKind));
  }), [execute]);
  const cancelPlan = useCallback(() => execute(async () => {
    const notificationId = await getActiveNotificationId();
    await cancelTargetNotification(notificationId);
    await cancelActivePlan();
  }), [execute]);
  return { ...store,
    startPreset: (name: string) => start(protocolForPreset(name)),
    startProtocol: start,
    endActivePhase: end,
    startPendingPhase: startPending,
    cancelPlan,
    refresh,
  };
}
