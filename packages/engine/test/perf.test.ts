import { describe, expect, it } from 'vitest';
import { ROLES, type Candidate, type Champion, type DraftState, type StatsSnapshot } from '@draft/schemas';
import { computeDraft, createEngineData } from '../src';

// Pire cas : 170 champions candidats sur chaque rôle, aucun pool, 10 bans, les 5 rôles ouverts.
const N = 170;
const DMG = ['AP', 'AD', 'TANK'] as const;
const PROVIDES = [[], ['Frontline'], ['Engage'], ['Peel'], ['Frontline', 'Engage'], ['Engage', 'Peel']] as const;
const lvl = (i: number) => ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5;

const champions: Champion[] = Array.from({ length: N }, (_, i) => ({
  name: 'Champ' + i,
  damage: DMG[i % 3]!,
  provides: [...PROVIDES[i % PROVIDES.length]!],
  scaling: [lvl(i), lvl(i + 2), lvl(i + 4)],
  roles: [...ROLES],
  ddragonId: 'Champ' + i
}));
const candidate = (c: Champion, i: number): Candidate => ({
  name: c.name,
  games: 300 + i * 97,
  synergyBase: 40 + (i % 35),
  laneWinRate: 46 + (i % 9),
  gameWinRate: 47 + ((i * 7) % 8),
  scaling: c.scaling,
  provides: c.provides,
  damage: c.damage,
  notes: [{ sign: '+', text: 'Note ' + i }]
});
const snapshot: StatsSnapshot = {
  version: 1,
  patch: 'perf',
  rank: 'perf',
  ddragonVersion: 'perf',
  champions,
  candidates: Object.fromEntries(ROLES.map((r) => [r, champions.map(candidate)])),
  matchupNotes: { matchups: {}, fixedInfo: {} },
  banSuggestions: champions.slice(0, 20).map((c, i) => ({ champion: c.name, role: 'Mid', threat: 50 + i, reason: 'x' }))
};
const data = createEngineData(snapshot);
const names = champions.map((c) => c.name);
const state: DraftState = {
  assign: { Top: 'A', Jungle: 'B', Mid: 'C', ADC: 'D', Support: 'E' },
  ally: { Top: null, Jungle: null, Mid: null, ADC: null, Support: null },
  enemy: { Top: names[10]!, Jungle: names[11]!, Mid: names[12]!, ADC: null, Support: null },
  allyBans: names.slice(0, 5),
  enemyBans: names.slice(5, 10)
};

describe('performance du moteur', () => {
  it('reste sous 50 ms (médiane) dans le pire cas', () => {
    for (let i = 0; i < 5; i++) computeDraft(state, {}, data);
    const times: number[] = [];
    for (let i = 0; i < 50; i++) {
      const t = performance.now();
      const r = computeDraft(state, {}, data);
      times.push(performance.now() - t);
      expect(r.roles[0]!.inPool.length).toBe(N - 13);
    }
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)]!;
    expect(median).toBeLessThan(50);
  });
});
