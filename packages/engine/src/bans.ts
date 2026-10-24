import { ROLES, type DraftState } from '@draft/schemas';
import type { Availability } from './context';
import type { EngineData } from './stats-provider';
import type { BanCard } from './types';

export const MAX_BANS = 5;
/** Suggestions affichées par rôle. */
export const BANS_PER_ROLE = 3;

/**
 * Suggestions de bans : par rôle, les BANS_PER_ROLE plus fortes menaces des données, sans les champions déjà
 * bannis ou pris, ni les rôles où l'ennemi a déjà pick (il ne peut plus jouer un autre champion à ce poste).
 * Ordre : rôle (Top à Support), puis menace.
 */
export const banSuggestions = (state: DraftState, data: EngineData, avail: Availability) => ({
  suggestions: ROLES.filter((role) => !state.enemy[role]).flatMap((role) =>
    data.banSuggestions
      .filter((b) => b.role === role && !avail.banBlocked(b.champion))
      .slice()
      .sort((a, b) => b.threat - a.threat)
      .slice(0, BANS_PER_ROLE)
      .map((b): BanCard => ({ champion: b.champion, role: b.role, threat: b.threat, ...(b.reason && { reason: b.reason }), ...(b.winRate != null && { winRate: b.winRate }) }))
  ),
  allyFull: state.allyBans.length >= MAX_BANS
});
