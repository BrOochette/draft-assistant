import { ROLES, type DraftState, type Pools, type Role } from '@draft/schemas';
import { entryFor, rowMeta, type Availability } from './context';
import { matchupEffect } from './evaluate';
import { rankScore } from './recommend';
import type { EngineData } from './stats-provider';
import type { BanCard, Evaluation, RoleResult } from './types';

export const MAX_BANS = 5;
/** Suggestions affichées par rôle. */
export const BANS_PER_ROLE = 3;
/** Champions examinés en ban (stats mesurées) : rôle principal (au moins BAN_LANE_SHARE % de leurs parties) et BAN_GAMES parties. */
const BAN_LANE_SHARE = 50;
const BAN_GAMES = 1000;

/**
 * Suggestions de bans, par rôle où l'ennemi n'a pas encore pick, sans les champions déjà bannis ou pris.
 * Stats mesurées : les BANS_PER_ROLE champions qui nous coûtent le plus, en points de win rate attendu (leur force,
 * plus la baisse de notre meilleure option du rôle s'ils sont le vis-à-vis). Données d'exemple : menace fixe.
 * Ordre : rôle (Top à Support), puis valeur.
 */
export const banSuggestions = (state: DraftState, pools: Pools, data: EngineData, avail: Availability, roles: readonly RoleResult[]) => ({
  suggestions: ROLES.filter((role) => !state.enemy[role]).flatMap((role) =>
    data.measured ? measuredBans(role, state, pools, data, avail, roles.find((r) => r.role === role)!) : sampleBans(role, data, avail)
  ),
  allyFull: state.allyBans.length >= MAX_BANS
});

const sampleBans = (role: Role, data: EngineData, avail: Availability): BanCard[] =>
  data.banSuggestions
    .filter((b) => b.role === role && !avail.banBlocked(b.champion))
    .sort((a, b) => b.threat - a.threat)
    .slice(0, BANS_PER_ROLE)
    .map((b) => ({ champion: b.champion, role: b.role, threat: b.threat, ...(b.reason && { reason: b.reason }), ...(b.winRate != null && { winRate: b.winRate }) }));

/** Nos options sur le rôle : le pick verrouillé, sinon le pool, sinon les suggestions. */
const ourOptions = (row: RoleResult): Evaluation[] => (row.locked ? [row.locked] : row.hasPool && row.inPool.length ? row.inPool : row.recommendations);

const measuredBans = (role: Role, state: DraftState, pools: Pools, data: EngineData, avail: Availability, row: RoleResult): BanCard[] => {
  const meta = rowMeta(state, pools, role);
  const options = ourOptions(row).map((e) => ({ e, entry: entryFor(data, meta, role, e.champion), score: rankScore(e) }));
  const best = options.reduce<(typeof options)[number] | null>((b, o) => (!b || o.score > b.score ? o : b), null);
  const prior = data.winRatePriorGames;
  return data.stats
    .listCandidates(role)
    // Nos options ne sont pas proposées : les bannir nous priverait de notre propre pick.
    .filter((c) => c.games >= BAN_GAMES && (c.laneShare ?? 100) >= BAN_LANE_SHARE && !avail.banBlocked(c.name) && !options.some((o) => o.e.champion === c.name))
    .map((c): BanCard => {
      const strength = (prior > 0 ? (c.gameWinRate * c.games + 50 * prior) / (c.games + prior) : c.gameWinRate) - 50;
      // Meilleure option si ce champion est notre vis-à-vis : chacune perd (ou gagne) l'écart de son matchup contre lui.
      const bestVs = options.reduce((m, o) => Math.max(m, o.score + (matchupEffect(o.entry, role, c.name)?.delta ?? 0)), -Infinity);
      const drop = best ? best.score - bestVs : 0;
      const value = strength + drop;
      return { champion: c.name, role, threat: value, winRate: c.gameWinRate, impact: { value, strength, drop, ours: best?.e.champion ?? null } };
    })
    .sort((a, b) => b.threat - a.threat)
    .slice(0, BANS_PER_ROLE);
};
