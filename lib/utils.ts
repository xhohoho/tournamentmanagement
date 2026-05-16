export function shuffle<T>(arr: T[]): T[] {
  const b = [...arr];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export const TEAM_COLORS = [
  '#ff3d5a', '#4d7cff', '#ffb020', '#2dcc70',
  '#b06dff', '#ff7040', '#00c9d4', '#ff4daa',
];

export const WHEEL_COLORS = [
  '#ff3d5a', '#4d7cff', '#ffb020', '#2dcc70',
  '#b06dff', '#ff7040', '#00c9d4', '#ff4daa',
  '#78c6ff', '#ffd966',
];
