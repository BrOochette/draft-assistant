import { ROLES, type DraftState, type Pools, type Role } from '@draft/schemas';
import { allyContext, entryFor, rowMeta, type Availability } from './context';
import { evaluate } from './evaluate';
import type { EngineData } from './stats-provider';
import type { CompMember, Evaluation, RoleResult, ScoringOptions } from './types';

export const recommendRole = (
  role: Role,
  state: DraftState,
  pools: Pools,
  data: EngineData,
  enemies: readonly CompMember[],
  avail: Availability,
  options: ScoringOptions = {}
): RoleResult => {
  const meta = rowMeta(state, pools, role);
  const ctx = allyContext(state, pools, data, role);
  const allyPick = state.ally[role];
  const enemyPick = state.enemy[role];
  const multiRole = meta.player != null && ROLES.filter((r) => state.assign[r] === meta.player).length > 1;
  const base = { role, player: meta.player, hasPool: meta.hasPool, multiRole, allyPick, enemyPick };

  if (allyPick) {
    const ev = evaluate(entryFor(data, meta, role, allyPick), ctx, enemies, meta.player, state.enemy, options);
    const matchupNotes = enemyPick ? data.matchupNotes.matchups[allyPick + '|' + enemyPick] ?? null : null;
    const info = data.matchupNotes.fixedInfo[allyPick] ?? null;
    return { ...base, locked: { ...ev, matchupNotes, info }, recommendations: [], inPool: [], outOfPool: [], secondaryRole: [], note: null };
  }

  const candidates = data.stats.listCandidates(role).map((c) => c.name);
  // Champions du pool joués hors de leurs rôles habituels (stats mesurées seulement : la maquette les ignore),
  // évalués avec les stats par défaut du rôle, signalés peu fiables.
  const offRole = data.measured ? meta.list.map((p) => p.champion).filter((n) => !candidates.includes(n)) : [];
  const evals = [...candidates, ...offRole]
    .filter((name) => !avail.gone(name, role))
    .map((name) => evaluate(entryFor(data, meta, role, name), ctx, enemies, meta.player, state.enemy, options));
  // Array.prototype.sort est stable : à égalité, l'ordre de la source est conservé.
  evals.sort((a, b) => b.total - a.total);

  if (!meta.hasPool) {
    // Sans pool, seuls les champions dont c'est un rôle principal sont classés ; les autres restent consultables.
    const main = evals.filter(isMainRole);
    const secondaryRole = evals.filter((e) => !isMainRole(e));
    const shown = main.length ? main : secondaryRole;
    return { ...base, locked: null, recommendations: shown.slice(0, 3), inPool: main, outOfPool: [], secondaryRole, note: 'NO_POOL' };
  }
  const inPool = evals.filter((e) => e.pool === 'in');
  const outOfPool = evals.filter((e) => e.pool === 'out');
  // Pool épuisé : propositions hors pool, en priorité parmi les champions dont c'est un rôle principal.
  const fallback = outOfPool.filter(isMainRole).length ? outOfPool.filter(isMainRole) : outOfPool;
  return {
    ...base,
    locked: null,
    recommendations: (inPool.length ? inPool : fallback).slice(0, 3),
    inPool,
    outOfPool,
    secondaryRole: [],
    note: inPool.length ? 'POOL' : 'POOL_EXHAUSTED'
  };
};

/** Part minimale des parties d'un champion sur un rôle pour qu'il y soit classé sans pool (en %). */
export const MAIN_ROLE_SHARE = 20;
const isMainRole = (e: Evaluation) => e.laneShare == null || e.laneShare >= MAIN_ROLE_SHARE;
