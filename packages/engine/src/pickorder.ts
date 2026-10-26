import type { DraftState, Pools, Role } from '@draft/schemas';
import { entryFor, rowMeta, type Availability } from './context';
import { matchupEffect } from './evaluate';
import { rankScore } from './recommend';
import type { EngineData } from './stats-provider';
import type { CounterPick, Evaluation, RoleResult } from './types';

/** Adversaires probables d'un rôle : rôle principal (au moins LANE_SHARE % de leurs parties), au moins MIN_GAMES parties. */
const LANE_SHARE = 50;
const MIN_GAMES = 1000;
/** Adversaires probables retenus, les plus joués d'abord. */
const OPPONENTS = 15;
/** Options comparées sans pool : les premières suggestions du rôle. */
const NO_POOL_OPTIONS = 5;

/**
 * Gain à choisir après avoir vu le vis-à-vis (stats mesurées), en points sur 20, pour un rôle allié encore ouvert dont
 * le vis-à-vis n'est pas connu. À l'aveugle, on prend l'option la meilleure en moyenne sur les adversaires probables ;
 * en attendant, la meilleure contre l'adversaire qui sort. Gain = moyenne (pondérée par les parties) du meilleur choix
 * contre chaque adversaire, moins le meilleur choix à l'aveugle. Toujours positif ou nul ; plus il est haut, plus le
 * rôle a intérêt à choisir tard.
 */
export const counterPick = (
  row: Omit<RoleResult, 'enemyEval' | 'counterPick'>,
  state: DraftState,
  pools: Pools,
  data: EngineData,
  avail: Availability
): CounterPick | null => {
  if (!data.measured || row.allyPick || row.enemyPick) return null;
  const options: Evaluation[] = row.hasPool && row.inPool.length ? row.inPool : row.recommendations.slice(0, NO_POOL_OPTIONS);
  if (options.length < 2) return null;
  const role: Role = row.role;
  const meta = rowMeta(state, pools, role);
  const ours = options.map((e) => ({ e, entry: entryFor(data, meta, role, e.champion), score: rankScore(e) }));
  const opponents = data.stats
    .listCandidates(role)
    .filter((c) => c.games >= MIN_GAMES && (c.laneShare ?? 100) >= LANE_SHARE && !avail.banBlocked(c.name) && !ours.some((o) => o.e.champion === c.name))
    .sort((a, b) => b.games - a.games)
    .slice(0, OPPONENTS);
  const total = opponents.reduce((s, c) => s + c.games, 0);
  if (!total) return null;

  // Note de chaque option contre chaque adversaire probable : sa note actuelle plus l'écart du matchup (vis-à-vis, poids 1).
  const vs = ours.map((o) => opponents.map((c) => o.score + (matchupEffect(o.entry, role, c.name)?.delta ?? 0)));
  const mean = (row: number[]) => row.reduce((s, v, i) => s + v * opponents[i]!.games, 0) / total;
  const blindIndex = vs.reduce((bi, row, i) => (mean(row) > mean(vs[bi]!) ? i : bi), 0);
  const informed = opponents.reduce((s, c, j) => s + Math.max(...vs.map((row) => row[j]!)) * c.games, 0) / total;
  return { gain: informed - mean(vs[blindIndex]!), blind: ours[blindIndex]!.e.champion, options: ours.length, opponents: opponents.length };
};
