import type { Evaluation } from '@draft/engine';
import { CARD_TEXT as C, fmtPct, fmtSigned } from '@draft/i18n-fr';
import { Bar, toneOf } from '../ui';

/** Grand chiffre d'une suggestion : win rate attendu (stats mesurées), sinon score sur 100 de la maquette. */
export const ScoreValue = ({ e, className }: { e: Evaluation; className: string }) =>
  e.expected ? (
    <span className={className} title={C.expectedTip(e.expected.base)}>{fmtPct(e.expected.score)}</span>
  ) : (
    <span className={className}>{e.total}</span>
  );

interface ScoreItem {
  label: string;
  value: string;
  tip: string;
  /** Couleur du chiffre (écart signé). */
  tone?: string;
  /** Barre sur 100 (score de la maquette). */
  bar?: { w: number; color: string };
}

/**
 * Détail du score. Stats mesurées : contributions en points au win rate attendu (matchups, duos, maîtrise).
 * Données d'exemple : barres Synergie, Counter et Maîtrise sur 100.
 */
export const scoreItems = (e: Evaluation): ScoreItem[] => {
  const x = e.expected;
  if (x) {
    const note = e.mastery == null ? null : e.mastery / 10;
    return [
      { label: C.matchups, value: fmtSigned(x.matchups), tone: toneOf(x.matchups), tip: C.matchupsTip },
      { label: C.duos, value: fmtSigned(x.duos), tone: toneOf(x.duos), tip: C.duosTip },
      { label: C.mastery, value: note == null ? C.masteryNone : fmtSigned(x.mastery), tone: note == null ? undefined : toneOf(x.mastery), tip: C.masteryTip(note) }
    ];
  }
  return [
    { label: C.synergy, value: String(e.synergy), tip: C.outOf100(C.synergy, e.synergy), bar: { w: e.synergy, color: 'var(--accent)' } },
    { label: C.counter, value: String(e.counter), tip: C.outOf100(C.counter, e.counter), bar: { w: e.counter, color: 'var(--ally)' } },
    e.mastery == null
      ? { label: C.mastery, value: C.masteryNone, tip: C.masteryTip(null), bar: { w: 0, color: 'var(--muted-bar)' } }
      : { label: C.mastery, value: String(e.mastery), tip: C.outOf100(C.mastery, e.mastery), bar: { w: e.mastery, color: 'var(--warn)' } }
  ];
};

/** Détail compact (cards) : libellé et valeur, barre en dessous pour le score sur 100. */
export const ScoreStats = ({ e }: { e: Evaluation }) => (
  <span className="rec-stats">
    {scoreItems(e).map((s) => (
      <span key={s.label} className="col min0" title={s.tip}>
        <span className="small muted nowrap">{s.label} <span className={'strong ' + (s.tone ?? 'text')}>{s.value}</span></span>
        {s.bar && <Bar value={s.bar.w} color={s.bar.color} />}
      </span>
    ))}
  </span>
);

/** Détail en ligne (vue liste, rôle verrouillé). */
export const ScoreLine = ({ e, barWidth }: { e: Evaluation; barWidth: number }) => (
  <>
    {scoreItems(e).map((s) => (
      <div key={s.label} className="stat-line" title={s.tip}>
        <span className="stat-label">{s.label}</span>
        {s.bar && <Bar value={s.bar.w} color={s.bar.color} width={barWidth} />}
        <span className={'strong ' + (s.tone ?? 'text')}>{s.value}</span>
      </div>
    ))}
  </>
);
