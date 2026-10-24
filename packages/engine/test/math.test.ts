import { describe, expect, it } from 'vitest';
import { compScore, totalScore, verdictOf, wrScore } from '../src';

describe('wrScore', () => {
  it('vaut 50 à 50 % et reste borné', () => {
    expect(wrScore(50)).toBe(50);
    expect(wrScore(54.5)).toBe(95);
    expect(wrScore(60)).toBe(100);
    expect(wrScore(40)).toBe(0);
  });
});

describe('totalScore', () => {
  it('garde les poids de la maquette par défaut', () => {
    expect(totalScore(80, 60, null, 'Top', true, {})).toBe(Math.round(80 * 0.55 + 60 * 0.45));
    expect(totalScore(80, 60, 70, 'Top', true, {})).toBe(Math.round(80 * 0.4 + 60 * 0.35 + 70 * 0.25));
  });

  it('classe par synergie ou par counter selon le mode, maîtrise comprise', () => {
    expect(totalScore(80, 60, null, 'Mid', false, { mode: 'synergy' })).toBe(80);
    expect(totalScore(80, 60, 40, 'Mid', false, { mode: 'counter' })).toBe(Math.round(60 * 0.75 + 40 * 0.25));
  });

  it('le mode propre à un rôle remplace le mode global', () => {
    const options = { mode: 'synergy' as const, modeByRole: { Top: 'counter' as const } };
    expect(totalScore(80, 60, null, 'Top', false, options)).toBe(60);
    expect(totalScore(80, 60, null, 'Mid', false, options)).toBe(80);
  });

  it("en mix, pondère le counter par rôle quand l'adversaire de lane est connu", () => {
    const w = { Top: 0.65, Jungle: 0.35 };
    expect(totalScore(80, 60, null, 'Top', true, { laneCounterWeight: w })).toBe(Math.round(80 * 0.35 + 60 * 0.65));
    expect(totalScore(80, 60, null, 'Jungle', true, { laneCounterWeight: w })).toBe(Math.round(80 * 0.65 + 60 * 0.35));
    // Adversaire inconnu : poids de la maquette.
    expect(totalScore(80, 60, null, 'Top', false, { laneCounterWeight: w })).toBe(Math.round(80 * 0.55 + 60 * 0.45));
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
