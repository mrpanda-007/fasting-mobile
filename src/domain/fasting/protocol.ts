export type PhaseKind = 'fast' | 'refeed';

export type ProtocolSnapshot = {
  version: 1;
  name: string;
  fastDurationMs: number;
  refeedDurationMs: number | null;
  repeatCount: number | null;
};

const hour = 60 * 60 * 1000;

export function protocolForPreset(name: string): ProtocolSnapshot {
  if (name === '16:8') return { version: 1, name, fastDurationMs: 16 * hour, refeedDurationMs: 8 * hour, repeatCount: null };
  if (name === '18:6') return { version: 1, name, fastDurationMs: 18 * hour, refeedDurationMs: 6 * hour, repeatCount: null };
  if (name === 'OMAD') return { version: 1, name, fastDurationMs: 23 * hour, refeedDurationMs: hour, repeatCount: null };
  if (name === 'Rolling') return { version: 1, name: 'Rolling 48:4', fastDurationMs: 48 * hour, refeedDurationMs: 4 * hour, repeatCount: 5 };
  if (name === 'Custom') return { version: 1, name: 'Custom 36h', fastDurationMs: 36 * hour, refeedDurationMs: null, repeatCount: 1 };
  return { version: 1, name: '24h Fast', fastDurationMs: 24 * hour, refeedDurationMs: null, repeatCount: 1 };
}

export function phaseDuration(protocol: ProtocolSnapshot, kind: PhaseKind) {
  return kind === 'fast' ? protocol.fastDurationMs : protocol.refeedDurationMs ?? 0;
}

export function protocolDetail(protocol: ProtocolSnapshot) {
  const fast = `${Math.round(protocol.fastDurationMs / hour)}h Fast`;
  if (!protocol.refeedDurationMs) return fast;
  const refeed = `${Math.round(protocol.refeedDurationMs / hour)}h Refeed`;
  return `${fast} → ${refeed}${protocol.repeatCount && protocol.repeatCount > 1 ? ` · ${protocol.repeatCount} cycles` : ''}`;
}
