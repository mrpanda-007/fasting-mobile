/** Shared motion values. Keep all interaction feedback quiet and under 300ms. */
export const motion = {
  pressIn: 100,
  pressOut: 160,
  control: 180,
  sheet: 240,
  toastIn: 180,
  toastOut: 220,
  completion: 280,
  pressedScale: 0.98,
  toastRise: 8,
} as const;
