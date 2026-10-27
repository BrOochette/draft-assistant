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
  runes: {},
  trees: {},
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
    expect(b.spells).toEqual({ value: [4, 14], winRate: 51.2, games: 31000, reason: null, alternatives: [{ value: [4, 12], winRate: 49.8, games: 3400 }] });
    expect(b.start?.value).toEqual([1056, 2003, 2003]);
    expect(b.boots).toMatchObject({ value: 3020, alternatives: [{ value: 3111 }, { value: 3047 }] });
    expect(b.core.map((c) => c.item)).toEqual([3146, 4645, 3157]);
    expect(b.situational).toEqual([]);
  });

  it('objets principaux : stats et autres options du slot où chacun est le plus joué, hors bottes et objets principaux', () => {
    const [first, second, third] = propose({}).core;
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
    expect(b.situational).toEqual([]);
  });

  it('soigneurs : anti-soins ; frontline : pénétration ; dégâts magiques majoritaires : résistance magique', () => {
    const b = propose({ Top: 'Ornn', Jungle: 'Sion', Mid: 'Lux', ADC: 'Syndra', Support: 'Soraka' });
    expect(b.situational).toEqual([
      { items: [3165], reason: { code: 'HEALERS', champions: ['Soraka'] } },
      { items: [3102], reason: { code: 'MAGIC_TEAM', champions: ['Lux', 'Syndra', 'Soraka'] } }
      // Pénétration : Flamme-ombre est déjà parmi les objets principaux.
    ]);
  });

  it('frontline ennemie sans objet anti-tank dans les objets principaux : objet de pénétration', () => {
    const items: Build['items'] = [[3146, 51.3, 30000], [3157, 54, 12900], [3102, 55.5, 1000], [4646, 52.4, 8100]];
    const local = createEngineData(snapshot(cand({ build: { ...build, core: { items: [3146, 3020, 3157], winRate: 52, games: 9000 }, items } })));
    const b = proposeBuild({ champion: 'Akali', role: 'Top', allies: slots({ Top: 'Akali' }), enemies: slots({ Top: 'Garen', Jungle: 'Sion' }) }, local, catalog)!;
    expect(b.core.map((c) => c.item)).toEqual([3146, 3157, 3102]);
    expect(b.situational).toEqual([{ items: [4646], reason: { code: 'TANKS', champions: ['Garen', 'Sion'] } }]);
  });

  it('sans build connu : null', () => {
    const none = createEngineData(snapshot(cand({ build: undefined })));
    expect(proposeBuild({ champion: 'Akali', role: 'Top', allies: emptySlots(), enemies: emptySlots() }, none, catalog)).toBeNull();
  });
});
