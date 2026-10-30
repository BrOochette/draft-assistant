import { ROLES, type Build, type BuildCatalog, type ItemStyle, type ItemTag, type Role, type RoleSlots } from '@draft/schemas';
import type { EngineData } from './stats-provider';

// Build proposé pour un pick : le build général du champion sur son rôle (Lolalytics), adapté par règles au vis-à-vis
// et aux deux compos. Le moteur ne choisit que parmi les options réellement jouées sur ce champion.

/** Champions aux soins ou au vol de vie marquants : un objet anti-soins est proposé contre eux. */
export const HEALERS: ReadonlySet<string> = new Set([
  'Aatrox', "Bel'Veth", 'Briar', 'Dr. Mundo', 'Fiddlesticks', 'Fiora', 'Gwen', 'Illaoi', 'Kayn', 'Maokai', 'Milio', 'Nami',
  'Nidalee', 'Olaf', 'Samira', 'Senna', 'Seraphine', 'Sona', 'Soraka', 'Swain', 'Sylas', 'Taric', 'Trundle', 'Viego',
  'Vladimir', 'Volibear', 'Warwick', 'Yuumi', 'Zac'
]);
/** Dégâts d'un type majoritaires chez l'ennemi à partir de ce nombre de champions (et plus que l'autre type). */
export const HEAVY_DAMAGE = 2;
/** Objet contre les tanks à partir de ce nombre de tanks ou de frontline ennemis. */
export const TANKS_MIN = 2;
/** Objet de pénétration quand ton équipe a au moins ce nombre de picks du même type de dégâts que toi (toi compris). */
export const SAME_DAMAGE_MIN = 3;
/** Objets situationnels proposés au plus (règles appliquées). */
export const SITUATIONAL_MAX = 3;
/** Autres options affichées par choix (sorts, départ, bottes, objet principal, objet situationnel). */
export const ALTERNATIVES_MAX = 2;
/** Style de build proposé à partir de cette part des parties (1er objet) et de ce nombre de parties ; au plus PATHS_MAX. */
export const PATH_MIN_SHARE = 0.02;
export const PATH_MIN_GAMES = 500;
export const PATHS_MAX = 3;
/** Styles d'objets gardés dans le build d'un style (objets principaux complétés, options, situationnels). */
const COMPATIBLE: Record<ItemStyle, ItemStyle[]> = {
  ap: ['ap'],
  crit: ['crit', 'ad', 'onhit'],
  onhit: ['onhit', 'ad', 'crit'],
  lethality: ['lethality', 'ad'],
  bruiser: ['bruiser', 'ad', 'tank'],
  tank: ['tank', 'bruiser'],
  ad: ['ad', 'bruiser', 'lethality', 'crit'],
  support: ['support', 'tank', 'ap']
};
/** Runes principales (keystones) proposées au plus, et options gardées par objet du 4e au 6e. */
export const KEYSTONES_MAX = 3;
export const LATE_OPTIONS_MAX = 3;
/** Lanes en 1 contre 1 : le départ et les bottes y suivent le vis-à-vis. */
const SOLO_LANES: ReadonlySet<Role> = new Set(['Top', 'Mid']);
/** Bouclier de Doran : départ contre un vis-à-vis à distance. */
const DORAN_SHIELD = 1054;

export type BuildReason =
  | { code: 'MAGIC_TEAM'; champions: string[] }
  | { code: 'PHYSICAL_TEAM'; champions: string[] }
  | { code: 'MAGIC_LANE'; champion: string }
  | { code: 'PHYSICAL_LANE'; champion: string }
  | { code: 'RANGED_LANE'; champion: string }
  | { code: 'HEALERS'; champions: string[] }
  | { code: 'TANKS'; champions: string[] }
  | { code: 'SAME_DAMAGE'; damage: 'AP' | 'AD'; champions: string[] };

/** Option jouée sur ce champion, avec son win rate et ses parties. */
export interface BuildOption<T> {
  value: T;
  winRate: number;
  games: number;
}

/**
 * Option retenue ; `reason` : règle qui l'a choisie plutôt que la plus jouée. `alternatives` : les autres options
 * les plus jouées (au plus ALTERNATIVES_MAX).
 */
export interface BuildChoice<T> extends BuildOption<T> {
  reason: BuildReason | null;
  alternatives: BuildOption<T>[];
}

export interface BuildProposal {
  champion: string;
  role: Role;
  /** Pages de runes : la plus jouée, puis celle au meilleur win rate si elle diffère. */
  runes: Build['runes'];
  /** Runes principales jouées (keystones), la plus jouée d'abord, avec leur win rate et leurs parties. */
  keystones: BuildOption<number>[];
  spells: BuildChoice<number[]> | null;
  start: BuildChoice<number[]> | null;
  boots: BuildChoice<number> | null;
  /** Builds par style joué (Bruiser, AP, Tank…), le plus joué d'abord ; un seul, sans style, faute de données. */
  paths: BuildPath[];
}

/** Build d'un style : parties et win rate du style (1er objet), objets principaux et situationnels de ce style. */
export interface BuildPath {
  style: ItemStyle | null;
  winRate: number | null;
  games: number | null;
  /**
   * Trois objets principaux : le trio le plus joué qui commence par ce style, hors bottes, complété par les objets les
   * plus construits du style. Pour chacun, ses stats et les autres options de son slot (1er, 2e ou 3e objet).
   */
  core: { item: number; stats: BuildOption<number> | null; alternatives: BuildOption<number>[] }[];
  /** Options du 4e, du 5e et du 6e objet dans ce style, hors bottes et objets principaux, les plus jouées d'abord. */
  later: BuildOption<number>[][];
  /** Objets situationnels : le plus construit de chaque règle, puis les autres (sans win rate : biaisé par la durée). */
  situational: { items: number[]; reason: BuildReason }[];
}

export interface BuildInput {
  champion: string;
  role: Role;
  /** Picks de ton équipe (le champion compris ou non). */
  allies: RoleSlots;
  enemies: RoleSlots;
}

/**
 * Build proposé pour `champion` sur `role`, null sans build connu (données d'exemple, collecte antérieure). Règles :
 * - runes : la page la plus jouée et celle au meilleur win rate ; sorts : les plus joués ;
 * - départ : le plus joué, Bouclier de Doran contre un vis-à-vis à distance pour un champion de mêlée (Top, Mid) ;
 * - bottes : résistance magique ou armure contre une équipe ennemie majoritairement magique ou physique, sinon selon
 *   le vis-à-vis (Top, Mid), sinon les plus jouées ;
 * - situationnels : anti-soins contre des soigneurs, résistance contre des dégâts majoritaires, pénétration contre la
 *   frontline ennemie ou quand ton équipe a surtout ton type de dégâts. Chaque objet vient du build du champion.
 * Un build par style joué (d'après le 1er objet) : objets principaux et situationnels de ce style.
 * Chaque choix garde les autres options les plus jouées.
 */
export const proposeBuild = (input: BuildInput, data: EngineData, catalog: BuildCatalog): BuildProposal | null => {
  const { champion, role } = input;
  const build = data.stats.getRoleStats(champion, role).build;
  if (!build) return null;
  const has = (id: number, tag: ItemTag) => catalog.items[id]?.tags.includes(tag) ?? false;
  const info = (name: string) => data.catalog.get(name);
  const ranged = new Set(catalog.ranged);
  const isRanged = (name: string) => ranged.has(info(name)?.ddragonId ?? '');

  const enemies = ROLES.flatMap((r) => input.enemies[r] ?? []);
  const allies = [...new Set([champion, ...ROLES.flatMap((r) => input.allies[r] ?? [])])];
  const magic = enemies.filter((n) => info(n)?.damage === 'AP');
  const physical = enemies.filter((n) => info(n)?.damage === 'AD');
  const magicTeam = magic.length >= HEAVY_DAMAGE && magic.length > physical.length;
  const physicalTeam = physical.length >= HEAVY_DAMAGE && physical.length > magic.length;
  const opponent = SOLO_LANES.has(role) ? input.enemies[role] : null;

  const option = <T>(o: [T, number, number]): BuildOption<T> => ({ value: o[0], winRate: o[1], games: o[2] });
  const pick = <T>(options: [T, number, number][], prefer?: (v: T) => boolean, reason?: BuildReason | null): BuildChoice<T> | null => {
    const found = prefer && reason ? options.find(([v]) => prefer(v)) : undefined;
    const o = found ?? options[0];
    if (!o) return null;
    return { ...option(o), reason: found ? reason! : null, alternatives: options.filter((x) => x !== o).slice(0, ALTERNATIVES_MAX).map(option) };
  };

  const start = opponent && !isRanged(champion) && isRanged(opponent)
    ? pick(build.starts, (ids) => ids.includes(DORAN_SHIELD), { code: 'RANGED_LANE', champion: opponent })
    : pick(build.starts);

  const oppDamage = opponent ? info(opponent)?.damage : undefined;
  const bootsRule: [ItemTag, BuildReason] | null = magicTeam
    ? ['mr', { code: 'MAGIC_TEAM', champions: magic }]
    : physicalTeam
      ? ['armor', { code: 'PHYSICAL_TEAM', champions: physical }]
      : opponent && oppDamage === 'AP'
        ? ['mr', { code: 'MAGIC_LANE', champion: opponent }]
        : opponent && oppDamage === 'AD'
          ? ['armor', { code: 'PHYSICAL_LANE', champion: opponent }]
          : null;
  const boots = bootsRule ? pick(build.boots, (id) => has(id, bootsRule[0]), bootsRule[1]) : pick(build.boots);

  const rules: [ItemTag, BuildReason][] = [];
  const healers = enemies.filter((n) => HEALERS.has(n));
  if (healers.length) rules.push(['antiheal', { code: 'HEALERS', champions: healers }]);
  if (magicTeam) rules.push(['mr', { code: 'MAGIC_TEAM', champions: magic }]);
  if (physicalTeam) rules.push(['armor', { code: 'PHYSICAL_TEAM', champions: physical }]);
  const tanks = enemies.filter((n) => info(n)?.damage === 'TANK' || info(n)?.provides.includes('Frontline'));
  const own = info(champion)?.damage;
  const same = own === 'AP' || own === 'AD' ? allies.filter((n) => info(n)?.damage === own) : [];
  const sameReason = own === 'AP' || own === 'AD' ? { code: 'SAME_DAMAGE' as const, damage: own, champions: same } : null;
  if (tanks.length >= TANKS_MIN) rules.push(['antitank', { code: 'TANKS', champions: tanks }]);
  else if (sameReason && same.length >= SAME_DAMAGE_MIN) rules.push(['antitank', sameReason]);

  const styleOf = (id: number) => catalog.items[id]?.style;
  const notBoots = (id: number) => !has(id, 'boots');
  const slots = build.slots.map((list) => list.filter(([id]) => notBoots(id)));

  /** Objets principaux et situationnels d'un style ; null : le build général, sans filtre de style. */
  const pathOf = (style: ItemStyle | null, main: boolean): Pick<BuildPath, 'core' | 'later' | 'situational'> => {
    const fits = (id: number) => style == null || COMPATIBLE[style].includes(styleOf(id) as ItemStyle);
    // Trio le plus joué dont le premier objet (hors bottes) est de ce style ; le build général : les trois premiers
    // objets les plus joués ensemble.
    const set = style == null ? undefined : build.sets.find(([ids]) => styleOf(ids.find(notBoots) ?? 0) === style);
    const core = (set ? set[0] : main ? build.core?.items ?? [] : []).filter(notBoots);
    const fill = [...(style ? (slots[0] ?? []).filter(([id]) => styleOf(id) === style) : []), ...build.items];
    for (const [id] of fill) if (core.length < 3 && !core.includes(id) && notBoots(id) && fits(id)) core.push(id);

    const used = new Set(core);
    const situational: BuildPath['situational'] = [];
    for (const [tag, reason] of rules) {
      if (situational.length >= SITUATIONAL_MAX) break;
      // Un seul objet anti-soins ou anti-tank suffit : déjà parmi les objets principaux, pas de doublon.
      if ((tag === 'antiheal' || tag === 'antitank') && core.some((id) => has(id, tag))) continue;
      const found = build.items.filter(([id]) => !used.has(id) && has(id, tag) && fits(id)).slice(0, 1 + ALTERNATIVES_MAX).map(([id]) => id);
      if (!found.length) continue;
      used.add(found[0]!);
      situational.push({ items: found, reason });
    }

    // Slot de chaque objet principal : celui où il est le plus joué ; ses autres options du même style, hors objets principaux.
    return {
      core: core.slice(0, 3).map((item) => {
        const slot = slots
          .slice(0, 3)
          .map((list) => ({ list, at: list.find(([id]) => id === item) }))
          .filter((s) => s.at)
          .sort((a, b) => b.at![2] - a.at![2])[0];
        return {
          item,
          stats: slot ? option(slot.at!) : null,
          alternatives: slot ? slot.list.filter(([id]) => !core.includes(id) && fits(id)).slice(0, ALTERNATIVES_MAX).map(option) : []
        };
      }),
      later: slots.slice(3, 6).map((list) => list.filter(([id]) => !core.includes(id) && fits(id)).slice(0, LATE_OPTIONS_MAX).map(option)),
      situational
    };
  };

  // Styles joués d'après le 1er objet (parties et win rate cumulés), les plus joués d'abord.
  const byStyle = new Map<ItemStyle, { games: number; wins: number }>();
  for (const [id, wr, games] of slots[0] ?? []) {
    const s = styleOf(id);
    if (!s) continue;
    const g = byStyle.get(s) ?? { games: 0, wins: 0 };
    byStyle.set(s, { games: g.games + games, wins: g.wins + (wr * games) / 100 });
  }
  const total = [...byStyle.values()].reduce((n, g) => n + g.games, 0);
  const styles = [...byStyle.entries()]
    .filter(([, g]) => g.games >= PATH_MIN_GAMES && g.games >= total * PATH_MIN_SHARE)
    .sort((a, b) => b[1].games - a[1].games)
    .slice(0, PATHS_MAX);
  const paths: BuildPath[] = styles.length
    ? styles.map(([style, g], i) => ({ style, winRate: (100 * g.wins) / g.games, games: g.games, ...pathOf(style, i === 0) }))
    : [{ style: null, winRate: null, games: null, ...pathOf(null, true) }];

  return {
    champion,
    role,
    runes: build.runes,
    keystones: build.runeStats.filter(([id]) => catalog.runes[id]?.keystone).slice(0, KEYSTONES_MAX).map(option),
    spells: pick(build.spells),
    start,
    boots,
    paths
  };
};
