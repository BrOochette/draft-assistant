import type { RoleResult } from '@draft/engine';
import { DRAFT_TEXT as D, formatReason } from '@draft/i18n-fr';
import type { Note } from '@draft/schemas';
import { DetailItem } from './RecCard';

const lockedChips = (row: RoleResult): { sign: '+' | '-' | null; text: string }[] => {
  const l = row.locked!;
  const notes = (list: Note[]) => list.map((n) => ({ sign: n.sign, text: formatReason(n) }));
  if (l.info) {
    const matchup = l.matchupNotes ? notes(l.matchupNotes) : [{ sign: null, text: row.enemyPick ? D.noMatchupNotes : D.unknownOpponent }];
    return [...matchup, ...notes(l.info)];
  }
  return [...(l.matchupNotes ? notes(l.matchupNotes) : []), ...l.reasons.slice(0, 3).map((r) => ({ sign: r.sign, text: formatReason(r) }))];
};

/** Résumé d'un rôle verrouillé : même ligne que la vue liste, sans bouton, avec les notes de matchup en pied. */
export const LockedSummary = ({ row }: { row: RoleResult }) => (
  <DetailItem e={row.locked!} role={row.role} avg={row.averageWr} best selected={false} chips={lockedChips(row)} />
);
