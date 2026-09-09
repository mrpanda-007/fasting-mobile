import { NativeModules, Platform } from 'react-native';

import type { TimerSnapshot } from '../../domain/fasting/engine';
import type { PendingPhase } from '../../data/local/sqlite/fastingRepository';

type WidgetState =
  | { state: 'active'; planName: string; phaseKind: 'fast' | 'refeed'; startedAt: number; targetAt: number; cycleNumber: number; darkMode: boolean }
  | { state: 'pending'; planName: string; phaseKind: 'fast' | 'refeed'; cycleNumber: number; darkMode: boolean }
  | { state: 'idle'; darkMode: boolean };

type FastingWidgetNativeModule = { clear(): void; update(state: WidgetState): void };

/**
 * Android owns the widget's presentation. We only sync committed timer state,
 * never the per-second display value, so a widget remains correct after process death.
 */
export function syncFastingWidget(active: TimerSnapshot | null, pending: PendingPhase | null, darkMode: boolean) {
  if (Platform.OS !== 'android') return;
  const module = NativeModules.FastingWidget as FastingWidgetNativeModule | undefined;
  if (!module) return;

  if (active) {
    module.update({
      state: 'active',
      planName: active.planName,
      phaseKind: active.phaseKind,
      startedAt: active.startedAt,
      targetAt: active.targetAt,
      cycleNumber: active.cycleNumber,
      darkMode,
    });
    return;
  }

  if (pending) {
    module.update({ state: 'pending', planName: pending.planName, phaseKind: pending.kind, cycleNumber: pending.cycleNumber, darkMode });
    return;
  }

  module.update({ state: 'idle', darkMode });
}

/** Clears widget preferences when the user deletes all local app data. */
export function clearFastingWidget() {
  if (Platform.OS !== 'android') return;
  const module = NativeModules.FastingWidget as FastingWidgetNativeModule | undefined;
  module?.clear();
}
