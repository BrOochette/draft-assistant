import { emptySlots, type DraftState, type Role } from '@draft/schemas';
import { MAX_BANS } from './bans';
import type { ClientOrder } from './client';
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
  | { code: 'SWAPPED'; role: Role }
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
  /** Champions survolés par les alliés dans le client : affichés, hors calcul. */
  hover: Partial<Record<Role, string>>;
  /** Ordre des joueurs dans le client (ordre de pick), null sans draft lue dans le client. */
  order: ClientOrder | null;
  /** Rôles dont le joueur est en train de choisir dans le client. */
  picking: ClientOrder;
  /** Side de ton équipe dans le client, null s'il est inconnu. */
  side: 'blue' | 'red' | null;
}

export type DraftAction =
  | { type: 'lock'; role: Role; champion: string }
  | { type: 'unlock'; role: Role }
  | { type: 'setEnemy'; role: Role; champion: string }
  | { type: 'clearEnemy'; role: Role }
  /** Échange le pick allié et le pick ennemi d'un rôle (saisie du mauvais côté, ou vue de l'autre équipe). */
  | { type: 'swapRole'; role: Role }
  | { type: 'addBan'; side: Side; champion: string }
  | { type: 'removeBan'; side: Side; champion: string }
  | { type: 'assignPlayer'; role: Role; player: string | null }
  | { type: 'select'; role: Role; champion: string }
  | { type: 'reset' }
  /** Remplace la draft sans historique (chargement de l'état de départ). */
  | { type: 'load'; draft: DraftState }
  /** Draft lue dans le client LoL (voir `applyClientDraft`), sans historique. */
  | { type: 'syncClient'; draft: DraftState; hover: Partial<Record<Role, string>>; order?: ClientOrder; picking?: ClientOrder; side?: 'blue' | 'red' | null }
  | { type: 'undo' }
  | { type: 'dismissToast' };

const HISTORY_LIMIT = 50;

export const createSession = (draft: DraftState): DraftSession => ({ draft, selected: {}, history: [], toast: null, hover: {}, order: null, picking: { ally: [], enemy: [] }, side: null });

const commit = (s: DraftSession, message: ActionMessage, draft: DraftState, selected = s.selected): DraftSession => ({
  ...s,
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
    case 'swapRole': {
      const ally = d.ally[a.role];
      const enemy = d.enemy[a.role];
      if (!ally && !enemy) return s;
      const { [a.role]: _, ...selected } = s.selected;
      return commit(s, { code: 'SWAPPED', role: a.role }, { ...d, ally: { ...d.ally, [a.role]: enemy }, enemy: { ...d.enemy, [a.role]: ally } }, selected);
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
    case 'load':
      return createSession(a.draft);
    case 'syncClient': {
      // Une présélection n'a plus lieu d'être sur un rôle verrouillé depuis le client.
      const selected = Object.fromEntries(Object.entries(s.selected).filter(([r]) => !a.draft.ally[r as Role]));
      // Sans ordre (fin de la sélection), l'ordre lu reste affiché avec la draft.
      // Fin de la sélection : plus personne ne choisit ; le side reste affiché avec la draft.
      return { ...s, draft: a.draft, hover: a.hover, order: a.order ?? s.order, picking: a.picking ?? { ally: [], enemy: [] }, side: a.side !== undefined ? a.side : s.side, selected };
    }
    case 'reset':
      return { ...commit(s, { code: 'RESET' }, { assign: d.assign, ally: emptySlots(), enemy: emptySlots(), allyBans: [], enemyBans: [] }, {}), hover: {}, order: null };
    case 'undo': {
      const prev = s.history[s.history.length - 1];
      if (!prev) return s;
      return { ...s, ...prev, history: s.history.slice(0, -1), toast: null };
    }
    case 'dismissToast':
      return s.toast ? { ...s, toast: null } : s;
  }
};
