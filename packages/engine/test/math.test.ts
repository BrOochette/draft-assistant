import { describe, expect, it } from 'vitest';
import { compScore, verdictOf, wrScore } from '../src';

describe('wrScore', () => {
  it('vaut 50 à 50 % et reste borné', () => {
    expect(wrScore(50)).toBe(50);
    expect(wrScore(54.5)).toBe(95);
    expect(wrScore(60)).toBe(100);
    expect(wrScore(40)).toBe(0);
  });
});

describe('compScore', () => {
  it("donne les valeurs d'absence pour une compo vide", () => {
    const r = compScore([], []);
    expect(r.criteria.map((c) => c.value)).toEqual([20, 25, 30, 35, 60]);
    expect(r.total).toBe(33);
  });

  it('borne le critère de scaling', () => {
    const strong = { name: 'a', damage: 'AD' as const, provides: [], scaling: [5, 5, 5] as [5, 5, 5] };
    const weak = { name: 'b', damage: 'AP' as const, provides: [], scaling: [1, 1, 1] as [1, 1, 1] };
    expect(compScore([strong], [weak]).criteria[4]!.value).toBe(100);
    expect(compScore([weak], [strong]).criteria[4]!.value).toBe(0);
  });

  it('applique les seuils de verdict', () => {
    expect([75, 74, 55, 54, 35, 34].map(verdictOf)).toEqual(['solid', 'fair', 'fair', 'fragile', 'fragile', 'fix']);
  });
});
