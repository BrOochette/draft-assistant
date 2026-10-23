import { describe, expect, it } from 'vitest';
import { parseLuaTable } from '../src/lua';
import { parseBuildPage, parseTeam } from '../src/lolalytics';
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
      duos: {}
    });
  });

  it('extrait les duos par rôle de l’allié', () => {
    const json = JSON.stringify({ team: { jungle: [[64, 54, 1.2, 2.1, 3, 900], [238, 50, 0, 0, 1, 10]], bottom: [] } });
    expect(parseTeam(json, names)).toEqual({ Jungle: { 'Lee Sin': [2.1, 900] }, ADC: {} });
  });
});
