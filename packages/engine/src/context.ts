import { ROLES, type DraftState, type PoolEntry, type Pools, type Role } from '@draft/schemas';
import type { EngineData } from './stats-provider';
import type { CompMember, Entry, PoolStatus } from './types';

export interface RowMeta {
  player: string;
  hasPool: boolean;
  list: readonly PoolEntry[];
}

export const rowMeta = (state: DraftState, pools: Pools, role: Role): RowMeta => {
  const player = state.assign[role];
  const list = pools[player]?.[role] ?? [];
  return { player, hasPool: list.length > 0, list };
};

export const poolStatus = (meta: RowMeta, name: string): { pool: PoolStatus; mastery: number | null } => {
  if (!meta.hasPool) return { pool: 'all', mastery: null };
  const f = meta.list.find((x) => x.champion === name);
  return f ? { pool: 'in', mastery: f.mastery * 10 } : { pool: 'out', mastery: 0 };
};

/** Champion `name` joué sur `role` par le joueur placé sur ce rôle. */
export const entryFor = (data: EngineData, meta: RowMeta, role: Role, name: string): Entry => {
  const s = data.stats.getRoleStats(name, role);
  return {
    name: s.name,
    role,
    damage: s.damage,
    provides: s.provides,
    scaling: s.scaling,
    synergyBase: s.synergyBase,
    laneWinRate: s.laneWinRate,
    gameWinRate: s.gameWinRate,
    games: s.games,
    notes: s.notes,
    ...(s.matchups && { matchups: s.matchups }),
    ...(s.duos && { duos: s.duos }),
    ...poolStatus(meta, name)
  };
};

/** Picks alliés sauf celui de `role`, dans l'ordre des rôles. */
export const allyContext = (state: DraftState, pools: Pools, data: EngineData, role: Role | null): Entry[] => {
  const list: Entry[] = [];
  for (const r of ROLES) {
    const pick = state.ally[r];
    if (r !== role && pick) list.push(entryFor(data, rowMeta(state, pools, r), r, pick));
  }
  return list;
};

export const enemyKnown = (state: DraftState, data: EngineData): CompMember[] => {
  const list: CompMember[] = [];
  for (const r of ROLES) {
    const n = state.enemy[r];
    const m = n ? data.catalog.get(n) : undefined;
    if (m) list.push(m);
  }
  return list;
};

/** Pourquoi un champion ne peut pas être recommandé sur `role`. */
export type GoneReason = 'BANNED_BY_ALLY' | 'BANNED_BY_ENEMY' | 'TAKEN_BY_ENEMY' | 'TAKEN_BY_ALLY';
/** Pourquoi un champion ne peut pas être saisi du côté `side` sur `role`. */
export type Blocked = 'BANNED' | 'TAKEN_BY_ALLY' | 'TAKEN_BY_ENEMY';
export type BanBlocked = 'ALREADY_BANNED' | 'ALREADY_PICKED';

export interface Availability {
  gone(name: string, role: Role): GoneReason | null;
  blocked(name: string, side: 'ally' | 'enemy', role: Role): Blocked | null;
  banBlocked(name: string): BanBlocked | null;
}

export const availability = (state: DraftState): Availability => {
  const allyTakenBy = new Map<string, Role>();
  const enemyTakenBy = new Map<string, Role>();
  for (const r of ROLES) {
    const a = state.ally[r];
    if (a) allyTakenBy.set(a, r);
    const e = state.enemy[r];
    if (e) enemyTakenBy.set(e, r);
  }
  const allyBans = new Set(state.allyBans);
  const enemyBans = new Set(state.enemyBans);
  return {
    gone(name, role) {
      if (allyBans.has(name)) return 'BANNED_BY_ALLY';
      if (enemyBans.has(name)) return 'BANNED_BY_ENEMY';
      if (enemyTakenBy.has(name)) return 'TAKEN_BY_ENEMY';
      const by = allyTakenBy.get(name);
      if (by && by !== role) return 'TAKEN_BY_ALLY';
      return null;
    },
    blocked(name, side, role) {
      if (allyBans.has(name) || enemyBans.has(name)) return 'BANNED';
      const a = allyTakenBy.get(name);
      if (a && !(side === 'ally' && a === role)) return 'TAKEN_BY_ALLY';
      const e = enemyTakenBy.get(name);
      if (e && !(side === 'enemy' && e === role)) return 'TAKEN_BY_ENEMY';
      return null;
    },
    banBlocked(name) {
      if (allyBans.has(name) || enemyBans.has(name)) return 'ALREADY_BANNED';
      if (allyTakenBy.has(name) || enemyTakenBy.has(name)) return 'ALREADY_PICKED';
      return null;
    }
  };
};
