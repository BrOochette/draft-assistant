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
  it('sans ennemi connu, le win rate attendu est le win rate du champion', () => {
    const e = mid(base);
    expect(e.laneWinRate).toBeNull();
    expect(e.matchup).toBeNull();
    expect(e.enemyTeam).toEqual([]);
    expect(e.expected).toEqual({ base: 52, matchups: 0, duos: 0, mastery: 0, score: 52 });
  });

  it("avec l'adversaire de lane connu, ajoute l'écart du matchup lissé", () => {
    const e = mid({ ...base, enemy: { ...base.enemy, Mid: 'Zed' } });
    // Écart : (56 − 52) × 2000 / (2000 + 1000) = 2,67 points, sans prior de classe (lissé vers 0).
    const delta = (4 * 2000) / 3000;
    expect(e.matchup).toEqual({ opponent: 'Zed', role: 'Mid', lane: true, weight: 1, winRate: 56, games: 2000, prior: null, delta });
    expect(e.expected!.score).toBeCloseTo(52 + delta);
    expect(e.counter).toBe(wrScore(52 + delta));
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

  it('lisse un matchup peu joué vers la moyenne de sa paire de classes', () => {
    const withMatchups = (matchups: Record<string, [number, number]>) =>
      createEngineData({
        ...snapshot,
        champions: snapshot.champions.map((c) => ({ ...c, classes: c.name === 'Ahri' ? ['Burst'] : ['Assassin'] })),
        candidates: { Mid: [cand('Ahri', { gameWinRate: 52, matchups })] },
        classPriors: { duo: {}, matchup: { 'Mid|Burst|Mid|Assassin': [-1.5, 50000] } }
      });
    const vsZed = (d: ReturnType<typeof createEngineData>) =>
      computeDraft({ ...base, enemy: { ...base.enemy, Mid: 'Zed' } }, {}, d).roles[2]!.recommendations[0]!.matchup!;
    // (11 × 219 − 1,5 × 1000) / 1219 : les 219 parties comptent, tirées vers la moyenne Burst contre Assassin.
    const rare = vsZed(withMatchups({ Zed: [63, 219] }));
    expect(rare).toMatchObject({ games: 219, winRate: 63, prior: { classes: ['Burst', 'Assassin'], delta: -1.5, games: 50000 } });
    expect(rare.delta).toBeCloseTo((11 * 219 - 1.5 * 1000) / 1219);
    // Paire absente des données : la moyenne de classe seule.
    expect(vsZed(withMatchups({}))).toMatchObject({ games: 0, winRate: null, delta: -1.5 });
  });

  it("compte les ennemis des autres lanes : un quart, trois quarts pour le duo bot", () => {
    const d = createEngineData({
      ...snapshot,
      champions: [...snapshot.champions, champ('Jinx', ['ADC'], 'AD'), champ('Leona', ['Support'], 'TANK'), champ('Lee Sin', ['Jungle'], 'AD'), champ('Ezreal', ['ADC'], 'AD')],
      candidates: {
        ADC: [cand('Jinx', { gameWinRate: 52, crossMatchups: { Support: { Leona: [48, 1000] }, Jungle: { 'Lee Sin': [55, 1000] } } })]
      }
    });
    const foes = { ...base.enemy, Support: 'Leona', Jungle: 'Lee Sin', Mid: 'Zed' };
    const jinx = computeDraft({ ...base, enemy: foes }, {}, d).roles[3]!.recommendations[0]!;
    // Écarts lissés vers 0 avec 1 000 parties : Leona −4 × 1/2 = −2, Lee Sin +3 × 1/2 = +1,5 ; Zed sans données : 0.
    expect(jinx.enemyTeam.map((m) => [m.opponent, m.weight, m.games, m.delta])).toEqual([
      ['Lee Sin', 0.25, 1000, 1.5],
      ['Zed', 0.25, 0, 0],
      ['Leona', 0.75, 1000, -2]
    ]);
    expect(jinx.expected!.matchups).toBe(0.25 * 1.5 + 0.75 * -2);
    expect(jinx.counter).toBe(wrScore(52 + 0.25 * 1.5 + 0.75 * -2));
  });

  it('ajoute la maîtrise en points et suit le mode du rôle', () => {
    const pools = { C: { Mid: [{ champion: 'Ahri', mastery: 10 }] } };
    const state = { ...base, enemy: { ...base.enemy, Mid: 'Zed' }, ally: { ...base.ally, Jungle: 'Sejuani' } };
    const ahri = (modeByRole = {}) => computeDraft(state, pools, data, { modeByRole }).roles[2]!.inPool[0]!.expected!;
    const all = ahri();
    expect(all.mastery).toBe(2);
    expect(all.score).toBeCloseTo(all.base + all.matchups + all.duos + 2);
    expect(ahri({ Mid: 'synergy' }).score).toBeCloseTo(all.base + all.duos + 2);
    expect(ahri({ Mid: 'counter' }).score).toBeCloseTo(all.base + all.matchups + 2);
  });

  it("ne propose plus de bans sur un rôle où l'ennemi a déjà pick", () => {
    const d = createEngineData({
      ...snapshot,
      banSuggestions: [
        { champion: 'Sejuani', role: 'Jungle', threat: 90 },
        { champion: 'Ahri', role: 'Mid', threat: 80 }
      ]
    });
    // Nos options (pools) ne sont jamais proposées en ban : ici Zed, joué hors rôle, en jungle et en mid.
    const pools = { B: { Jungle: [{ champion: 'Zed', mastery: 5 }] }, C: { Mid: [{ champion: 'Zed', mastery: 5 }] } };
    const bans = (state: DraftState) => computeDraft(state, pools, d).bans.suggestions.map((b) => b.champion);
    expect(bans(base)).toEqual(['Sejuani', 'Ahri']);
    // Lee Sin pick en jungle : Sejuani ne peut plus être jouée par l'ennemi à ce poste.
    expect(bans({ ...base, enemy: { ...base.enemy, Jungle: 'Lee Sin' } })).toEqual(['Ahri']);
  });

  it('valeur d’un ban : force du champion plus la baisse de notre meilleure option du rôle', () => {
    const d = createEngineData({
      ...snapshot,
      champions: [...snapshot.champions, champ('Syndra', ['Mid'])],
      candidates: {
        Mid: [
          cand('Ahri', { gameWinRate: 52, matchups: { Zed: [44, 3000], Syndra: [52, 3000] } }),
          cand('Zed', { gameWinRate: 52, games: 5000 }),
          cand('Syndra', { gameWinRate: 53, games: 5000 })
        ]
      }
    });
    const bans = computeDraft(base, { C: { Mid: [{ champion: 'Ahri', mastery: 5 }] } }, d).bans.suggestions.filter((b) => b.role === 'Mid');
    // Zed : force +2, et Ahri (notre seule option, 52 %) perd (44 − 52) × 3000 / 4000 = 6 pts contre lui. Ahri, notre option, n'est pas proposée.
    expect(bans.map((b) => [b.champion, b.impact])).toEqual([
      ['Zed', { value: 8, strength: 2, drop: 6, ours: 'Ahri' }],
      ['Syndra', { value: 3, strength: 3, drop: 0, ours: 'Ahri' }]
    ]);
  });

  it('donne le win rate moyen du rôle, pondéré par les parties, sur les rôles principaux', () => {
    const d = createEngineData({
      ...snapshot,
      candidates: { Mid: [cand('Ahri', { gameWinRate: 52, games: 3000 }), cand('Zed', { gameWinRate: 50, games: 1000 }), cand('Syndra', { gameWinRate: 60, games: 9000, laneShare: 10 })] }
    });
    // Syndra joue Mid dans 10 % de ses parties : hors moyenne. (52 × 3000 + 50 × 1000) / 4000 = 51,5.
    expect(computeDraft(base, {}, d).roles[2]!.averageWr).toBe(51.5);
  });

  it('classe un champion du pool joué hors de ses rôles habituels, signalé peu fiable', () => {
    const top = computeDraft(base, { A: { Top: [{ champion: 'Zed', mastery: 8 }] } }, data).roles[0]!;
    expect(top.note).toBe('POOL');
    const zed = top.recommendations[0]!;
    expect(zed).toMatchObject({ champion: 'Zed', pool: 'in', games: 0, lowSample: true, laneWinRate: null, gameWinRate: 50 });
  });

  it('ajoute le duo avec un allié verrouillé, à moitié hors botlane', () => {
    const without = mid(base);
    const withSej = mid({ ...base, ally: { ...base.ally, Jungle: 'Sejuani' } });
    const smoothed = (2.5 * 1800) / 2000;
    // Score de la maquette : seule la synergie de duo change (Sejuani n'apporte ni trait ni écart de scaling).
    expect(withSej.synergy - without.synergy).toBe(Math.round(4 * smoothed));
    expect(withSej.reasons).toContainEqual({ sign: '+', code: 'DUO', ally: 'Sejuani', delta: smoothed });
    expect(withSej.allyTeam).toEqual([{ ally: 'Sejuani', role: 'Jungle', weight: 0.5, raw: 2.5, games: 1800, prior: null, delta: smoothed }]);
    expect(withSej.expected!.duos).toBeCloseTo(0.5 * smoothed);
    expect(without.allyTeam).toEqual([]);
  });
});
