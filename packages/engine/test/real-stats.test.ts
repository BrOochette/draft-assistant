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
    // (56 × 2000 + 52 × 1000) / 3000 = 54,67 %
    expect(e.counter).toBe(wrScore((56 * 2000 + 52 * 1000) / 3000));
  });

  it('lisse le win rate vers 50 % et ne classe sans pool que les rôles principaux', () => {
    const top = (name: string, games: number, gameWinRate: number, laneShare: number) => cand(name, { games, gameWinRate, laneShare });
    const d = createEngineData({
      ...snapshot,
      winRatePriorGames: 3000,
      champions: [...snapshot.champions, champ('Malphite', ['Top'], 'TANK'), champ("Rek'Sai", ['Jungle'], 'AD'), champ('Zac', ['Jungle'], 'TANK')],
      candidates: { Top: [top('Malphite', 34916, 53.13, 78.5), top("Rek'Sai", 517, 55.51, 6.9), top('Zac', 2506, 53.71, 25)] }
    });
    const r = computeDraft(base, {}, d).roles[0]!;
    // Rek'Sai joue Top dans 6,9 % de ses parties : consultable, mais pas classé.
    expect(r.recommendations.map((e) => e.champion)).toEqual(['Malphite', 'Zac']);
    expect(r.secondaryRole.map((e) => e.champion)).toEqual(["Rek'Sai"]);
    // 34 916 parties à 53,13 % pèsent plus que 2 506 parties à 53,71 % une fois lissées.
    const malphite = r.recommendations[0]!;
    expect(malphite.counter).toBe(wrScore((53.13 * 34916 + 50 * 3000) / (34916 + 3000)));
    expect(r.recommendations[1]!.counter).toBe(wrScore((53.71 * 2506 + 50 * 3000) / (2506 + 3000)));
    expect(malphite.gameWinRate).toBe(53.13);
  });

  it('ignore un matchup de moins de 500 parties', () => {
    const d = createEngineData({
      ...snapshot,
      candidates: { Mid: [cand('Ahri', { gameWinRate: 52, matchups: { Zed: [63, 219] } })] }
    });
    const e = computeDraft({ ...base, enemy: { ...base.enemy, Mid: 'Zed' } }, {}, d).roles[2]!.recommendations[0]!;
    expect(e.matchup).toBeNull();
    expect(e.counter).toBe(wrScore(52));
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
