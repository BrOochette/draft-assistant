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
    // Écart : (56 × 2000 + 52 × 1000) / 3000 − 52 = 2,67 points.
    expect(e.matchup).toEqual({ opponent: 'Zed', winRate: 56, games: 2000, delta: (56 * 2000 + 52 * 1000) / 3000 - 52 });
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

  it("compte les ennemis des autres lanes : un quart, trois quarts pour le duo bot", () => {
    const d = createEngineData({
      ...snapshot,
      champions: [...snapshot.champions, champ('Jinx', ['ADC'], 'AD'), champ('Leona', ['Support'], 'TANK'), champ('Lee Sin', ['Jungle'], 'AD'), champ('Ezreal', ['ADC'], 'AD')],
      candidates: {
        ADC: [cand('Jinx', { gameWinRate: 52, crossMatchups: { Support: { Leona: [48, 1000] }, Jungle: { 'Lee Sin': [55, 1000], Sejuani: [60, 100] } } })]
      }
    });
    const foes = { ...base.enemy, Support: 'Leona', Jungle: 'Lee Sin' };
    const jinx = computeDraft({ ...base, enemy: foes }, {}, d).roles[3]!.recommendations[0]!;
    // Écarts lissés vers 52 % avec 1 000 parties : Leona (48×1000 + 52×1000)/2000 − 52 = −2, Lee Sin +1,5.
    expect(jinx.enemyTeam.map((m) => [m.opponent, m.weight, m.delta])).toEqual([
      ['Lee Sin', 0.25, 1.5],
      ['Leona', 0.75, -2]
    ]);
    expect(jinx.enemyTeamDelta).toBe(0.25 * 1.5 + 0.75 * -2);
    expect(jinx.counter).toBe(wrScore(52 + 0.25 * 1.5 + 0.75 * -2));
    // Un matchup de moins de 500 parties (Sejuani, 100) n'est pas compté.
    const vsSej = computeDraft({ ...base, enemy: { ...base.enemy, Jungle: 'Sejuani' } }, {}, d).roles[3]!.recommendations[0]!;
    expect(vsSej.enemyTeam).toEqual([]);
  });

  it("ne propose plus de bans sur un rôle où l'ennemi a déjà pick", () => {
    const d = createEngineData({
      ...snapshot,
      banSuggestions: [
        { champion: 'Sejuani', role: 'Jungle', threat: 90 },
        { champion: 'Ahri', role: 'Mid', threat: 80 }
      ]
    });
    const bans = (state: DraftState) => computeDraft(state, {}, d).bans.suggestions.map((b) => b.champion);
    expect(bans(base)).toEqual(['Sejuani', 'Ahri']);
    // Lee Sin pick en jungle : Sejuani ne peut plus être jouée par l'ennemi à ce poste.
    expect(bans({ ...base, enemy: { ...base.enemy, Jungle: 'Lee Sin' } })).toEqual(['Ahri']);
  });

  it('propose au plus 3 bans par rôle, la réserve remplace un champion déjà pris', () => {
    const jgl = (champion: string, threat: number) => ({ champion, role: 'Jungle' as const, threat });
    const d = createEngineData({ ...snapshot, banSuggestions: [jgl('Sejuani', 90), jgl('Lee Sin', 85), jgl('Viego', 80), jgl('Zac', 75)] });
    const bans = (state: DraftState) => computeDraft(state, {}, d).bans.suggestions.map((b) => b.champion);
    expect(bans(base)).toEqual(['Sejuani', 'Lee Sin', 'Viego']);
    expect(bans({ ...base, enemyBans: ['Sejuani'] })).toEqual(['Lee Sin', 'Viego', 'Zac']);
  });

  it('ajoute la synergie de duo avec un allié verrouillé', () => {
    const without = mid(base);
    const withSej = mid({ ...base, ally: { ...base.ally, Jungle: 'Sejuani' } });
    const smoothed = (2.5 * 1800) / 2000;
    // Sejuani n'apporte ici ni trait ni écart de scaling : seule la synergie de duo change.
    expect(withSej.synergy - without.synergy).toBe(Math.round(4 * smoothed));
    expect(withSej.reasons).toContainEqual({ sign: '+', code: 'DUO', ally: 'Sejuani', delta: smoothed });
    expect(withSej.allyTeam).toEqual([{ ally: 'Sejuani', role: 'Jungle', delta: 2.5, games: 1800, smoothed }]);
    expect(withSej.duoBonus).toBe(Math.round(4 * smoothed));
    expect(without.allyTeam).toEqual([]);
    expect(without.duoBonus).toBe(0);
  });
});
