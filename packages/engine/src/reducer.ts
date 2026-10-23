import { emptySlots, type DraftState, type Role } from '@draft/schemas';
import { MAX_BANS } from './bans';
import { availability } from './context';

export type Side = 'ally' | 'enemy';

/** Message de la notification d'annulation, traduit par l'interface. */
export type ActionMessage =
  | { code: 'LOCKED'; champion: string; role: Role }
  | { code: 'UNLOCKED'; champion: string; role: Role }
  | { code: 'ENEMY_SET'; champion: string; role: Role }
  | { code: 'ENEMY_CLEARED'; role: Role }
  | { code: 'BANNED'; champion: string }
  | { code: 'BAN_REMOVED'; champion: string }
  | { code: 'RESET' };

interface Snapshot {
  draft: DraftState;
  selected: Partial<Record<Role, string>>;
}

export interface DraftSession extends Snapshot {
  /** États précédents, le plus récent en dernier. */
  history: Snapshot[];
  /** Dernière action annulable, tant que la notification est affichée. */
  toast: ActionMessage | null;
}

export type DraftAction =
  | { type: 'lock'; role: Role; champion: string }
  | { type: 'unlock'; role: Role }
  | { type: 'setEnemy'; role: Role; champion: string }
  | { type: 'clearEnemy'; role: Role }
  | { type: 'addBan'; side: Side; champion: string }
  | { type: 'removeBan'; side: Side; champion: string }
  | { type: 'assignPlayer'; role: Role; player: string }
  | { type: 'select'; role: Role; champion: string }
  | { type: 'reset' }
  | { type: 'undo' }
  | { type: 'dismissToast' };

const HISTORY_LIMIT = 50;

export const createSession = (draft: DraftState): DraftSession => ({ draft, selected: {}, history: [], toast: null });

const commit = (s: DraftSession, message: ActionMessage, draft: DraftState, selected = s.selected): DraftSession => ({
  draft,
  selected,
  history: [...s.history, { draft: s.draft, selected: s.selected }].slice(-HISTORY_LIMIT),
  toast: message
});

const banKey = (side: Side): 'allyBans' | 'enemyBans' => (side === 'ally' ? 'allyBans' : 'enemyBans');

export const draftReducer = (s: DraftSession, a: DraftAction): DraftSession => {
  const d = s.draft;
  switch (a.type) {
    case 'lock': {
      if (d.ally[a.role] === a.champion || availability(d).blocked(a.champion, 'ally', a.role)) return s;
      const { [a.role]: _, ...selected } = s.selected;
      return commit(s, { code: 'LOCKED', champion: a.champion, role: a.role }, { ...d, ally: { ...d.ally, [a.role]: a.champion } }, selected);
    }
    case 'unlock': {
      const was = d.ally[a.role];
      if (!was) return s;
      return commit(s, { code: 'UNLOCKED', champion: was, role: a.role }, { ...d, ally: { ...d.ally, [a.role]: null } });
    }
    case 'setEnemy': {
      if (d.enemy[a.role] === a.champion || availability(d).blocked(a.champion, 'enemy', a.role)) return s;
      return commit(s, { code: 'ENEMY_SET', champion: a.champion, role: a.role }, { ...d, enemy: { ...d.enemy, [a.role]: a.champion } });
    }
    case 'clearEnemy': {
      if (!d.enemy[a.role]) return s;
      return commit(s, { code: 'ENEMY_CLEARED', role: a.role }, { ...d, enemy: { ...d.enemy, [a.role]: null } });
    }
    case 'addBan': {
      const key = banKey(a.side);
      if (d[key].length >= MAX_BANS || availability(d).banBlocked(a.champion)) return s;
      return commit(s, { code: 'BANNED', champion: a.champion }, { ...d, [key]: [...d[key], a.champion] });
    }
    case 'removeBan': {
      const key = banKey(a.side);
      if (!d[key].includes(a.champion)) return s;
      return commit(s, { code: 'BAN_REMOVED', champion: a.champion }, { ...d, [key]: d[key].filter((n) => n !== a.champion) });
    }
    case 'assignPlayer':
      // Comme dans la maquette : placer un joueur n'est pas annulable et efface les sélections.
      if (d.assign[a.role] === a.player) return s;
      return { ...s, draft: { ...d, assign: { ...d.assign, [a.role]: a.player } }, selected: {} };
    case 'select': {
      const { [a.role]: current, ...rest } = s.selected;
      return { ...s, selected: current === a.champion ? rest : { ...rest, [a.role]: a.champion } };
    }
    case 'reset':
      return commit(s, { code: 'RESET' }, { assign: d.assign, ally: emptySlots(), enemy: emptySlots(), allyBans: [], enemyBans: [] }, {});
    case 'undo': {
      const prev = s.history[s.history.length - 1];
      if (!prev) return s;
      return { ...prev, history: s.history.slice(0, -1), toast: null };
    }
    case 'dismissToast':
      return s.toast ? { ...s, toast: null } : s;
  }
};
