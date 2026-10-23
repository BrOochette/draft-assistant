import { avgScal, clamp } from './math';
import type { CompMember, CompScore, Criterion, Verdict } from './types';

export const compScore = (list: readonly CompMember[], opp: readonly CompMember[]): CompScore => {
  const met = new Set(list.flatMap((x) => x.provides));
  const ap = list.filter((x) => x.damage === 'AP').length;
  const ad = list.filter((x) => x.damage === 'AD').length;
  const a = avgScal(list);
  const o = avgScal(opp);
  const minD = Math.min(a[0] - o[0], a[1] - o[1], a[2] - o[2]);
  const criteria: Criterion[] = [
    { key: 'frontline', value: met.has('Frontline') ? 100 : 20, weight: 25 },
    { key: 'engage', value: met.has('Engage') ? 100 : 25, weight: 25 },
    { key: 'peel', value: met.has('Peel') ? 100 : 30, weight: 15 },
    { key: 'damageMix', value: ap > 0 && ad > 0 ? 100 : 35, weight: 15 },
    { key: 'scaling', value: clamp(Math.round(60 + 20 * minD)), weight: 20 }
  ];
  const total = Math.round(criteria.reduce((s, p) => s + p.value * p.weight, 0) / 100);
  return { total, criteria };
};

export const verdictOf = (n: number): Verdict => (n >= 75 ? 'solid' : n >= 55 ? 'fair' : n >= 35 ? 'fragile' : 'fix');

/** Compo neutre opposée quand aucun pick ennemi n'est connu. */
export const NEUTRAL_MEMBER: CompMember = { name: '', damage: 'TANK', provides: [], scaling: [3, 3, 3] };
