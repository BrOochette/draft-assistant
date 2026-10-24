import type { Evaluation } from '@draft/engine';
import { CARD_TEXT as C, formatReason, POOL_TAG } from '@draft/i18n-fr';
import type { Role } from '@draft/schemas';
import { Chip, Icon, Portrait, ScalingBars, WinRateChips } from '../ui';
import { ScoreLine, ScoreStats, ScoreValue } from './score';

export const ReasonChip = ({ r }: { r: Parameters<typeof formatReason>[0] }) => (
  <Chip tone={r.sign === '+' ? 'pos' : 'neg'}>{formatReason(r)}</Chip>
);

export const SampleText = ({ e }: { e: Evaluation }) => (
  <span className={'small ' + (e.lowSample ? 'warn-text' : 'muted')} title={C.sampleTip(e.games)}>{C.sample(e.games, e.lowSample)}</span>
);

const Compo = ({ e }: { e: Evaluation }) => <span className="delta" title={C.compoTip}>{C.compo(e.compoDelta)}</span>;

interface CardProps {
  e: Evaluation;
  rank: number;
  role: Role;
  /** Win rate moyen du rôle (stats mesurées), repère de couleur du score. */
  avg: number | null;
  selected: boolean;
  onSelect: () => void;
  onLock: () => void;
}

/**
 * Card de suggestion : le cadenas en haut à droite verrouille le champion en un clic. Il apparaît au survol,
 * au clavier, ou reste affiché quand la card est présélectionnée par un clic.
 */
export const RecCard = ({ e, rank, role, avg, selected, onSelect, onLock }: CardProps) => (
  <li
    className={'rec' + (selected ? ' is-selected' : '')}
    role="group"
    aria-label={C.group(e.champion, e.expected?.score ?? null, e.total, selected)}
    onClick={(ev) => !(ev.target as Element).closest('button') && onSelect()}
  >
    <button type="button" className="rec-lock" aria-label={C.lock(e.champion, role)} title={C.lockTip} onClick={onLock}>
      <Icon name="lock" size={16} />
    </button>
    <div className="rec-body">
      <span className="rec-top">
        <span className="rec-face">
          <Portrait name={e.champion} size={56} />
          <span className={'rank' + (rank === 1 ? ' is-first' : '')}>{rank}</span>
        </span>
        <span className="col">
          <ScoreValue e={e} className="score" avg={avg} best={rank === 1} />
          <Compo e={e} />
        </span>
      </span>
      <ScoreStats e={e} />
    </div>
    <div className="row-gap wrap rec-chips">
      <WinRateChips e={e} />
      {e.lowSample && <Chip tone="warn" title={C.sampleTip(e.games)}><Icon name="warn" />{C.lowSample}</Chip>}
    </div>
  </li>
);

interface DetailProps {
  e: Evaluation;
  role: Role;
  avg: number | null;
  best: boolean;
  selected: boolean;
  secondary?: boolean;
  onLock: () => void;
}

/** Ligne de la vue liste : nom, tag, score, raisons, détail du score, scaling et chips. */
export const DetailItem = ({ e, role, avg, best, selected, secondary = false, onLock }: DetailProps) => (
  <div className={'detail' + (selected ? ' is-selected' : '')}>
    <div className="row-gap wrap center">
      <Portrait name={e.champion} size={48} label={e.champion} />
      <div className="row-gap wrap center grow min0">
        <span className="detail-name">{e.champion}</span>
        {secondary && e.laneShare != null
          ? <Chip title={C.secondaryTip(role)}>{C.secondary(e.laneShare)}</Chip>
          : <Chip tone={e.pool === 'out' ? 'warn' : 'plain'}>{POOL_TAG[e.pool]}</Chip>}
      </div>
      <div className="row-gap baseline">
        <ScoreValue e={e} className="score-md" avg={avg} best={best} />
        <Compo e={e} />
      </div>
      <button type="button" className="btn btn-accent" aria-label={C.lock(e.champion, role)} onClick={onLock}>{C.lockButton}</button>
    </div>
    <div className="row-gap wrap">
      {e.reasons.slice(0, 3).map((r, i) => <ReasonChip key={i} r={r} />)}
    </div>
    <div className="row-gap wrap center gap-lg">
      <ScoreLine e={e} barWidth={64} />
      <ScalingBars scaling={e.scaling} />
      {/* Chips et nombre de parties dans un même groupe : écarts égaux entre eux. */}
      <span className="row-gap wrap chip-group">
        <WinRateChips e={e} />
        <SampleText e={e} />
      </span>
    </div>
  </div>
);
