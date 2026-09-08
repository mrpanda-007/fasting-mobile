export type TodayState = 'idle' | 'fasting' | 'refeeding' | 'transition' | 'complete' | 'rollingBuilder' | 'customBuilder';
export type FastPlan = { detail: string; name: string };

export const plans: FastPlan[] = [
  { name: '16:8', detail: '16h Fast · 8h eating window' },
  { name: '18:6', detail: '18h Fast · 6h eating window' },
  { name: 'OMAD', detail: '23h Fast · 1h Refeed' },
  { name: '24h Fast', detail: 'one fast, no repeat' },
  { name: 'Rolling', detail: 'fast + refeed, repeated' },
  { name: 'Custom', detail: 'set your own durations' },
];
