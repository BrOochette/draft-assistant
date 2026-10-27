import { useMemo, useState, type Dispatch, type ReactNode } from 'react';
import { availability, MAX_BANS, type DraftAction, type DraftResult, type Evaluation, type PhaseResult, type Side, type TeamHighlights } from '@draft/engine';
import {
  BAN_BLOCKED_LABEL,
  BANS_TEXT as B,
  blockedLabel,
  CARD_TEXT as C,
  COMPO_TEXT as CT,
  CRITERION_LABEL,
  CRITERION_TIP,
  DRAFT_TEXT as D,
  fmtSigned,
  PHASE_SHORT,
  phaseTitle,
  SCALING_VERDICT_LABEL,
  VIEW_TEXT as T,
  VERDICT_LABEL,
  allyReadText,
  fmt1,
  fmtScal
} from '@draft/i18n-fr';
import type { DraftState, Role } from '@draft/schemas';
import { Icon, Portrait, useData } from '../ui';
import { ChampionPicker, filterChampions, RoleFilter, type RoleFilterValue } from '../draft/ChampionPicker';

// Briques compactes communes aux mises en page de la page test.

type Target = { kind: 'pick'; side: Side; role: Role } | { kind: 'ban'; side: Side };

/** Sélecteur manuel (pick d'un rôle ou ban), dans la fenêtre modale existante. */
export const usePicker = (draft: DraftState, dispatch: Dispatch<DraftAction>) => {
  const { engine } = useData();
  const [target, setTarget] = useState<Target | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RoleFilterValue>('Tous');

  const open = (t: Target) => {
    setTarget(t);
    setQuery('');
    setFilter(t.kind === 'pick' ? t.role : 'Tous');
  };

  const items = useMemo(() => {
    if (!target) return [];
    const avail = availability(draft);
    return filterChampions(engine.catalog, filter, query).map((c) => {
      if (target.kind === 'ban') {
        const why = avail.banBlocked(c.name);
        const full = (target.side === 'ally' ? draft.allyBans : draft.enemyBans).length >= MAX_BANS;
        return { name: c.name, note: why ? BAN_BLOCKED_LABEL[why] : c.roles[0]!, disabled: !!why || full };
      }
      const why = avail.blocked(c.name, target.side, target.role);
      return { name: c.name, note: why ? blockedLabel(why, target.side) : c.roles.includes(target.role) ? '' : c.roles[0]!, disabled: !!why };
    });
  }, [target, draft, query, filter, engine]);

  const element = target && (
    <ChampionPicker
      title={target.kind === 'ban' ? (target.side === 'ally' ? B.pickerAlly : B.pickerEnemy) : target.side === 'ally' ? D.pickerAlly(draft.assign[target.role], target.role) : D.pickerEnemy(target.role)}
      accent={target.side === 'ally' ? 'var(--ally)' : 'var(--enemy)'}
      query={query}
      onQuery={setQuery}
      items={items}
      actionLabel={(n) => (target.kind === 'ban' ? B.banChampion(n) : target.side === 'ally' ? D.chooseIn(n, target.role) : D.enterIn(n, target.role))}
      onChoose={(n) => {
        if (target.kind === 'ban') dispatch({ type: 'addBan', side: target.side, champion: n });
        else dispatch(target.side === 'ally' ? { type: 'lock', role: target.role, champion: n } : { type: 'setEnemy', role: target.role, champion: n });
        setTarget(null);
      }}
      onClose={() => setTarget(null)}
      filters={<RoleFilter value={filter} onChange={setFilter} />}
    />
  );
  return { open, element };
};

/** Bans d'un camp : portrait barré (un clic retire), « + » pour ajouter. */
export const BanStrip = ({ draft, side, size, dispatch, onAdd }: { draft: DraftState; side: Side; size: number; dispatch: Dispatch<DraftAction>; onAdd: () => void }) => {
  const list = side === 'ally' ? draft.allyBans : draft.enemyBans;
  return (
    <div role="group" aria-label={side === 'ally' ? B.allyGroup : B.enemyGroup} className="fit-bans">
      {Array.from({ length: MAX_BANS }, (_, i) => {
        const n = list[i];
        return n ? (
          <button key={n} type="button" className={'ban-slot fit-ban is-' + side} style={{ width: size, height: size }} aria-label={B.remove(n)} title={B.remove(n)} onClick={() => dispatch({ type: 'removeBan', side, champion: n })}>
            <Portrait name={n} size={size - 2} />
            <svg aria-hidden="true" className="strike" viewBox="0 0 48 48"><line x1="6" y1="42" x2="42" y2="6" /></svg>
          </button>
        ) : (
          <button key={i} type="button" className="ban-slot fit-ban is-empty" style={{ width: size, height: size }} aria-label={side === 'ally' ? B.addAlly : B.addEnemy} onClick={onAdd}>+</button>
        );
      })}
    </div>
  );
};

/** Emplacement d'un pick : portrait (survol estompé), « ? » sinon ; un clic ouvre le sélecteur, la croix retire. */
export const Face = ({ side, role, name, hover, size, onOpen, onRemove, label }: {
  side: Side; role: Role; name: string | null; hover?: string | null; size: number; onOpen: () => void; onRemove: () => void;
  /** Nom accessible du bouton, si le clic ne sert pas à la saisie manuelle. */
  label?: string;
}) => {
  const shown = name ?? hover ?? null;
  return (
    <span className="face-wrap">
      <button
        type="button"
        className={'face fit-face ' + (name ? 'is-' + side : side === 'ally' ? 'is-empty-ally' : 'is-waiting')}
        style={{ width: size, height: size }}
        aria-label={label ?? (side === 'ally' ? D.allyFace(!!name, null, role) : D.enemyFace(!!name, role))}
        title={!name && hover ? D.hoverTip(hover) : name ?? undefined}
        onClick={onOpen}
      >
        {shown ? <span className={'face-img' + (!name ? ' is-hover' : '')}><Portrait name={shown} size={size - 4} /></span> : '?'}
      </button>
      {name && (
        <button type="button" className="remove" aria-label={side === 'ally' ? D.removeAlly(name, role) : D.removeEnemy(name, role)} title={D.removeTip(name)} onClick={onRemove}>
          <Icon name="close" size={12} />
        </button>
      )}
    </span>
  );
};

/** Contributions à la note sur 20 en texte court : ennemis, alliés, maîtrise, compo (« — » : rien à mesurer). */
const contribRows = (e: Evaluation) => {
  const x = e.points.parts;
  if (!x) return [{ label: C.synergy, text: String(e.synergy), tone: '' }, { label: C.counter, text: String(e.counter), tone: '' }];
  const row = (label: string, v: number | null) => {
    const r = v == null ? 0 : Math.round(v * 10);
    return { label, text: v == null ? T.noData : fmtSigned(v), tone: v == null || r === 0 ? 'muted' : r > 0 ? 'pos-text' : 'neg-text' };
  };
  return [
    row(C.enemies, e.enemyTeam.length ? x.matchups : null),
    row(C.allies, e.allyTeam.length ? x.duos : null),
    row(C.mastery, e.mastery == null ? null : x.mastery),
    row(C.fit, x.fit)
  ];
};

export const Contribs = ({ e }: { e: Evaluation }) => (
  <span className="fit-contribs">
    {contribRows(e).map((r) => (
      <span key={r.label} className="nowrap"><span className="muted">{r.label}</span> <span className={'strong ' + r.tone}>{r.text}</span></span>
    ))}
  </span>
);

const TONE: Record<string, string> = { solid: 'pos', fair: 'info', fragile: 'warn', fix: 'neg', advantage: 'pos', even: 'plain', disadvantage: 'neg' };

/**
 * Scaling des deux compos sur les trois phases, sur 10 : une courbe par équipe, la lettre de la phase en dessous colorée
 * selon le verdict (avantage, équilibre, désavantage ; valeurs et verdict en toutes lettres dans l'infobulle de la phase). L'axe est resserré autour des valeurs (au moins 3 points d'amplitude) pour
 * que les écarts se lisent ; la valeur de chaque point est écrite au-dessus.
 */
export const ScalingChart = ({ phases, height = 84 }: { phases: readonly PhaseResult[]; height?: number }) => {
  const W = 180;
  const top = 12;
  const bottom = height - 16;
  const values = phases.flatMap((p) => [p.ally * 2, p.enemy * 2]);
  const mid = (Math.max(...values) + Math.min(...values)) / 2;
  const half = Math.max(1.5, (Math.max(...values) - Math.min(...values)) / 2 + 0.5);
  const lo = Math.max(1, Math.min(10 - 2 * half, mid - half));
  const hi = lo + 2 * half;
  const x = (i: number) => 18 + i * ((W - 36) / 2);
  const y = (v: number) => bottom - ((v * 2 - lo) / (hi - lo)) * (bottom - top);
  const line = (k: 'ally' | 'enemy') => phases.map((p, i) => x(i) + ',' + y(p[k])).join(' ');
  return (
    <svg className="scaling-chart" viewBox={'0 0 ' + W + ' ' + height} role="img" aria-label={CT.scalingSection}>
      <line className="sc-grid" x1={8} x2={W - 8} y1={top} y2={top} />
      <line className="sc-grid" x1={8} x2={W - 8} y1={bottom} y2={bottom} />
      <polyline className="sc-line is-enemy" points={line('enemy')} />
      <polyline className="sc-line is-ally" points={line('ally')} />
      {phases.map((p, i) => (
        <g key={p.phase} className="sc-phase" data-tip={CT.scalingChart(phaseTitle(p.phase), fmtScal(p.ally), fmtScal(p.enemy)) + ' · ' + SCALING_VERDICT_LABEL[p.verdict]}>
          {/* Zone de survol de la phase entière (infobulle). */}
          <rect className="sc-hit" x={x(i) - 30} y={0} width={60} height={height} />
          <circle className="sc-dot is-enemy" cx={x(i)} cy={y(p.enemy)} r={3} />
          <circle className="sc-dot is-ally" cx={x(i)} cy={y(p.ally)} r={3.5} />
          <text className="sc-value is-ally" x={x(i)} y={y(p.ally) + (p.ally >= p.enemy ? -6 : 12)} textAnchor="middle">{fmtScal(p.ally)}</text>
          <text className="sc-value is-enemy" x={x(i)} y={y(p.enemy) + (p.enemy > p.ally ? -6 : 12)} textAnchor="middle">{fmtScal(p.enemy)}</text>
          <text className={'sc-label is-' + p.verdict} x={x(i)} y={height - 3} textAnchor="middle">{PHASE_SHORT[p.phase]}</text>
        </g>
      ))}
    </svg>
  );
};

/**
 * Faits marquants d'une équipe : meilleur et pire matchup, meilleur et pire duo (effet pondéré en points), pick le plus
 * fort et le plus faible (note sur 20). `alerts` : lignes de lecture à garder en plus (dégâts soutenus).
 */
export const Highlights = ({ h, alerts = [] }: { h: TeamHighlights; alerts?: string[] }) => {
  const tone = (v: number) => (Math.round(v * 10) > 0 ? 'pos-text' : Math.round(v * 10) < 0 ? 'neg-text' : 'muted');
  const rows: { label: string; what: string; value: string; tone: string; tip?: string }[] = [];
  const pair = (label: string, p: TeamHighlights['bestMatchup'], text: (a: string, b: string) => string) =>
    p && rows.push({ label, what: text(p.champion, p.other), value: fmtSigned(p.effect), tone: tone(p.effect), tip: CT.effectTip });
  pair(CT.bestMatchup, h.bestMatchup, CT.pairVs);
  pair(CT.worstMatchup, h.worstMatchup, CT.pairVs);
  pair(CT.bestDuo, h.bestDuo, CT.pairWith);
  pair(CT.worstDuo, h.worstDuo, CT.pairWith);
  if (h.strongest) rows.push({ label: CT.strongest, what: h.strongest.champion, value: fmt1(h.strongest.points) + C.outOf20, tone: '' });
  if (h.weakest) rows.push({ label: CT.weakest, what: h.weakest.champion, value: fmt1(h.weakest.points) + C.outOf20, tone: '' });
  if (!rows.length && !alerts.length) return <span className="small muted">{CT.noHighlights}</span>;
  return (
    <dl className="highlights">
      {rows.map((r) => (
        <div key={r.label} className="highlight" title={r.tip}>
          <dt className="small muted">{r.label}</dt>
          <dd className="small"><span className="ellipsis">{r.what}</span> <span className={'strong ' + r.tone}>{r.value}</span></dd>
        </div>
      ))}
      {alerts.map((a) => <div key={a} className="highlight is-alert"><dd className="small neg-text">- {a}</dd></div>)}
    </dl>
  );
};

/** Deux barres fines, alliée et ennemie, sur 100. */
const Pair = ({ a, b }: { a: number; b: number }) => (
  <span className="fit-pair" aria-hidden="true">
    <span className="fit-bar"><span style={{ width: a + '%', background: 'var(--ally)' }} /></span>
    <span className="fit-bar"><span style={{ width: b + '%', background: 'var(--enemy)' }} /></span>
  </span>
);

/** Analyse de compo resserrée : notes, 5 critères, scaling par phase, lecture de ta compo. */
/** Lecture à garder hors des faits marquants : pas de dégâts soutenus face à la frontline ennemie. */
export const sustainedAlerts = (result: DraftResult): string[] => result.allyRead.filter((x) => x.code === 'NO_SUSTAINED').map(allyReadText);

export const CompoCompact = ({ result, horizontal = false }: { result: DraftResult; horizontal?: boolean }) => {
  const { ally, enemy } = result.composition;
  // Sans pick connu d'un côté, la note vaut 0 et le verdict ne dit rien : il n'est pas affiché.
  const picks = { ally: result.roles.filter((r) => r.allyPick).length, enemy: result.roles.filter((r) => r.enemyPick).length };
  const score = (label: string, cls: string, s: typeof ally, known: number) => (
    <span className="fit-team" data-testid={cls === 'ally-text' ? 'ally-compo' : 'enemy-compo'}>
      <span className={'eyebrow ' + cls}>{label}</span>
      <span className={'fit-big' + (known ? ' tone-' + TONE[s.verdict] : '')} data-testid="compo-score">{s.total}<span className="score-unit">{CT.unit100}</span></span>
      {known > 0 && <span className={'chip chip-' + TONE[s.verdict]} data-testid="compo-verdict">{VERDICT_LABEL[s.verdict]}</span>}
    </span>
  );
  const block = (children: ReactNode, label: string) => <section aria-label={label} className="fit-block">{children}</section>;
  return (
    <div className={'fit-compo' + (horizontal ? ' is-horizontal' : '')}>
      {block(<div className="fit-scores">{score(CT.ally, 'ally-text', ally, picks.ally)}{score(CT.enemy, 'enemy-text', enemy, picks.enemy)}</div>, CT.scores)}
      {block(
        ally.criteria.map((c, i) => {
          const e = enemy.criteria[i]!;
          return (
            <div key={c.key} className="fit-crit" title={CRITERION_TIP[c.key] + ' · ' + CT.allies + ' ' + c.value + ', ' + CT.enemies + ' ' + e.value}>
              <span className="small">{CRITERION_LABEL[c.key]}</span>
              <Pair a={c.value} b={e.value} />
            </div>
          );
        }),
        CT.scores
      )}
      {block(
        <>
          <span className="small strong">{CT.scaling}</span>
          <ScalingChart phases={result.scaling} />
        </>,
        CT.scalingSection
      )}
      {block(<><span className="small strong">{CT.highlights}</span><Highlights h={result.highlights.ally} alerts={sustainedAlerts(result)} /></>, CT.highlights)}
    </div>
  );
};
