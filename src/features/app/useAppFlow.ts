import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppTab, PairFlow, Partner, Sheet } from './types';
import type { TodayState } from '../today/model';

const partnerStorageKey = '@fasting/partner';
const themeStorageKey = '@fasting/theme';

/** Owns app-level navigation and persistence; screens remain presentational. */
export function useAppFlow() {
  const [state, setState] = useState<TodayState>('idle');
  const [tab, setTab] = useState<AppTab>('today');
  const [pairFlow, setPairFlow] = useState<PairFlow>('none');
  const [partner, setPartner] = useState<Partner | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [reactionToast, setReactionToast] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [darkMode, setDarkModeState] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('24h Fast');

  useEffect(() => {
    void AsyncStorage.getItem(partnerStorageKey).then((saved) => {
      if (saved) { setPartner(JSON.parse(saved) as Partner); setPairFlow('paired'); }
    });
  }, []);
  useEffect(() => { void AsyncStorage.getItem(themeStorageKey).then((saved) => setDarkModeState(saved === 'dark')); }, []);

  const returnToIdle = (plan = '24h Fast') => { setSelectedPlan(plan); setState('idle'); };
  const choosePlan = (plan: string) => {
    if (plan === 'Rolling') return setState('rollingBuilder');
    if (plan === 'Custom') return setState('customBuilder');
    setSelectedPlan(plan);
  };
  const startBuilder = (plan: 'Rolling' | 'Custom') => { setSelectedPlan(plan); setState('fasting'); };
  const savePartner = (next: Partner) => {
    setPartner(next); setPairFlow('paired'); void AsyncStorage.setItem(partnerStorageKey, JSON.stringify(next));
  };
  const setDarkMode = (next: boolean) => {
    setDarkModeState(next);
    void AsyncStorage.setItem(themeStorageKey, next ? 'dark' : 'light');
  };

  return { state, setState, tab, setTab, pairFlow, setPairFlow, partner, sheet, setSheet,
    reactionToast, setReactionToast, settingsOpen, setSettingsOpen,
    darkMode, setDarkMode, selectedPlan, returnToIdle, choosePlan, startBuilder, savePartner };
}
