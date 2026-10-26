import { useMemo, useState } from 'react';
import { MAIN_ROLE_SHARE, type Evaluation, type RoleResult, type SuggestionMode } from '@draft/engine';
import { CARD_TEXT as C, DRAFT_TEXT as D, POOL_TAG, VIEW_TEXT as V } from '@draft/i18n-fr';
import { Chip, Icon, Portrait, ScalingBars, WinRateChips } from '../ui';
import { ReasonChip, SampleText } from '../draft/RecCard';
import { RoleModes } from '../draft/modes';
import { ScoreStats, ScoreSub, ScoreValue } from '../draft/score';
import { Splash } from './Cards';
import { Contribs } from './parts';

// Centre de la vue client : le rôle choisi, avec ses champions du pool en cartes détaillées
// et, à côté, la liste des autres (hors pool, ou sans pool le reste du rôle et les rôles secondaires).

/** Champions du pool affichés en cartes ; sans pool, les premiers du rôle. */
const NO_POOL_CARDS = 6;

/**
 * Carte détaillée : identité, score, contributions, chips WR/vs/avec, raisons, scaling, échantillon.
 * Suggestion : rang et bouton « Verrouiller ». Pick verrouillé : rôle et joueur à la place.
 */
export const FocusCard = ({ e, row, rank, onLock, highlight = false, compact = false }: {
  e: Evaluation; row: RoleResult; rank?: number; onLock?: () => void; highlight?: boolean;
  /** Version basse (les deux équipes en fin de draft) : petit portrait, sans les raisons. */
  compact?: boolean;
}) => (
  <article className={'fcard' + (rank === 1 || highlight ? ' is-first' : '') + (compact ? ' is-compact' : '')} aria-label={C.group(e.champion, e.points.value, false)}>
    <Splash name={e.champion} />
    <div className="fcard-top">
      <span className="rec-face">
        <Portrait name={e.champion} size={compact ? 44 : 56} />
        {rank != null && <span className={'rank' + (rank === 1 ? ' is-first' : '')}>{rank}</span>}
      </span>
      <span className="col gap-4 min0 grow">
        {rank == null && !compact && <span className="role-name">{row.role}</span>}
        <span className="fcard-name">{e.champion}</span>
        {rank == null && <span className="small muted ellipsis">{row.player ?? D.noPlayer}</span>}
        <ScalingBars scaling={e.scaling} />
      </span>
      <span className="col fcard-score">
        <ScoreValue e={e} className="score-md" avg={row.averageWr} best={rank === 1} />
        <ScoreSub e={e} />
      </span>
    </div>
    <ScoreStats e={e} />
    <div className="fcard-chips">
      <WinRateChips e={e} />
      {e.lowSample && <Chip tone="warn" title={C.sampleTip(e.games)}><Icon name="warn" />{C.lowSample}</Chip>}
    </div>
    {!compact && e.reasons.length > 0 && <div className="fcard-chips">{e.reasons.slice(0, 3).map((r, i) => <ReasonChip key={i} r={r} />)}</div>}
    <div className="fcard-foot">
      <SampleText e={e} />
      {onLock
        ? <button type="button" className="btn btn-sm btn-lock" aria-label={C.lock(e.champion, row.role)} onClick={onLock}><Icon name="lock" size={14} />{C.lockButton}</button>
        : <span className="state state-locked"><Icon name="lock" />{D.locked}</span>}
    </div>
  </article>
);

type Kind = 'pool' | 'out' | 'secondary';

/** Ligne compacte de la liste : portrait, nom, score, contributions ; le cadenas verrouille. */
const OtherRow = ({ e, row, kind, onLock }: { e: Evaluation; row: RoleResult; kind: Kind; onLock: () => void }) => (
  <li className="orow">
    <Splash name={e.champion} />
    <Portrait name={e.champion} size={36} />
    <span className="col min0 grow">
      <span className="row-gap orow-head">
        <span className="strong ellipsis">{e.champion}</span>
        {kind === 'secondary' && e.laneShare != null && <span className="small muted nowrap" title={D.secondaryTip(MAIN_ROLE_SHARE, row.role)}>{C.secondary(e.laneShare)}</span>}
        {e.lowSample && <span className="warn-text" title={C.sampleTip(e.games)}><Icon name="warn" /></span>}
      </span>
      <Contribs e={e} />
    </span>
    <ScoreValue e={e} className="orow-score" avg={row.averageWr} />
    <button type="button" className="btn-lock orow-lock" aria-label={C.lock(e.champion, row.role)} title={C.lockTip} onClick={onLock}>
      <Icon name="lock" size={14} />
    </button>
  </li>
);

/** Rôle choisi déjà verrouillé : les picks verrouillés de ton équipe en cartes détaillées, celui choisi en avant. */
export const LockedPanel = ({ rows, current }: { rows: RoleResult[]; current: RoleResult }) => (
  <section aria-label={D.roleRegion(current.role)} className="card fit-focus">
    <div className="fcard-grid is-team">
      {rows.flatMap((r) => (r.locked ? [<FocusCard key={r.role} e={r.locked} row={r} highlight={r.role === current.role} />] : []))}
    </div>
  </section>
);

export const FocusPanel = ({ row, onLock, onManual, mode, onModeChange }: {
  row: RoleResult;
  onLock: (champion: string) => void;
  /** Ouvre la fenêtre de choix manuel du rôle (tous les champions, avec recherche et filtre par rôle). */
  onManual: () => void;
  mode: SuggestionMode;
  onModeChange: (m: SuggestionMode) => void;
}) => {
  const [query, setQuery] = useState('');
  const lock = onLock;
  // Avec un pool : tout le pool en cartes, le hors pool dans la liste. Sans pool : les premiers en cartes, le reste en liste.
  const cards = row.hasPool ? row.inPool : row.inPool.slice(0, NO_POOL_CARDS);
  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all: { kind: Kind; list: Evaluation[] }[] = row.hasPool
      ? [{ kind: 'out', list: row.outOfPool }]
      : [{ kind: 'pool', list: row.inPool.slice(NO_POOL_CARDS) }, { kind: 'secondary', list: row.secondaryRole }];
    return all.map((s) => ({ ...s, list: q ? s.list.filter((e) => e.champion.toLowerCase().includes(q)) : s.list })).filter((s) => s.list.length);
  }, [row, query]);
  const head = (kind: Kind) =>
    kind === 'out' ? <span className="detail-head warn-text">{D.headOut}</span>
      : kind === 'secondary' ? <span className="detail-head muted" title={D.secondaryTip(MAIN_ROLE_SHARE, row.role)}>{D.headSecondary}</span>
      : <span className="detail-head accent-text">{D.headAll(row.role, !!row.player)}</span>;

  return (
    <section aria-label={D.roleRegion(row.role)} className="card fit-focus">
      <div className="row-between focus-head">
        <span className="h3">{row.role}{row.player ? ' · ' + row.player : ''}</span>
        <span className="row-gap">
          {row.note === 'POOL_EXHAUSTED' && <Chip tone="warn">{POOL_TAG.out}</Chip>}
          <RoleModes role={row.role} mode={mode} onChange={onModeChange} />
          <button type="button" className="btn btn-sm btn-manual" aria-label={V.manualIn(row.role)} title={V.manualIn(row.role)} onClick={onManual}>
            <Icon name="grid" size={14} />{V.manual}
          </button>
        </span>
      </div>
      <div className="focus-body">
        <div className="focus-cards">
          <span className="detail-head accent-text">{row.hasPool ? D.headPool : D.headAll(row.role, !!row.player)}</span>
          {cards.length === 0 && <span className="empty-box">{D.notFound}</span>}
          <div className="fcard-grid">
            {cards.map((e, i) => <FocusCard key={e.champion} e={e} row={row} rank={i + 1} onLock={() => lock(e.champion)} />)}
          </div>
        </div>
        <div className="focus-others">
          <input type="search" className="input" aria-label={D.searchIn(row.role)} placeholder={D.search} value={query} onChange={(ev) => setQuery(ev.target.value)} />
          {/* Seule cette liste défile : elle peut compter plus de cent champions. */}
          <div className="focus-list">
            {sections.length === 0 && <span className="small muted">{D.notFound}</span>}
            {sections.map((s) => (
              <div key={s.kind} className="col gap-4">
                {head(s.kind)}
                <ul className="plain-list col gap-4">
                  {s.list.map((e) => <OtherRow key={e.champion} e={e} row={row} kind={s.kind} onLock={() => lock(e.champion)} />)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
