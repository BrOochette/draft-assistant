import type { DraftState } from '@draft/schemas';
import type { Availability } from './context';
import type { EngineData } from './stats-provider';
import type { BanCard } from './types';

export const MAX_BANS = 5;
const MAX_SUGGESTIONS = 6;

/** Suggestions de bans : score de menace fixe des données, sans les champions déjà bannis ou pris. */
export const banSuggestions = (state: DraftState, data: EngineData, avail: Availability) => ({
  suggestions: data.banSuggestions
    .filter((b) => !avail.banBlocked(b.champion))
    .slice()
    .sort((a, b) => b.threat - a.threat)
    .slice(0, MAX_SUGGESTIONS)
    .map((b): BanCard => ({ champion: b.champion, role: b.role, threat: b.threat, reason: b.reason })),
  allyFull: state.allyBans.length >= MAX_BANS
});
