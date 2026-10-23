import { describe, expect, it } from 'vitest';
import type { Candidate, DraftState, StatsSnapshot } from '@draft/schemas';
import { computeDraft, createEngineData, wrScore } from '../src';

// Petit jeu de stats au format Lolalytics : pas de win rate de lane, matchups et duos mesurés.
const champ = (name: string, roles: StatsSnapshot['champions'][number]['roles'], damage: 'AP' | 'AD' | 'TANK' = 'AP') => ({
  name,
  damage,
  provides: [],
  scaling: [3, 3, 3] as [3, 3, 3],
  roles,
  ddragonId: name
});
const cand = (name: string, extra: Partial<Candidate> = {}): Candidate => ({
  name,
  games: 10000,
  synergyBase: 55,
  laneWinRate: null,
  gameWinRate: 50,
  scaling: [3, 3, 3],
  provides: [],
  damage: 'AP',
  notes: [],
  ...extra
});

const snapshot: StatsSnapshot = {
  version: 1,
  source: 'lolalytics',
  patch: '16.21',
  rank: 'Emerald+',
  ddragonVersion: '16.21.1',
  champions: [champ('Ahri', ['Mid']), champ('Zed', ['Mid'], 'AD'), champ('Sejuani', ['Jungle'], 'TANK')],
  candidates: {
    Mid: [
      cand('Ahri', {
        gameWinRate: 52,
        matchups: { Zed: [56, 2000] },
        duos: { Jungle: { Sejuani: [2.5, 1800] } }
      })
    ],
    Jungle: [cand('Sejuani', { damage: 'TANK' })]
  },
  matchupNotes: { matchups: {}, fixedInfo: {} },
  banSuggestions: []
};
const data = createEngineData(snapshot);
const base: DraftState = {
  assign: { Top: 'A', Jungle: 'B', Mid: 'C', ADC: 'D', Support: 'E' },
  ally: { Top: null, Jungle: null, Mid: null, ADC: null, Support: null },
  enemy: { Top: null, Jungle: null, Mid: null, ADC: null, Support: null },
  allyBans: [],
  enemyBans: []
};
const mid = (state: DraftState) => computeDraft(state, {}, data).roles[2]!.recommendations[0]!;

describe('stats réelles (format Lolalytics)', () => {
  it('sans adversaire connu, le counter vient du win rate de partie seul', () => {
    const e = mid(base);
    expect(e.laneWinRate).toBeNull();
    expect(e.matchup).toBeNull();
    expect(e.counter).toBe(wrScore(52));
  });

  it("avec l'adversaire de lane connu, le counter utilise le matchup lissé", () => {
    const e = mid({ ...base, enemy: { ...base.enemy, Mid: 'Zed' } });
    expect(e.matchup).toEqual({ opponent: 'Zed', winRate: 56, games: 2000 });
    // (56 × 2000 + 52 × 200) / 2200 = 55,64 %
    expect(e.counter).toBe(wrScore((56 * 2000 + 52 * 200) / 2200));
  });

  it('ajoute la synergie de duo avec un allié verrouillé', () => {
    const without = mid(base);
    const withSej = mid({ ...base, ally: { ...base.ally, Jungle: 'Sejuani' } });
    const smoothed = (2.5 * 1800) / 2000;
    // Sejuani n'apporte ici ni trait ni écart de scaling : seule la synergie de duo change.
    expect(withSej.synergy - without.synergy).toBe(Math.round(4 * smoothed));
    expect(withSej.reasons).toContainEqual({ sign: '+', code: 'DUO', ally: 'Sejuani', delta: smoothed });
  });
});
