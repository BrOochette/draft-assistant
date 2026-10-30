import { describe, expect, it } from 'vitest';
import { emptySlots, type Build, type BuildCatalog, type Candidate, type Champion, type Damage, type RoleSlots, type StatsSnapshot, type Trait } from '@draft/schemas';
import { createEngineData, proposeBuild } from '../src';

// Akali Top (mêlée, AP) : build général à plusieurs options, et des ennemis typés (dégâts, frontline, distance).
const champ = (name: string, damage: Damage, provides: Trait[] = []): Champion => ({ name, damage, provides, scaling: [3, 3, 3], roles: ['Top'], ddragonId: name });
const build: Build = {
  runes: [
    { primary: [8112, 8143, 8140, 8106], secondary: [8451, 8444], shards: [5008, 5008, 5001], winRate: 51.2, games: 28000 },
    { primary: [8010, 9111, 9105, 8299], secondary: [8444, 8451], shards: [5008, 5008, 5001], winRate: 53.1, games: 900 }
  ],
  spells: [[[4, 14], 51.2, 31000], [[4, 12], 49.8, 3400]],
  starts: [[[1056, 2003, 2003], 50.6, 25000], [[1054, 2003], 51.9, 8300]],
  boots: [[3020, 51.8, 29000], [3111, 50.2, 2800], [3047, 50.7, 1900]],
  core: { items: [3146, 3020, 4645], winRate: 52.9, games: 10000 },
  sets: [],
  runeStats: [[8112, 52, 20000], [8143, 51, 15000], [8010, 53, 5000]],
  // 1er objet : Pistolame ou Flamme-ombre ; 2e : bottes surtout ; 3e : Flamme-ombre, Zhonya, Onde orageuse.
  slots: [
    [[3146, 51.3, 25000], [4645, 52.1, 4000]],
    [[3020, 52, 20000], [4645, 53, 6000], [3157, 54.2, 2000]],
    [[4645, 53.5, 9000], [3157, 55, 4000], [4646, 54, 1500], [3135, 56, 900]]
  ],
  items: [[3146, 51.3, 30000], [4645, 52.7, 24000], [3157, 54, 12900], [4646, 52.4, 8100], [3135, 51.4, 3300], [3165, 50, 2000], [3102, 55.5, 1000]]
};
const catalog: BuildCatalog = {
  version: '16.21.1',
  items: {
    3020: { name: 'Chaussures du sorcier', tags: ['boots'] },
    3111: { name: 'Sandales de Mercure', tags: ['boots', 'mr'] },
    3047: { name: 'Coques en acier', tags: ['boots', 'armor'] },
    3146: { name: 'Pistolame Hextech', tags: [] },
    4645: { name: 'Flamme-ombre', tags: ['antitank'] },
    3157: { name: 'Sablier de Zhonya', tags: ['armor'] },
    4646: { name: 'Onde orageuse', tags: ['antitank'] },
    3135: { name: 'Bâton du vide', tags: ['antitank'] },
    3165: { name: 'Morellonomicon', tags: ['antiheal'] },
    3102: { name: 'Voile de la banshee', tags: ['mr'] }
  },
  runes: { 8112: { name: 'Électrocution', tree: 8100, keystone: true }, 8143: { name: 'Impact soudain', tree: 8100 }, 8010: { name: 'Conquérant', tree: 8000, keystone: true } },
  trees: {},
  shardRows: [],
  spells: {},
  ranged: ['Vayne', 'Lux', 'Syndra']
};
const cand = (extra: Partial<Candidate> = {}): Candidate => ({
  name: 'Akali', games: 30000, synergyBase: 55, laneWinRate: null, gameWinRate: 50, scaling: [3, 3, 3], provides: [], damage: 'AP', notes: [], laneShare: 90, build, ...extra
});
const snapshot = (c: Candidate): StatsSnapshot => ({
  version: 1,
  source: 'lolalytics',
  patch: '16.21',
  rank: 'Emerald+',
  ddragonVersion: '16.21.1',
  champions: [
    champ('Akali', 'AP'), champ('Vayne', 'AD'), champ('Garen', 'AD', ['Frontline']), champ('Lux', 'AP'), champ('Syndra', 'AP'),
    champ('Ornn', 'TANK', ['Frontline']), champ('Sion', 'TANK', ['Frontline']), champ('Soraka', 'AP'), champ('Draven', 'AD'), champ('Zed', 'AD')
  ],
  candidates: { Top: [c] },
  matchupNotes: { matchups: {}, fixedInfo: {} },
  banSuggestions: []
});
const data = createEngineData(snapshot(cand()));
const slots = (s: Partial<RoleSlots>): RoleSlots => ({ ...emptySlots(), ...s });
const propose = (enemies: Partial<RoleSlots>, allies: Partial<RoleSlots> = {}) =>
  proposeBuild({ champion: 'Akali', role: 'Top', allies: slots({ Top: 'Akali', ...allies }), enemies: slots(enemies) }, data, catalog)!;

describe('build proposé', () => {
  it('sans ennemi connu : runes, sorts, départ et bottes les plus joués, objets principaux sans les bottes', () => {
    const b = propose({});
    expect(b.runes.map((p) => p.primary[0])).toEqual([8112, 8010]);
    expect(b.keystones).toEqual([{ value: 8112, winRate: 52, games: 20000 }, { value: 8010, winRate: 53, games: 5000 }]);
    expect(b.spells).toEqual({ value: [4, 14], winRate: 51.2, games: 31000, reason: null, alternatives: [{ value: [4, 12], winRate: 49.8, games: 3400 }] });
    expect(b.start?.value).toEqual([1056, 2003, 2003]);
    expect(b.boots).toMatchObject({ value: 3020, alternatives: [{ value: 3111 }, { value: 3047 }] });
    expect(b.paths[0]!.core.map((c) => c.item)).toEqual([3146, 4645, 3157]);
    expect(b.paths[0]!.situational).toEqual([]);
  });

  it('objets principaux : stats et autres options du slot où chacun est le plus joué, hors bottes et objets principaux', () => {
    const [first, second, third] = propose({}).paths[0]!.core;
    expect(first).toEqual({ item: 3146, stats: { value: 3146, winRate: 51.3, games: 25000 }, alternatives: [] });
    // Flamme-ombre est le plus joué en 3e objet ; Zhonya est aussi un objet principal : écarté des options.
    expect(second).toEqual({ item: 4645, stats: { value: 4645, winRate: 53.5, games: 9000 }, alternatives: [{ value: 4646, winRate: 54, games: 1500 }, { value: 3135, winRate: 56, games: 900 }] });
    expect(third?.stats).toEqual({ value: 3157, winRate: 55, games: 4000 });
  });

  it('vis-à-vis à distance pour un champion de mêlée : Bouclier de Doran ; vis-à-vis magique : bottes de résistance magique', () => {
    const b = propose({ Top: 'Syndra' });
    expect(b.start).toMatchObject({ value: [1054, 2003], reason: { code: 'RANGED_LANE', champion: 'Syndra' }, alternatives: [{ value: [1056, 2003, 2003] }] });
    expect(b.boots).toMatchObject({ value: 3111, reason: { code: 'MAGIC_LANE', champion: 'Syndra' } });
  });

  it('équipe ennemie physique : bottes et objet d’armure, même contre un vis-à-vis magique', () => {
    const b = propose({ Top: 'Lux', Jungle: 'Zed', ADC: 'Draven', Mid: 'Vayne' });
    expect(b.boots).toMatchObject({ value: 3047, reason: { code: 'PHYSICAL_TEAM', champions: ['Zed', 'Vayne', 'Draven'] } });
    // Zhonya fait déjà partie des objets principaux : pas d'autre objet d'armure dans le build.
    expect(b.paths[0]!.situational).toEqual([]);
  });

  it('soigneurs : anti-soins ; frontline : pénétration ; dégâts magiques majoritaires : résistance magique', () => {
    const b = propose({ Top: 'Ornn', Jungle: 'Sion', Mid: 'Lux', ADC: 'Syndra', Support: 'Soraka' });
    expect(b.paths[0]!.situational).toEqual([
      { items: [3165], reason: { code: 'HEALERS', champions: ['Soraka'] } },
      { items: [3102], reason: { code: 'MAGIC_TEAM', champions: ['Lux', 'Syndra', 'Soraka'] } }
      // Pénétration : Flamme-ombre est déjà parmi les objets principaux.
    ]);
  });

  it('frontline ennemie sans objet anti-tank dans les objets principaux : objet de pénétration', () => {
    const items: Build['items'] = [[3146, 51.3, 30000], [3157, 54, 12900], [3102, 55.5, 1000], [4646, 52.4, 8100]];
    const local = createEngineData(snapshot(cand({ build: { ...build, core: { items: [3146, 3020, 3157], winRate: 52, games: 9000 }, items } })));
    const b = proposeBuild({ champion: 'Akali', role: 'Top', allies: slots({ Top: 'Akali' }), enemies: slots({ Top: 'Garen', Jungle: 'Sion' }) }, local, catalog)!;
    expect(b.paths[0]!.core.map((c) => c.item)).toEqual([3146, 3157, 3102]);
    expect(b.paths[0]!.situational).toEqual([{ items: [4646], reason: { code: 'TANKS', champions: ['Garen', 'Sion'] } }]);
  });

  it('sans build connu : null', () => {
    const none = createEngineData(snapshot(cand({ build: undefined })));
    expect(proposeBuild({ champion: 'Akali', role: 'Top', allies: emptySlots(), enemies: emptySlots() }, none, catalog)).toBeNull();
  });
});

describe('builds par style', () => {
  // Xin Zhao Jungle : bruiser surtout, AP et tank plus rares, critique trop rare pour être proposé.
  const styled: BuildCatalog = {
    ...catalog,
    items: {
      3047: { name: 'Coques en acier', tags: ['boots', 'armor'] },
      3071: { name: 'Couperet noir', tags: ['antitank'], style: 'bruiser' },
      3053: { name: 'Gage de Sterak', tags: [], style: 'bruiser' },
      6333: { name: 'Danse de la mort', tags: ['armor'], style: 'ad' },
      3115: { name: 'Dent de Nashor', tags: [], style: 'ap' },
      3124: { name: 'Lame enragée de Guinsoo', tags: [], style: 'onhit' },
      4645: { name: 'Flamme-ombre', tags: ['antitank'], style: 'ap' },
      3068: { name: 'Égide solaire', tags: ['armor'], style: 'tank' },
      3075: { name: 'Cotte épineuse', tags: ['armor', 'antiheal'], style: 'tank' },
      6609: { name: 'Épée dentelée chimico-punk', tags: ['antiheal'], style: 'bruiser' },
      3165: { name: 'Morellonomicon', tags: ['antiheal'], style: 'ap' },
      3031: { name: "Lame d'infini", tags: [], style: 'crit' }
    }
  };
  const xin: Build = {
    ...build,
    core: { items: [3071, 3047, 3053], winRate: 52, games: 9000 },
    slots: [
      [[3071, 51, 40000], [3115, 51.5, 4000], [3068, 47, 1300], [3031, 50, 300]],
      [[3047, 51, 20000], [3053, 52, 9000], [4645, 53, 2000]],
      [[6333, 55, 8000], [3053, 54, 6000], [4645, 56, 1500]],
      [[6333, 58, 5000], [3075, 59, 900], [3165, 57, 400]],
      [[3075, 60, 800]],
      []
    ],
    sets: [[[3071, 3047, 3053], 52, 9000], [[3115, 3047, 4645], 53, 900], [[3068, 3047, 3075], 48, 300]],
    items: [[3071, 51, 40000], [3053, 53, 20000], [6333, 55, 15000], [6609, 52, 5000], [3115, 51.5, 4000], [4645, 54, 3000], [3068, 47, 1300], [3075, 48, 1000], [3165, 50, 500]]
  };
  const local = createEngineData(snapshot(cand({ build: xin })));
  const b = proposeBuild({ champion: 'Akali', role: 'Top', allies: slots({ Top: 'Akali' }), enemies: slots({ Support: 'Soraka' }) }, local, styled)!;

  it('un build par style assez joué (1er objet), le plus joué d’abord, avec parties et win rate cumulés', () => {
    expect(b.paths.map((p) => [p.style, p.games])).toEqual([['bruiser', 40000], ['ap', 4000], ['tank', 1300]]);
    expect(b.paths[0]!.winRate).toBeCloseTo(51);
  });

  it('objets principaux : le trio le plus joué qui commence par ce style, sans les bottes, complété dans le style', () => {
    expect(b.paths.map((p) => p.core.map((c) => c.item))).toEqual([[3071, 3053, 6333], [3115, 4645, 3165], [3068, 3075, 3071]]);
  });

  it('4e au 6e objets : options du style, hors objets principaux', () => {
    expect(b.paths[0]!.later.map((l) => l.map((o) => o.value))).toEqual([[3075], [3075], []]);
    expect(b.paths[1]!.later.map((l) => l.map((o) => o.value))).toEqual([[], [], []]);
  });

  it('situationnels du style : anti-soins bruiser pour le bruiser, AP pour l’AP ; le tank l’a déjà (Cotte épineuse)', () => {
    expect(b.paths.map((p) => p.situational.map((s) => s.items[0]))).toEqual([[6609], [], []]);
  });
});
