import { describe, expect, it } from 'vitest';
import { parseLuaTable } from '../src/lua';
import { itemTags } from '../src/build-catalog';
import { parseBuild, parseBuildPage, parseTeam } from '../src/lolalytics';
import { readQwikState } from '../src/qwik';
import { deriveAttributes, importWikiAttributes } from '../src/wiki';

const LUA = `-- <pre>
return {
  ["Leona"] = {
    ["id"]         = 89,
    ["apiname"]    = "Leona",
    ["stats"] = { ["hp_base"] = 1000+1000/20, ["arm_lvl"] = -0.5 },
    ["role"]        = {"Vanguard"},
    ["client_tags"] = {"Initiator", "Crowd Control"},
    ["client_positions"] = {"Support"},
    ["external_positions"] = {"Support"},
    ["toughness"]   = 3,
    ["damage"]      = 1,
    ["adaptivetype"]= "Physical",
    ["skills"] = { [1] = "Sunlight", [2] = "Shield of Daybreak" },
  },
  ["Lulu"] = {
    ["id"] = 117, ["apiname"] = "Lulu", ["role"] = {"Enchanter"},
    ["client_tags"] = {"Ally Protection"}, ["client_positions"] = {"Support"},
    ["toughness"] = 1, ["damage"] = 2, ["adaptivetype"] = "Magic",
  },
  ["Mega Gnar"] = { ["id"] = 150.2, ["apiname"] = "GnarBig", ["client_positions"] = {"Top"} },
}
-- </pre>`;

describe('lecteur Lua', () => {
  it('lit tables, tableaux, nombres calculés et commentaires', () => {
    const t = parseLuaTable(LUA) as any;
    expect(t.Leona.stats.hp_base).toBe(1050);
    expect(t.Leona.stats.arm_lvl).toBe(-0.5);
    expect(t.Leona.role).toEqual(['Vanguard']);
    expect(t.Leona.skills).toEqual(['Sunlight', 'Shield of Daybreak']);
  });
});

describe('attributs depuis le wiki', () => {
  it('déduit dégâts, apports et rôles', async () => {
    const { champions, skipped } = await importWikiAttributes(async () => LUA);
    expect(skipped).toEqual(['Mega Gnar']);
    expect(champions).toEqual([
      { name: 'Leona', key: 89, ddragonId: 'Leona', damage: 'TANK', provides: ['Frontline', 'Engage'], roles: ['Support'], classes: ['Vanguard'] },
      { name: 'Lulu', key: 117, ddragonId: 'Lulu', damage: 'AP', provides: ['Peel'], roles: ['Support'], classes: ['Enchanter'] }
    ]);
  });

  it('ignore un champion sans position', () => {
    expect(deriveAttributes('X', { id: 1, apiname: 'X' })).toBeNull();
  });
});

/** Sérialise des racines au format Qwik : chaque valeur non numérique devient une entrée référencée en base 36. */
const qwikHtml = (...roots: object[]) => {
  const objs: unknown[] = [];
  const add = (v: unknown): unknown => {
    if (typeof v === 'number' || typeof v === 'boolean' || v === null) return v;
    const i = objs.length;
    objs.push(null);
    objs[i] = Array.isArray(v) ? v.map(add) : typeof v === 'object' ? Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, add(x)])) : v;
    return i.toString(36);
  };
  roots.forEach(add);
  return `<html><script type="qwik/json">${JSON.stringify({ refs: {}, ctx: {}, objs, subs: [] })}</script></html>`;
};

const names = new Map([[103, 'Ahri'], [238, 'Zed'], [64, 'Lee Sin']]);
const page = qwikHtml(
  { page: 'build', api: { build: 'a1' }, patch: '16.21', lane: 'middle' },
  { 1: 'annie', 2: 'olaf', 103: 'ahri', 238: 'zed' },
  { time: { 1: 464, 2: 3618 }, timeWin: { 1: 218, 2: 1864 } },
  { navStats: { lanes: { top: 3, middle: 95, support: 1.1 } } },
  {
    header: { wr: 52.7, n: 47227, lane: 'middle', damage: { physical: 1748, magic: 18313, true: 5425 } },
    enemy: { middle: [[238, 50.57, 1.3, -2.7, 4.3, 2017], [999, 60, 0, 0, 1, 500], [64, 51, 0, 0, 0.1, 12]] }
  }
);

describe('page build Lolalytics', () => {
  it("lit l'état Qwik sans confondre chaînes et références", () => {
    const cfg = readQwikState(page).find((o) => o.page === 'build');
    expect(cfg).toEqual({ page: 'build', api: { build: 'a1' }, patch: '16.21', lane: 'middle' });
  });

  it('extrait stats, durées, lanes et matchups', () => {
    const r = parseBuildPage(page, names);
    expect(r.patch).toBe('16.21');
    expect(r.role).toBe('Mid');
    expect(r.slugs['103']).toBe('ahri');
    expect(r.lanes).toEqual({ top: 3, middle: 95, support: 1.1 });
    expect(r.stats).toEqual({
      games: 47227,
      winRate: 52.7,
      laneShare: 95,
      damage: { physical: 1748, magic: 18313 },
      byDuration: { 1: [464, 218], 2: [3618, 1864] },
      // Clé inconnue (999) et matchup trop rare (Lee Sin, 12 parties) écartés.
      matchups: { Zed: [50.57, 2017] },
      crossMatchups: {},
      duos: {},
      // Page réduite, sans données de build.
      build: { runes: [], spells: [], starts: [], boots: [], slots: [[], [], [], [], [], []], sets: [], runeStats: [], items: [] }
    });
  });

  it('extrait le build général : options assez jouées, bottes à part, objets construits sans doublon', () => {
    const b = parseBuild({
      summary: {
        pick: { runes: { wr: 51.7, n: 65116, set: { pri: [8005, 9111, 9103, 8017], sec: [8321, 8313], mod: [5005, 5008, 5011] } }, items: { core: { set: [6676, 3006, 3031], wr: 52.78, n: 9231 } } },
        win: { runes: { wr: 53.2, n: 4100, set: { pri: [8008, 9111, 9104, 8017], sec: [8345, 8347], mod: [5005, 5008, 5011] } } }
      },
      item1: [[6676, 50.7, 44.5, 37697, 11], [3095, 52.93, 28.84, 24427, 12], [3031, 55.88, 0.52, 442, 13]],
      spells: [['4_21', 51.55, 63.41, 53718], ['4_7', 45.24, 0.25, 210]],
      startSet: [['1086_2003_2003', 51.08, 82.66, 70019], ['', 75, 0.01, 8]],
      boots: [[3006, 50.83, 41.13, 34843, 14], [1001, 34.67, 7.49, 6346, 8], [3111, 49.94, 1.03, 871, 18]],
      popularItem: [[3031, 55.04, 81.19, 68778, 20], [6676, 50.97, 47.46, 40205, 12], [3179, 42.75, 0.33, 276, 11]],
      builtBootSet3: [['6676_3006_3031', 52.78, 10.9, 9231], ['3095_3008_3031', 56.1, 5.81, 4922], ['6676_3047_3031', 54.62, 0.1, 60]],
      runes: { stats: { 8005: [[76.9, 51.7, 65116]], 8008: [[1.2, 48, 900]], 8017: [[93.7, 51.2, 79400], [1.5, 45.4, 1291]], pri: [[50, 50, 10]] } },
      item4: [[3036, 64.57, 8.21, 6951, 28], [3031, 59.43, 2.43, 2058, 28]]
    });
    expect(b).toEqual({
      runes: [
        { primary: [8005, 9111, 9103, 8017], secondary: [8321, 8313], shards: [5005, 5008, 5011], winRate: 51.7, games: 65116 },
        { primary: [8008, 9111, 9104, 8017], secondary: [8345, 8347], shards: [5005, 5008, 5011], winRate: 53.2, games: 4100 }
      ],
      spells: [[[4, 21], 51.55, 53718]],
      starts: [[[1086, 2003, 2003], 51.08, 70019]],
      boots: [[3006, 50.83, 34843]],
      core: { items: [6676, 3006, 3031], winRate: 52.78, games: 9231 },
      slots: [[[6676, 50.7, 37697], [3095, 52.93, 24427]], [], [], [[3036, 64.57, 6951], [3031, 59.43, 2058]], [], []],
      // Trio à moins de 100 parties écarté.
      sets: [[[6676, 3006, 3031], 52.78, 9231], [[3095, 3008, 3031], 56.1, 4922]],
      // Runes à moins de 3 % de pick rate et clés non numériques écartées ; les plus jouées d'abord.
      runeStats: [[8017, 51.2, 79400], [8005, 51.7, 65116]],
      items: [[3031, 55.04, 68778], [6676, 50.97, 40205], [3036, 64.57, 6951]]
    });
  });

  it('étiquette les objets d’après leurs stats et leur description', () => {
    const item = (description: string, stats: Record<string, number> = {}, tags: string[] = []) => ({ name: 'x', description, stats, tags });
    expect(itemTags(item('<stats>+20 résistance magique</stats>', { FlatSpellBlockMod: 20 }, ['Boots']))).toEqual(['boots', 'mr']);
    expect(itemTags(item("leur inflige 40% d'<keyword>Hémorragie</keyword>", { FlatArmorMod: 75 }))).toEqual(['armor', 'antiheal']);
    expect(itemTags(item('+40%  de pénétration magique'))).toEqual(['antitank']);
    expect(itemTags(item("un pourcentage des PV actuels de l'ennemi"))).toEqual(['antitank']);
    expect(itemTags(item('+75 puissance'))).toEqual([]);
  });

  it('extrait les duos par rôle de l’allié', () => {
    const json = JSON.stringify({ team: { jungle: [[64, 54, 1.2, 2.1, 3, 900], [238, 50, 0, 0, 1, 10]], bottom: [] } });
    expect(parseTeam(json, names)).toEqual({ Jungle: { 'Lee Sin': [2.1, 900] }, ADC: {} });
  });
});
