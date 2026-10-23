import type { Scaling } from '@draft/schemas';

export const clamp = (n: number): number => Math.max(0, Math.min(100, n));

/** Score de 0 à 100 d'un win rate : 50 % donne 50, chaque point au-dessus vaut 10. */
export const wrScore = (wr: number): number => clamp(Math.round(50 + (wr - 50) * 10));

export type Triple = [number, number, number];

/** Scaling moyen par phase. Une liste vide vaut 3 partout. */
export const avgScal = (list: ReadonlyArray<{ scaling: Scaling }>): Triple => {
  if (!list.length) return [3, 3, 3];
  const out: Triple = [0, 0, 0];
  for (let i = 0; i < 3; i++) out[i] = list.reduce((s, x) => s + x.scaling[i]!, 0) / list.length;
  return out;
};
