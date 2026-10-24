import { ROLES, type DraftState, type Pools } from '@draft/schemas';
import { banSuggestions } from './bans';
import { compScore, NEUTRAL_MEMBER, verdictOf } from './composition';
import { allyContext, availability, enemyKnown } from './context';
import { archetypes, readAlly, readEnemy, scalingPhases, teamNotes } from './read';
import { recommendRole } from './recommend';
import type { EngineData } from './stats-provider';
import type { DraftResult, ScoringOptions } from './types';

/** Calcule tout ce que l'écran de draft affiche. Pur : aucun accès au DOM, au réseau ni au stockage. */
export const computeDraft = (state: DraftState, pools: Pools, data: EngineData, options: ScoringOptions = {}): DraftResult => {
  const avail = availability(state);
  const enemies = enemyKnown(state, data);
  const full = allyContext(state, pools, data, null);
  const ally = compScore(full, enemies);
  const enemy = compScore(enemies.length ? enemies : [NEUTRAL_MEMBER], full);
  const scaling = scalingPhases(full, enemies);
  const roles = ROLES.map((role) => recommendRole(role, state, pools, data, enemies, avail, options));
  return {
    roles,
    composition: {
      ally: { ...ally, verdict: verdictOf(ally.total) },
      enemy: { ...enemy, verdict: verdictOf(enemy.total) }
    },
    scaling,
    allyRead: readAlly(full, scaling),
    enemyRead: readEnemy(state, enemies),
    team: teamNotes(state, pools),
    bans: banSuggestions(state, pools, data, avail, roles),
    archetypes: {
      ally: archetypes(full.map((x) => x.name), data.catalog),
      enemy: archetypes(enemies.map((x) => x.name), data.catalog)
    }
  };
};

export { availability, type Availability, type BanBlocked, type Blocked, type GoneReason } from './context';
export { compScore, verdictOf } from './composition';
export { allyWeight, DUO_WEIGHT, evaluate, LOW_SAMPLE_GAMES, MASTERY_POINT, matchupEffect, modeOf, otherEnemyWeight, totalScore } from './evaluate';
export { ARCHETYPE_OF_CLASS } from './read';
export { avgScal, clamp, wrScore } from './math';
export { BANS_PER_ROLE, MAX_BANS } from './bans';
export { MAIN_ROLE_SHARE, rankScore } from './recommend';
export { createSession, draftReducer, type ActionMessage, type DraftAction, type DraftSession, type Side } from './reducer';
export { createEngineData, SnapshotStatsProvider, type EngineData, type StatsProvider } from './stats-provider';
export * from './types';
