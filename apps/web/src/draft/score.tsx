import type { Evaluation, Expected } from '@draft/engine';
import { CARD_TEXT as C, fmt1, fmtPct, fmtSigned } from '@draft/i18n-fr';
import { Bar } from '../ui';

/** Écart au-dessus de la moyenne du rôle à partir duquel le win rate attendu est mis en avant (vert). */
const GOOD_ABOVE_AVERAGE = 1.5;

/**
 * Grand chiffre d'une suggestion : win rate attendu (stats mesurées), sinon score sur 100 de la maquette.
 * Le win rate attendu est coloré par rapport à la moyenne du rôle (environ 51,5 %) : vert nettement au-dessus,
 * neutre autour, rouge en dessous. `best` met en avant le premier score sur 100.
 */
export const ScoreValue = ({ e, className, avg, best = false }: { e: Evaluation; className: string; avg: number | null; best?: boolean }) => {
  const x = e.expected;
  if (!x) return <span className={className + (best ? ' is-best' : '')}>{e.total}</span>;
  const tone = avg == null ? '' : x.score >= avg + GOOD_ABOVE_AVERAGE ? ' is-best' : x.score < avg ? ' is-low' : '';
  return <span className={className + tone} title={C.expectedTip(x.base, avg, x.score)}>{fmtPct(x.score)}</span>;
};

/** Écart (en points) qui remplit la moitié de la barre : au-delà, la barre est pleine. */
const FULL_SCALE = 2;

/** Barre centrée sur zéro : vers la droite si positif, vers la gauche si négatif. */
const DivergingBar = ({ v }: { v: number }) => {
  const w = Math.min(Math.abs(v) / FULL_SCALE, 1) * 50;
  const sign = Math.round(v * 10);
  return (
    <span className="contrib-bar" aria-hidden="true">
      {sign !== 0 && <span className={'contrib-fill ' + (sign > 0 ? 'is-pos' : 'is-neg')} style={{ left: sign > 0 ? '50%' : 50 - w + '%', width: w + '%' }} />}
    </span>
  );
};

/** Valeur signée : verte, rouge, ou neutre à zéro. */
const signed = (v: number) => {
  const r = Math.round(v * 10);
  return { text: r === 0 ? fmt1(0) : fmtSigned(v), tone: r > 0 ? 'is-pos' : r < 0 ? 'is-neg' : 'is-zero' };
};

/**
 * Contributions au win rate attendu, une ligne par effet : base, ennemis, alliés, maîtrise. Chaque effet a sa barre
 * centrée sur zéro, pour lire d'un coup d'œil ce qui fait monter ou baisser le pick. Sans ennemi ou allié connu,
 * la ligne affiche « — » (rien à mesurer), à distinguer d'un effet nul « 0,0 ».
 */
const Contributions = ({ e, x, inline = false }: { e: Evaluation; x: Expected; inline?: boolean }) => {
  const note = e.mastery == null ? null : e.mastery / 10;
  const rows = [
    { label: C.enemies, v: e.enemyTeam.length ? x.matchups : null, none: C.nobody, tip: C.enemiesTip },
    { label: C.allies, v: e.allyTeam.length ? x.duos : null, none: C.nobody, tip: C.alliesTip },
    { label: C.mastery, v: note == null ? null : x.mastery, none: C.masteryNone, tip: C.masteryTip(note) }
  ];
  return (
    <span className={'contribs' + (inline ? ' contribs-inline' : '')}>
      <span className="contrib" title={C.baseTip(x.base)}>
        <span className="contrib-label">{C.base}</span>
        <span />
        <span className="contrib-value is-zero">{fmtPct(x.base)}</span>
      </span>
      {rows.map((r) => {
        const s = r.v == null ? { text: r.none, tone: 'is-zero' } : signed(r.v);
        return (
          <span key={r.label} className="contrib" title={r.tip}>
            <span className="contrib-label">{r.label}</span>
            <DivergingBar v={r.v ?? 0} />
            <span className={'contrib-value ' + s.tone}>{s.text}</span>
          </span>
        );
      })}
    </span>
  );
};

/** Barres Synergie, Counter et Maîtrise sur 100 (données d'exemple). */
const legacyItems = (e: Evaluation) => [
  { label: C.synergy, v: e.synergy, color: 'var(--accent)' },
  { label: C.counter, v: e.counter, color: 'var(--ally)' },
  { label: C.mastery, v: e.mastery, color: 'var(--warn)' }
];

/** Détail compact (cards) : contributions (stats mesurées) ou barres sur 100. */
export const ScoreStats = ({ e }: { e: Evaluation }) =>
  e.expected ? (
    <Contributions e={e} x={e.expected} />
  ) : (
    <span className="rec-stats">
      {legacyItems(e).map((s) => (
        <span key={s.label} className="col min0" title={s.v == null ? C.masteryTip(null) : C.outOf100(s.label, s.v)}>
          <span className="small muted nowrap">{s.label} <span className="strong text">{s.v ?? C.masteryNone}</span></span>
          <Bar value={s.v ?? 0} color={s.v == null ? 'var(--muted-bar)' : s.color} />
        </span>
      ))}
    </span>
  );

/** Détail en ligne (vue liste, rôle verrouillé). */
export const ScoreLine = ({ e, barWidth }: { e: Evaluation; barWidth: number }) =>
  e.expected ? (
    <Contributions e={e} x={e.expected} inline />
  ) : (
    <>
      {legacyItems(e).map((s) => (
        <div key={s.label} className="stat-line" title={s.v == null ? C.masteryTip(null) : C.outOf100(s.label, s.v)}>
          <span className="stat-label">{s.label}</span>
          <Bar value={s.v ?? 0} color={s.v == null ? 'var(--muted-bar)' : s.color} width={barWidth} />
          <span className="strong text">{s.v ?? C.masteryNone}</span>
        </div>
      ))}
    </>
  );
