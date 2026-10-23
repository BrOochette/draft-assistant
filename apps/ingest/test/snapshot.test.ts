import { describe, expect, it } from 'vitest';
import type { ChampionAttributes } from '@draft/schemas';
import type { LaneStats, LolalyticsDump } from '../src/lolalytics';
import { assembleLolalyticsSnapshot, measuredScaling } from '../src/snapshot';

const attr = (name: string, key: number, extra: Partial<ChampionAttributes> = {}): ChampionAttributes => ({
  name,
  key,
  ddragonId: name,
  damage: 'AP',
  provides: [],
  roles: ['Mid'],
  classes: [],
  ...extra
});

/** Stats d'une lane : win rate global et win rate par phase (0-15, 15-25, 25+) sur beaucoup de parties. */
const lane = (winRate: number, phases: [number, number, number], extra: Partial<LaneStats> = {}): LaneStats => {
  const g = 100000;
  return {
    games: 3 * g,
    winRate,
    laneShare: 90,
    damage: { physical: 100, magic: 900 },
    byDuration: {
      1: [g, (g * phases[0]) / 100],
      2: [g / 2, (g / 2) * (phases[1] / 100)],
      3: [g / 2, (g / 2) * (phases[1] / 100)],
      4: [g, (g * phases[2]) / 100]
    },
    matchups: {},
    duos: {},
    ...extra
  };
};

describe('scaling mesuré', () => {
  it('classe chaque phase par rapport aux autres champions', () => {
    const early = lane(50, [56, 50, 44]);
    const late = lane(50, [44, 50, 56]);
    const flat = lane(50, [50, 50, 50]);
    const s = measuredScaling([early, late, flat]);
    expect(s.get(early)).toEqual([4, 3, 2]);
    expect(s.get(late)).toEqual([2, 3, 4]);
    expect(s.get(flat)).toEqual([3, 3, 3]);
  });
});

describe('assemblage du snapshot Lolalytics', () => {
  const dump: LolalyticsDump = {
    source: 'lolalytics',
    patch: '16.21',
    tier: 'emerald_plus',
    fetchedAt: '2026-10-23T00:00:00Z',
    champions: {
      Ahri: { Mid: lane(52.7, [50, 52, 53], { matchups: { Zed: [50.6, 2017] }, duos: { Jungle: { Sejuani: [2.1, 900] } } }) },
      "Kai'Sa": {
        ADC: lane(50.5, [48, 50, 52], { damage: { physical: 900, magic: 300 } }),
        Mid: lane(49, [50, 50, 50], { laneShare: 2 })
      },
      Sejuani: { Jungle: lane(51, [50, 51, 51], { damage: { physical: 100, magic: 900 } }) }
    }
  };
  const attributes = [
    attr('Ahri', 103),
    attr("Kai'Sa", 145, { roles: ['ADC'], damage: 'AP' }),
    attr('Sejuani', 113, { roles: ['Jungle'], damage: 'TANK', provides: ['Frontline', 'Engage'] }),
    attr('Locke', 999)
  ];
  const snap = assembleLolalyticsSnapshot(attributes, { Ahri: { provides: ['Peel'] } }, dump, '16.21.1');

  it('crée les candidats par lane, sans win rate de lane, avec matchups et duos', () => {
    expect(snap.source).toBe('lolalytics');
    expect(snap.candidates.Mid?.map((c) => c.name)).toEqual(['Ahri']);
    const ahri = snap.candidates.Mid![0]!;
    expect(ahri).toMatchObject({ laneWinRate: null, gameWinRate: 52.7, synergyBase: 55, provides: ['Peel'] });
    expect(ahri.matchups).toEqual({ Zed: [50.6, 2017] });
    expect(ahri.duos).toEqual({ Jungle: { Sejuani: [2.1, 900] } });
  });

  it('mesure le type de dégâts, sauf pour un tank', () => {
    const kaisa = snap.candidates.ADC![0]!;
    expect(kaisa.damage).toBe('AD');
    expect(kaisa.provides).toEqual(['Physique']);
    expect(snap.candidates.Jungle![0]!.damage).toBe('TANK');
  });

  it("garde au catalogue un champion sans stats et ignore une lane trop peu jouée", () => {
    expect(snap.champions.find((c) => c.name === 'Locke')).toMatchObject({ scaling: [3, 3, 3], roles: ['Mid'] });
    expect(snap.candidates.Mid?.some((c) => c.name === "Kai'Sa")).toBe(false);
  });

  it('propose les meilleurs win rates de chaque rôle en bans', () => {
    expect(snap.banSuggestions.map((b) => [b.champion, b.role, b.threat])).toEqual([
      ['Sejuani', 'Jungle', 60],
      ['Ahri', 'Mid', 77],
      ["Kai'Sa", 'ADC', 55]
    ]);
  });
});
