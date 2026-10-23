import {
  ChampionAttributesSchema,
  ROLES,
  type ChampionAttributes,
  type ChampionOverrides,
  type Damage,
  type Role,
  type Trait
} from '@draft/schemas';
import { parseLuaTable, type LuaValue } from './lua';
import type { PoliteFetch } from './http';

export const WIKI_URL = 'https://wiki.leagueoflegends.com/en-us/Module:ChampionData/data?action=raw';

const POSITION: Record<string, Role> = { Top: 'Top', Jungle: 'Jungle', Middle: 'Mid', Bottom: 'ADC', Support: 'Support' };

const strings = (v: LuaValue | undefined): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const num = (v: LuaValue | undefined): number => (typeof v === 'number' ? v : 0);

/**
 * Attributs déduits des données du wiki. Règles (à corriger au besoin dans data/champions-overrides.json) :
 * - TANK : classe Vanguard ou Warden, ou robustesse 3 avec dégâts 1 ; sinon AD ou AP selon le type adaptatif ;
 * - Frontline : Vanguard, Warden, Juggernaut, tag « Durable » ou robustesse 3 ;
 * - Engage : Vanguard, Catcher, Diver ou tag « Initiator » ;
 * - Peel : Warden, Enchanter ou tag « Ally Protection ».
 */
export const deriveAttributes = (name: string, e: { [key: string]: LuaValue }): ChampionAttributes | null => {
  const classes = strings(e.role);
  const tags = strings(e.client_tags);
  const positions = [...strings(e.client_positions), ...strings(e.external_positions)];
  const roles = ROLES.filter((r) => positions.some((p) => POSITION[p] === r));
  const key = num(e.id);
  // Les formes alternatives (Mega Gnar, Kled & Skaarl…) ont un identifiant décimal : ignorées.
  if (!Number.isInteger(key) || key <= 0 || !roles.length || typeof e.apiname !== 'string') return null;
  const has = (...c: string[]) => c.some((x) => classes.includes(x));
  const toughness = num(e.toughness);
  const damage: Damage =
    has('Vanguard', 'Warden') || (toughness >= 3 && num(e.damage) <= 1) ? 'TANK' : e.adaptivetype === 'Physical' ? 'AD' : 'AP';
  const provides: Trait[] = [];
  if (has('Vanguard', 'Warden', 'Juggernaut') || tags.includes('Durable') || toughness >= 3) provides.push('Frontline');
  if (has('Vanguard', 'Catcher', 'Diver') || tags.includes('Initiator')) provides.push('Engage');
  if (has('Warden', 'Enchanter') || tags.includes('Ally Protection')) provides.push('Peel');
  return { name, key, ddragonId: e.apiname, damage, provides, roles, classes };
};

export const applyOverrides = (list: ChampionAttributes[], overrides: ChampionOverrides): ChampionAttributes[] =>
  list.map((c) => {
    const o = overrides[c.name];
    return o ? ChampionAttributesSchema.parse({ ...c, ...o }) : c;
  });

/** Lit le module du wiki et renvoie les attributs de tous les champions, triés par nom. */
export const importWikiAttributes = async (fetchText: PoliteFetch): Promise<{ champions: ChampionAttributes[]; skipped: string[] }> => {
  const root = parseLuaTable(await fetchText(WIKI_URL));
  if (!root || typeof root !== 'object' || Array.isArray(root)) throw new Error('Module du wiki : table racine attendue');
  const champions: ChampionAttributes[] = [];
  const skipped: string[] = [];
  for (const [name, entry] of Object.entries(root)) {
    const a = entry && typeof entry === 'object' && !Array.isArray(entry) ? deriveAttributes(name, entry) : null;
    if (a) champions.push(a);
    else skipped.push(name);
  }
  champions.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  return { champions, skipped };
};
