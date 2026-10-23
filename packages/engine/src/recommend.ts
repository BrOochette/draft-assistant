import { ROLES, type DraftState, type Pools, type Role } from '@draft/schemas';
import { allyContext, entryFor, rowMeta, type Availability } from './context';
import { evaluate } from './evaluate';
import type { EngineData } from './stats-provider';
import type { CompMember, RoleResult } from './types';

export const recommendRole = (
  role: Role,
  state: DraftState,
  pools: Pools,
  data: EngineData,
  enemies: readonly CompMember[],
  avail: Availability
): RoleResult => {
  const meta = rowMeta(state, pools, role);
  const ctx = allyContext(state, pools, data, role);
  const allyPick = state.ally[role];
  const enemyPick = state.enemy[role];
  const multiRole = ROLES.filter((r) => state.assign[r] === meta.player).length > 1;
  const base = { role, player: meta.player, hasPool: meta.hasPool, multiRole, allyPick, enemyPick };

  if (allyPick) {
    const ev = evaluate(entryFor(data, meta, role, allyPick), ctx, enemies, meta.player, enemyPick);
    const matchupNotes = enemyPick ? data.matchupNotes.matchups[allyPick + '|' + enemyPick] ?? null : null;
    const info = data.matchupNotes.fixedInfo[allyPick] ?? null;
    return { ...base, locked: { ...ev, matchupNotes, info }, recommendations: [], inPool: [], outOfPool: [], note: null };
  }

  const evals = data.stats
    .listCandidates(role)
    .filter((c) => !avail.gone(c.name, role))
    .map((c) => evaluate(entryFor(data, meta, role, c.name), ctx, enemies, meta.player, enemyPick));
  // Array.prototype.sort est stable : à égalité, l'ordre de la source est conservé.
  evals.sort((a, b) => b.total - a.total);
  const inPool = evals.filter((e) => e.pool !== 'out');
  const outOfPool = evals.filter((e) => e.pool === 'out');
  const shown = inPool.length ? inPool : outOfPool;
  return {
    ...base,
    locked: null,
    recommendations: shown.slice(0, 3),
    inPool,
    outOfPool,
    note: inPool.length ? (meta.hasPool ? 'POOL' : 'NO_POOL') : 'POOL_EXHAUSTED'
  };
};
