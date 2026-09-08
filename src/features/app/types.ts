export type AppTab = 'today' | 'together' | 'history';
export type HistoryView = 'list' | 'plan' | 'fast';
export type PairFlow = 'none' | 'creatorSignIn' | 'creatorInvite' | 'recipientInvite' | 'recipientPlan' | 'paired';
export type Partner = { name: string; role: 'creator' | 'recipient' };
export type Sheet = 'reaction' | 'planDetails' | 'endFast' | null;
