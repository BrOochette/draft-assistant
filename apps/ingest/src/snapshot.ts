import {
  ROLES,
  StatsSnapshotSchema,
  type BanSuggestion,
  type Candidate,
  type Champion,
  type ChampionAttributes,
  type ChampionOverrides,
  type Damage,
  type Role,
  type Scaling,
  type StatsSnapshot,
  type Trait
} from '@draft/schemas';
import type { LaneStats, LolalyticsDump } from './lolalytics';

/** Un champion devient candidat sur une lane à partir de cette part de ses parties (%) et de ce nombre de parties. */
const CANDIDATE_SHARE = 5;
const CANDIDATE_GAMES = 300;
/** Base de synergie identique pour tous : les duos mesurés s'y ajoutent dans le moteur. */
const SYNERGY_BASE = 55;
/** Lissage du win rate vers 50 % dans le counter : un pick peu joué ne sature plus le score. */
const WIN_RATE_PRIOR_GAMES = 3000;
const PRIOR_GAMES = 200;
/** Suggestions de bans : par rôle, champions dont c'est la lane principale (au moins BAN_LANE_SHARE % de leurs parties) et d'au moins BAN_GAMES parties, les BAN_PER_ROLE meilleurs win rates. */
const BAN_GAMES = 1000;
const BAN_LANE_SHARE = 50;
/** Réserve par rôle : l'appli en affiche 3, les suivants remplacent un champion banni ou pris. */
const BAN_PER_ROLE = 8;

/** Tranches Lolalytics (1 : 0-15, 2 : 15-20, 3 : 20-25, 4+ : 25 min et plus) vers les phases D, M, F. */
const PHASE_BUCKETS: readonly (readonly string[])[] = [['1'], ['2', '3'], ['4', '5', '6', '7']];

const phaseWinRates = (s: LaneStats): [number, number, number] => {
  const out: [number, number, number] = [0, 0, 0];
  PHASE_BUCKETS.forEach((buckets, i) => {
    let games = 0;
    let wins = 0;
    for (const b of buckets) {
      games += s.byDuration[b]?.[0] ?? 0;
      wins += s.byDuration[b]?.[1] ?? 0;
    }
    // Lissé vers le win rate du champion : la tranche 0-15 min est très peu fournie.
    out[i] = ((wins + (PRIOR_GAMES * s.winRate) / 100) / (games + PRIOR_GAMES)) * 100;
  });
  return out;
};

/**
 * Scaling mesuré de 1 à 5 par phase : écart entre le win rate de la phase et le win rate global du champion,
 * centré et réduit sur l'ensemble des candidats (3 = comme la moyenne, ±1 par écart-type).
 */
export const measuredScaling = (lanes: readonly LaneStats[]): Map<LaneStats, Scaling> => {
  const diffs = lanes.map((s) => phaseWinRates(s).map((wr) => wr - s.winRate));
  const stats = [0, 1, 2].map((p) => {
    const xs = diffs.map((d) => d[p]!);
    const mean = xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length || 1)) || 1;
    return { mean, sd };
  });
  const level = (x: number, p: number) => Math.max(1, Math.min(5, Math.round(3 + (x - stats[p]!.mean) / stats[p]!.sd)));
  return new Map(lanes.map((s, i) => [s, diffs[i]!.map((x, p) => level(x, p)) as Scaling]));
};

const damageOf = (a: ChampionAttributes, o: ChampionOverrides[string] | undefined, s: LaneStats | undefined): Damage => {
  if (o?.damage) return o.damage;
  if (a.damage === 'TANK' || !s || s.damage.physical + s.damage.magic === 0) return a.damage;
  return s.damage.physical > s.damage.magic ? 'AD' : 'AP';
};

export const assembleLolalyticsSnapshot = (
  attributes: readonly ChampionAttributes[],
  overrides: ChampionOverrides,
  dump: LolalyticsDump,
  ddragonVersion: string
): StatsSnapshot => {
  const lanesOf = (name: string) => Object.entries(dump.champions[name] ?? {}) as [Role, LaneStats][];
  const isCandidate = (s: LaneStats) => s.laneShare >= CANDIDATE_SHARE && s.games >= CANDIDATE_GAMES;
  const scaling = measuredScaling(attributes.flatMap((a) => lanesOf(a.name).map(([, s]) => s)).filter(isCandidate));

  const champions: Champion[] = [];
  const candidates: Partial<Record<Role, Candidate[]>> = {};
  const bans: BanSuggestion[] = [];
  const mainLane = new Set<string>();

  for (const a of attributes) {
    const o = overrides[a.name];
    const lanes = lanesOf(a.name).sort((x, y) => y[1].games - x[1].games);
    const main = lanes[0]?.[1];
    const damage = damageOf(a, o, main);
    const traits: Trait[] = (o?.provides ?? a.provides).filter((t) => t !== 'Physique');
    const provides: Trait[] = damage === 'AD' ? [...traits, 'Physique'] : traits;
    const playedRoles = lanes.filter(([, s]) => s.laneShare >= CANDIDATE_SHARE).map(([r]) => r);
    champions.push({
      name: a.name,
      key: a.key,
      ddragonId: a.ddragonId,
      damage,
      provides: traits,
      scaling: (main && scaling.get(main)) ?? [3, 3, 3],
      roles: o?.roles ?? ROLES.filter((r) => a.roles.includes(r) || playedRoles.includes(r))
    });
    for (const [role, s] of lanes) {
      const sc = scaling.get(s);
      if (!sc || !isCandidate(s)) continue;
      if (s.laneShare >= BAN_LANE_SHARE) mainLane.add(role + '|' + a.name);
      (candidates[role] ??= []).push({
        name: a.name,
        games: s.games,
        synergyBase: SYNERGY_BASE,
        laneWinRate: null,
        gameWinRate: s.winRate,
        scaling: sc,
        provides,
        damage,
        notes: [],
        matchups: s.matchups,
        duos: s.duos,
        laneShare: s.laneShare,
        crossMatchups: s.crossMatchups
      });
    }
  }
  for (const role of ROLES) {
    const list = (candidates[role] ??= []);
    // Ordre de la source : du plus joué au moins joué (départage les égalités de score).
    list.sort((x, y) => y.games - x.games);
    list
      .filter((c) => c.games >= BAN_GAMES && mainLane.has(role + '|' + c.name))
      .sort((x, y) => y.gameWinRate - x.gameWinRate)
      .slice(0, BAN_PER_ROLE)
      .forEach((c) => bans.push({ champion: c.name, role, threat: Math.max(0, Math.min(100, Math.round(50 + (c.gameWinRate - 50) * 10))), winRate: c.gameWinRate }));
  }

  return StatsSnapshotSchema.parse({
    version: 1,
    source: 'lolalytics',
    patch: dump.patch,
    rank: 'Emerald+',
    ...(dump.region !== 'all' && { region: dump.region.toUpperCase() }),
    ...(dump.pairRegion && dump.pairRegion !== dump.region && { pairRegion: dump.pairRegion === 'all' ? 'all' : dump.pairRegion.toUpperCase() }),
    ddragonVersion,
    champions,
    candidates,
    matchupNotes: { matchups: {}, fixedInfo: {} },
    banSuggestions: bans,
    winRatePriorGames: WIN_RATE_PRIOR_GAMES
  });
};
