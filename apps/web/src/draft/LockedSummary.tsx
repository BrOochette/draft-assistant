import type { RoleResult } from '@draft/engine';
import { CARD_TEXT as C, DRAFT_TEXT as D, formatReason, POOL_TAG } from '@draft/i18n-fr';
import type { Note } from '@draft/schemas';
import { Chip, ScalingBars, WinRateChips } from '../ui';
import { SampleText } from './RecCard';
import { ScoreLine, ScoreValue } from './score';

const lockedChips = (row: RoleResult): { sign: '+' | '-' | null; text: string }[] => {
  const l = row.locked!;
  const notes = (list: Note[]) => list.map((n) => ({ sign: n.sign, text: formatReason(n) }));
  if (l.info) {
    const matchup = l.matchupNotes ? notes(l.matchupNotes) : [{ sign: null, text: row.enemyPick ? D.noMatchupNotes : D.unknownOpponent }];
    return [...matchup, ...notes(l.info)];
  }
  return [...(l.matchupNotes ? notes(l.matchupNotes) : []), ...l.reasons.slice(0, 3).map((r) => ({ sign: r.sign, text: formatReason(r) }))];
};

/** Résumé d'un rôle verrouillé : score, tag, chips, détail du score, scaling et raisons. */
export const LockedSummary = ({ row }: { row: RoleResult }) => {
  const l = row.locked!;
  return (
    <>
      <div className="row-gap wrap center">
        <ScoreValue e={l} className="score is-best" />
        <span className="delta" title={C.compoTip}>{C.compo(l.compoDelta)}</span>
        <Chip tone={l.pool === 'out' ? 'warn' : 'plain'}>{POOL_TAG[l.pool]}</Chip>
        <WinRateChips e={l} />
        <SampleText e={l} />
      </div>
      <div className="row-gap wrap center gap-lg">
        <ScoreLine e={l} barWidth={80} />
        <ScalingBars scaling={l.scaling} />
      </div>
      <div className="row-gap wrap">
        {lockedChips(row).map((c, i) => (
          <Chip key={i} tone={c.sign === '+' ? 'pos' : c.sign === '-' ? 'neg' : 'plain'}>{c.text}</Chip>
        ))}
      </div>
    </>
  );
};
