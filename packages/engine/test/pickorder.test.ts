import { describe, expect, it } from 'vitest';
import type { Candidate, DraftState, StatsSnapshot } from '@draft/schemas';
import { computeDraft, createEngineData } from '../src';

// Deux options en Mid (Ahri, Zed) et deux adversaires probables (Syndra, Lux), tous à 50 % : Ahri gagne contre Syndra
// et perd contre Lux, Zed l'inverse. À l'aveugle, les deux se valent ; en attendant, on prend toujours le bon.
const champ = (name: string) => ({ name, damage: 'AP' as const, provides: [], scaling: [3, 3, 3] as [3, 3, 3], roles: ['Mid' as const], ddragonId: name });
const cand = (name: string, extra: Partial<Candidate> = {}): Candidate => ({
  name, games: 10000, synergyBase: 55, laneWinRate: null, gameWinRate: 50, scaling: [3, 3, 3], provides: [], damage: 'AP', notes: [], laneShare: 100, ...extra
});
const snapshot: StatsSnapshot = {
  version: 1,
  source: 'lolalytics',
  patch: '16.21',
  rank: 'Emerald+',
  ddragonVersion: '16.21.1',
  champions: ['Ahri', 'Zed', 'Syndra', 'Lux'].map(champ),
  candidates: {
    Mid: [
      cand('Ahri', { matchups: { Syndra: [54, 3000], Lux: [46, 3000] } }),
      cand('Zed', { matchups: { Syndra: [46, 3000], Lux: [54, 3000] } }),
      cand('Syndra', { games: 9000 }),
      cand('Lux', { games: 9000 })
    ]
  },
  matchupNotes: { matchups: {}, fixedInfo: {} },
  banSuggestions: []
};
const data = createEngineData(snapshot);
const state: DraftState = {
  assign: { Top: null, Jungle: null, Mid: 'Noa', ADC: null, Support: null },
  ally: { Top: null, Jungle: null, Mid: null, ADC: null, Support: null },
  enemy: { Top: null, Jungle: null, Mid: null, ADC: null, Support: null },
  allyBans: [],
  enemyBans: []
};
const pools = { Noa: { Mid: [{ champion: 'Ahri', mastery: 5 }, { champion: 'Zed', mastery: 5 }] } };
const mid = (s: DraftState) => computeDraft(s, pools, data).roles[2]!;

describe('ordre de pick : gain à choisir après le vis-à-vis', () => {
  it('gain = meilleur choix contre chaque adversaire, moins le meilleur choix à l’aveugle', () => {
    const cp = mid(state).counterPick!;
    // Écart lissé : ±4 × 3000 / 4000 = ±3 points. Attendre : +3 contre chacun ; à l'aveugle : 0 en moyenne.
    expect(cp.gain).toBeCloseTo(3);
    expect(cp.opponents).toBe(2);
    expect(cp.options).toBe(2);
  });

  it('rien quand le vis-à-vis est connu ou le rôle déjà pris', () => {
    expect(mid({ ...state, enemy: { ...state.enemy, Mid: 'Lux' } }).counterPick).toBeNull();
    expect(mid({ ...state, ally: { ...state.ally, Mid: 'Ahri' } }).counterPick).toBeNull();
  });

  it('un adversaire banni ne compte plus', () => {
    expect(mid({ ...state, enemyBans: ['Lux'] }).counterPick!.opponents).toBe(1);
  });
});
