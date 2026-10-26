import { z } from 'zod';
import { ROLES, type ChampionAttributes, type Role } from '@draft/schemas';
import { CrawlStopped, type PoliteFetch } from './http';
import { readQwikState } from './qwik';

/** Rangs analysés : Emerald et au-dessus, toutes régions, classé solo. */
export const TIER = 'emerald_plus';
/** Région par défaut (code Lolalytics : all, euw, eune, na, kr…). */
export const DEFAULT_REGION = 'all';
/** Région des matchups et duos : plus d'échantillon qu'une seule région, et ils en dépendent peu. */
export const DEFAULT_PAIR_REGION = 'all';
/** Lanes secondaires collectées à partir de cette part des parties du champion (en %). */
export const MIN_LANE_SHARE = 5;
/** Matchups et duos gardés à partir de ce nombre de parties. */
export const MIN_PAIR_GAMES = 30;
/** Matchups contre les autres lanes gardés à partir de ce nombre de parties : peu jouées, ils sont lissés vers leur classe. */
export const MIN_CROSS_GAMES = 30;

const LANE: Record<Role, string> = { Top: 'top', Jungle: 'jungle', Mid: 'middle', ADC: 'bottom', Support: 'support' };
const ROLE_OF: Record<string, Role> = Object.fromEntries(ROLES.map((r) => [LANE[r], r]));

const pair = z.tuple([z.number(), z.number().int()]);
export const LaneStatsSchema = z.object({
  games: z.number().int(),
  winRate: z.number(),
  /** Part des parties du champion jouées sur cette lane, en %. */
  laneShare: z.number(),
  damage: z.object({ physical: z.number(), magic: z.number() }),
  /** Tranche de durée (1 : 0-15 min, 2 : 15-20 … 7 : 40+) vers [parties, victoires]. */
  byDuration: z.record(z.string(), pair),
  /** Adversaire de la même lane vers [win rate de ce champion, parties]. */
  matchups: z.record(z.string(), pair),
  /** Rôle de l'ennemi (autre lane), puis ennemi vers [win rate de ce champion, parties]. */
  crossMatchups: z.record(z.string(), z.record(z.string(), pair)).default({}),
    /** Rôle de l'allié, puis allié vers [écart de win rate normalisé en duo, parties]. */
  duos: z.record(z.string(), z.record(z.string(), pair))
});
export type LaneStats = z.infer<typeof LaneStatsSchema>;

export const LolalyticsDumpSchema = z.object({
  source: z.literal('lolalytics'),
  patch: z.string(),
  tier: z.string(),
  /** Région Lolalytics (« all » : toutes régions). Absente des collectes antérieures : toutes régions. */
  region: z.string().default('all'),
  /** Région des matchups et des duos. Absente des collectes antérieures : la même que `region`. */
  pairRegion: z.string().optional(),
  fetchedAt: z.string(),
  champions: z.record(z.string(), z.record(z.string(), LaneStatsSchema))
});
export type LolalyticsDump = z.infer<typeof LolalyticsDumpSchema>;

type Row = [number, ...number[]];
const rows = (v: unknown): Row[] => (Array.isArray(v) ? (v.filter((r) => Array.isArray(r) && typeof r[0] === 'number') as Row[]) : []);

/** Données d'une page « build » d'un champion sur une lane. */
export const parseBuildPage = (html: string, nameOfKey: ReadonlyMap<number, string>) => {
  const q = readQwikState(html);
  const nav = q.find((o) => o.page === 'build' && o.api !== undefined);
  const time = q.find((o) => o.time !== undefined && o.timeWin !== undefined);
  const navStats = q.find((o) => o.navStats !== undefined)?.navStats as { lanes?: Record<string, number> } | undefined;
  const data = q.find((o) => o.enemy !== undefined && o.header !== undefined);
  const header = data?.header as { [key: string]: unknown } | undefined;
  const slugs = q.find((o) => o['1'] === 'annie' && o['2'] === 'olaf') as Record<string, string> | undefined;
  if (!nav || !data || !header || header.wr === undefined) throw new Error('Page build incomplète');
  const lane = String(header.lane);
  const role = ROLE_OF[lane];
  if (!role) throw new Error('Lane inconnue : ' + lane);

  const byDuration: Record<string, [number, number]> = {};
  const t = (time?.time ?? {}) as Record<string, number>;
  const w = (time?.timeWin ?? {}) as Record<string, number>;
  for (const k of Object.keys(t)) byDuration[k] = [t[k] ?? 0, w[k] ?? 0];

  // Ligne d'adversaire : [clé, win rate de ce champion contre lui, delta 1, delta 2, part, parties].
  const pairs = (list: unknown, min: number) => {
    const out: Record<string, [number, number]> = {};
    for (const r of rows(list)) {
      const name = nameOfKey.get(r[0]);
      const games = r[5] ?? 0;
      if (name && games >= min) out[name] = [r[1]!, games];
    }
    return out;
  };
  const enemy = data.enemy as Record<string, unknown>;
  const matchups = pairs(enemy[lane], MIN_PAIR_GAMES);
  // Même ligne de données pour les ennemis des autres lanes : win rate de ce champion quand l'ennemi joue X.
  const crossMatchups: LaneStats['crossMatchups'] = {};
  for (const [otherLane, list] of Object.entries(enemy)) {
    const otherRole = ROLE_OF[otherLane];
    if (otherRole && otherLane !== lane) crossMatchups[otherRole] = pairs(list, MIN_CROSS_GAMES);
  }
  const dmg = (header.damage ?? {}) as { physical?: number; magic?: number };
  return {
    patch: String(nav.patch),
    role,
    lanes: navStats?.lanes ?? {},
    slugs: slugs ?? {},
    stats: {
      games: Number(header.n),
      winRate: Number(header.wr),
      laneShare: navStats?.lanes?.[lane] ?? 100,
      damage: { physical: dmg.physical ?? 0, magic: dmg.magic ?? 0 },
      byDuration,
      matchups,
      crossMatchups,
      duos: {}
    } satisfies LaneStats
  };
};

/** Réponse `build-team` : allié par lane, ligne [clé, win rate ensemble, delta, delta normalisé, part, parties]. */
export const parseTeam = (json: string, nameOfKey: ReadonlyMap<number, string>): LaneStats['duos'] => {
  const team = (JSON.parse(json) as { team?: Record<string, unknown> }).team ?? {};
  const duos: LaneStats['duos'] = {};
  for (const [lane, list] of Object.entries(team)) {
    const role = ROLE_OF[lane];
    if (!role) continue;
    const out: Record<string, [number, number]> = {};
    for (const r of rows(list)) {
      const name = nameOfKey.get(r[0]);
      const games = r[5] ?? 0;
      if (name && games >= MIN_PAIR_GAMES) out[name] = [r[3]!, games];
    }
    duos[role] = out;
  }
  return duos;
};

const buildUrl = (slug: string, region: string, role?: Role) =>
  `https://lolalytics.com/lol/${slug}/build/?` + (role ? `lane=${LANE[role]}&` : '') + `tier=${TIER}&region=${region}`;
const teamUrl = (slug: string, role: Role, patch: string, region: string) =>
  `https://a1.lolalytics.com/mega/?ep=build-team&v=1&patch=${patch}&c=${slug}&lane=${LANE[role]}&tier=${TIER}&queue=ranked&region=${region}`;

/**
 * Collecte un patch : pour chaque champion, la page build de sa lane principale dans `region` (lanes, win rate, durées),
 * celle de ses lanes secondaires jouées à au moins MIN_LANE_SHARE %, puis pour chaque lane les matchups et les duos
 * dans `pairRegion` (une page build et un appel `build-team` de plus).
 */
export const crawlLolalytics = async (
  champions: readonly ChampionAttributes[],
  fetchPage: PoliteFetch,
  fetchApi: PoliteFetch,
  log: (msg: string) => void = () => {},
  region: string = DEFAULT_REGION,
  pairRegion: string = DEFAULT_PAIR_REGION,
  /** Avancement : champion `done` sur `total` en cours. */
  progress: (done: number, total: number, name: string) => void = () => {}
): Promise<{ dump: LolalyticsDump; missing: string[] }> => {
  const nameOfKey = new Map(champions.map((c) => [c.key, c.name]));
  // La première page donne le patch courant et les identifiants d'URL de tous les champions.
  const first = parseBuildPage(await fetchPage(buildUrl('ahri', region)), nameOfKey);
  const patch = first.patch;
  const slugOf = new Map(Object.entries(first.slugs).map(([k, s]) => [Number(k), s]));
  const out: LolalyticsDump['champions'] = {};
  const missing: string[] = [];

  for (const [i, c] of champions.entries()) {
    const slug = slugOf.get(c.key);
    if (!slug) {
      missing.push(c.name);
      continue;
    }
    log(`[${i + 1}/${champions.length}] ${c.name}`);
    progress(i, champions.length, c.name);
    try {
      const main = parseBuildPage(await fetchPage(buildUrl(slug, region)), nameOfKey);
      const lanes: Partial<Record<Role, LaneStats>> = { [main.role]: main.stats };
      for (const [lane, share] of Object.entries(main.lanes)) {
        const role = ROLE_OF[lane];
        if (!role || role === main.role || share < MIN_LANE_SHARE) continue;
        lanes[role] = parseBuildPage(await fetchPage(buildUrl(slug, region, role)), nameOfKey).stats;
      }
      for (const [role, stats] of Object.entries(lanes) as [Role, LaneStats][]) {
        // Matchups et duos sur un échantillon plus large que les stats générales (toutes régions par défaut).
        if (pairRegion !== region) {
          const wide = parseBuildPage(await fetchPage(buildUrl(slug, pairRegion, role)), nameOfKey).stats;
          stats.matchups = wide.matchups;
          stats.crossMatchups = wide.crossMatchups;
        }
        stats.duos = parseTeam(await fetchApi(teamUrl(slug, role, patch, pairRegion)), nameOfKey);
      }
      out[c.name] = lanes;
    } catch (e) {
      // Un refus d'accès ou un arrêt volontaire arrête tout ; une page atypique fait seulement sauter ce champion.
      if (e instanceof CrawlStopped || /Accès refusé/.test((e as Error).message)) throw e;
      log(`  ${c.name} ignoré : ${(e as Error).message}`);
      missing.push(c.name);
    }
  }
  return { dump: { source: 'lolalytics', patch, tier: TIER, region, pairRegion, fetchedAt: new Date().toISOString(), champions: out }, missing };
};
