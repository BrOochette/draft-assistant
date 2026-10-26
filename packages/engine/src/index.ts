import { ROLES, type DraftState, type Pools, type Role } from '@draft/schemas';
import { banSuggestions } from './bans';
import { compScore, NEUTRAL_MEMBER, verdictOf } from './composition';
import { allyContext, availability, enemyKnown, entryFor } from './context';
import { evaluate, pointsOfWr } from './evaluate';
import { archetypes, readAlly, readEnemy, scalingPhases, teamNotes } from './read';
import { recommendRole, roleAverage } from './recommend';
import type { EngineData } from './stats-provider';
import type { DraftResult, RoleResult, ScoringOptions, Verdict } from './types';

/** Verdict d'une compo d'après sa note projetée sur 100 (un pick à la moyenne d'un rôle vaut environ 11,5). */
export const teamVerdictOf = (n: number): Verdict => (n >= 65 ? 'solid' : n >= 56 ? 'fair' : n >= 50 ? 'fragile' : 'fix');

/** Note sur 20 de repère d'un rôle sans pick : win rate moyen du rôle. */
const averagePoints = (data: EngineData, role: Role): number => pointsOfWr(roleAverage(data, role) ?? 50);

/**
 * Notes d'équipe sur 100 (stats mesurées) : cumul des notes sur 20 des picks connus. Ta compo : picks verrouillés ;
 * compo ennemie : chaque pick connu noté de son côté (matchups contre tes picks, duos et apport à sa compo, sans
 * maîtrise). Le verdict juge la projection : les rôles sans pick comptent à la note du win rate moyen du rôle.
 */
const teamPoints = (state: DraftState, data: EngineData, roles: readonly RoleResult[]) => {
  const ally = roles.reduce((s, r) => s + (r.locked?.points.value ?? 0), 0);
  const allyProjected = roles.reduce((s, r) => s + (r.locked?.points.value ?? averagePoints(data, r.role)), 0);
  const noPool = { player: null, hasPool: false, list: [] };
  const enemyEntries = ROLES.flatMap((r) => (state.enemy[r] ? [entryFor(data, noPool, r, state.enemy[r]!)] : []));
  const allies = ROLES.flatMap((r) => (state.ally[r] ? [entryFor(data, noPool, r, state.ally[r]!)] : []));
  let enemy = 0;
  let enemyProjected = 0;
  for (const r of ROLES) {
    const e = enemyEntries.find((x) => x.role === r);
    const v = e ? evaluate(e, enemyEntries.filter((x) => x !== e), allies, null, state.ally).points.value : null;
    enemy += v ?? 0;
    enemyProjected += v ?? averagePoints(data, r);
  }
  return { ally: Math.round(ally), enemy: Math.round(enemy), allyProjected, enemyProjected };
};

/** Calcule tout ce que l'écran de draft affiche. Pur : aucun accès au DOM, au réseau ni au stockage. */
export const computeDraft = (state: DraftState, pools: Pools, data: EngineData, options: ScoringOptions = {}): DraftResult => {
  const avail = availability(state);
  const enemies = enemyKnown(state, data);
  const full = allyContext(state, pools, data, null);
  const ally = compScore(full, enemies);
  const enemy = compScore(enemies.length ? enemies : [NEUTRAL_MEMBER], full);
  const scaling = scalingPhases(full, enemies);
  const roles = ROLES.map((role) => recommendRole(role, state, pools, data, enemies, avail, options));
  const allyArchetypes = archetypes(full.map((x) => x.name), data.catalog);
  // Stats mesurées : notes d'équipe sur 100 (cumul des notes sur 20 des picks) ; données d'exemple : note de compo de la maquette.
  const team = data.measured ? teamPoints(state, data, roles) : null;
  return {
    roles,
    composition: team
      ? {
          ally: { ...ally, total: team.ally, verdict: teamVerdictOf(team.allyProjected) },
          enemy: { ...enemy, total: team.enemy, verdict: teamVerdictOf(team.enemyProjected) }
        }
      : {
          ally: { ...ally, verdict: verdictOf(ally.total) },
          enemy: { ...enemy, verdict: verdictOf(enemy.total) }
        },
    scaling,
    allyRead: readAlly(full, scaling, enemies),
    enemyRead: readEnemy(state, enemies),
    team: teamNotes(state, pools),
    bans: banSuggestions(state, pools, data, avail, roles, options.bansPerRole),
    archetypes: {
      ally: allyArchetypes,
      enemy: archetypes(enemies.map((x) => x.name), data.catalog)
    }
  };
};

export { applyClientDraft, type ClientOrder, type ClientSync } from './client';
export { matchPlayers, nameSimilarity, normalizeName, PLAYER_MATCH_MIN, type PlayerIdentity } from './players';
export { availability, rolesByPlay, type Availability, type BanBlocked, type Blocked, type GoneReason } from './context';
export { compScore, verdictOf } from './composition';
export { SUSTAINED_CLASSES } from './context';
export { allyWeight, boundPoints, SUSTAINED_LATE, SUSTAINED_POINTS, DUO_WEIGHT, evaluate, FIT_BONUS, POINTS_PER_WR, pointsOfWr, REDUNDANCY_FREE, REDUNDANCY_POINTS, LOW_SAMPLE_GAMES, MASTERY_POINT, matchupEffect, modeOf, otherEnemyWeight, totalScore } from './evaluate';
export { ARCHETYPE_OF_CLASS } from './read';
export { avgScal, clamp, wrScore } from './math';
export { BANS_PER_ROLE, MAX_BANS } from './bans';
export { MAIN_ROLE_SHARE, rankScore, roleAverage } from './recommend';
export { createSession, draftReducer, type ActionMessage, type DraftAction, type DraftSession, type Side } from './reducer';
export { createEngineData, SnapshotStatsProvider, type EngineData, type StatsProvider } from './stats-provider';
export * from './types';
