import { pointsOfWr, type Evaluation } from '@draft/engine';
import { CARD_TEXT as C, fmt1, fmtPct, fmtSigned } from '@draft/i18n-fr';
import { Bar } from '../ui';

/** Écart (points sur 20) au-dessus de la note moyenne du rôle à partir duquel la note est mise en avant (vert). */
const GOOD_ABOVE_AVERAGE = 1.5;

/**
 * Grand chiffre d'une suggestion : note sur 20. Stats mesurées : colorée par rapport à la note moyenne du rôle (vert
 * nettement au-dessus, neutre autour, rouge en dessous). Données d'exemple : `best` met en avant la première.
 */
export const ScoreValue = ({ e, className, avg, best = false }: { e: Evaluation; className: string; avg: number | null; best?: boolean }) => {
  const p = e.points;
  if (!p.parts) {
    return (
      <span className={className + (best ? ' is-best' : '')} title={C.pointsSampleTip}>
        {C.points(p.value)}<span className="score-unit">{C.outOf20}</span>
      </span>
    );
  }
  const ref = avg == null ? null : pointsOfWr(avg);
  const tone = ref == null ? '' : p.value >= ref + GOOD_ABOVE_AVERAGE ? ' is-best' : p.value < ref ? ' is-low' : '';
  return (
    <span className={className + tone} title={C.pointsTip(ref)}>
      {C.points(p.value)}<span className="score-unit">{C.outOf20}</span>
    </span>
  );
};

/** Sous la note, avec les données d'exemple : points ajoutés à la note de compo de la maquette. Rien avec les stats mesurées. */
export const ScoreSub = ({ e }: { e: Evaluation }) =>
  e.expected ? null : <span className="delta" title={C.compoTip}>{C.compo(e.compoDelta)}</span>;

/** Écart (points sur 20) qui remplit la moitié de la barre : au-delà, la barre est pleine. */
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

type Parts = NonNullable<Evaluation['points']['parts']>;

/**
 * Contributions à la note sur 20, une ligne par effet : ennemis, alliés, maîtrise, compo (la base est dans le chip WR).
 * Chaque effet a sa barre centrée sur zéro, pour lire d'un coup d'œil ce qui fait monter ou baisser le pick. Sans
 * ennemi ou allié connu, la ligne affiche « — » (rien à mesurer), à distinguer d'un effet nul « 0,0 ».
 */
const Contributions = ({ e, x, inline = false }: { e: Evaluation; x: Parts; inline?: boolean }) => {
  const note = e.mastery == null ? null : e.mastery / 10;
  const rows = [
    { label: C.enemies, v: e.enemyTeam.length ? x.matchups : null, none: C.nobody, tip: C.enemiesTip },
    { label: C.allies, v: e.allyTeam.length ? x.duos : null, none: C.nobody, tip: C.alliesTip },
    { label: C.mastery, v: note == null ? null : x.mastery, none: C.masteryNone, tip: C.masteryTip(note) },
    { label: C.fit, v: x.fit, none: C.nobody, tip: C.fitTip }
  ];
  return (
    <span className={'contribs' + (inline ? ' contribs-inline' : '')}>
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
  e.points.parts ? (
    <Contributions e={e} x={e.points.parts} />
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
  e.points.parts ? (
    <Contributions e={e} x={e.points.parts} inline />
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
