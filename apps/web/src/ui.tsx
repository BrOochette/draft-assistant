import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Evaluation } from '@draft/engine';
import { fmtInt, fmtPct, fmtSigned, PHASE_LABEL, PHASE_SHORT } from '@draft/i18n-fr';
import type { Scaling } from '@draft/schemas';
import type { AppData } from './data';

export const DataContext = createContext<AppData | null>(null);
export const useData = (): AppData => {
  const d = useContext(DataContext);
  if (!d) throw new Error('DataContext manquant');
  return d;
};

const codeOf = (n: string): string => {
  const p = n.split(' ');
  return p.length > 1 ? p[0]!.charAt(0) + p[1]!.charAt(0) : n.slice(0, 2);
};

/** Portrait local du champion, ou ses initiales si l'image manque. */
export const Portrait = ({ name, size, label }: { name: string; size: number; label?: string }) => {
  const { engine } = useData();
  const [failed, setFailed] = useState(false);
  const id = engine.catalog.get(name)?.ddragonId;
  const style = { width: size, height: size, fontSize: Math.round(size * 0.33) };
  const a11y = label ? { role: 'img', 'aria-label': label, title: label } : { 'aria-hidden': true as const };
  if (!id || failed) return <span className="portrait" style={style} {...a11y}>{codeOf(name)}</span>;
  return (
    <span className="portrait" style={style} {...a11y}>
      <img src={import.meta.env.BASE_URL + 'champions/' + id + '.png'} alt="" onError={() => setFailed(true)} />
    </span>
  );
};

const PATHS = {
  check: 'M3 8.5l3.5 3.5L13 4.5',
  circle: 'M8 3.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z',
  lock: 'M4.5 7V5.5a3.5 3.5 0 0 1 7 0V7M3.5 7h9v6.5h-9z',
  warn: 'M8 2.5l6 10.5H2zM8 7v3M8 11.5v.01',
  chevron: 'M3 6l5 5 5-5',
  close: 'M4 4l8 8M12 4L4 12',
  lane: 'M13 3L6 10M4.5 8.5l3 3M6 10L3 13M3 3l7 7M8.5 11.5l3-3M10 10l3 3',
  flag: 'M4 14V2M4 3h8l-2.5 3L12 9H4'
} as const;

export const Icon = ({ name, size = 14, rotate = false }: { name: keyof typeof PATHS; size?: number; rotate?: boolean }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" fill="none" style={rotate ? { transform: 'rotate(180deg)' } : undefined}>
    <path d={PATHS[name]} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Chip = ({ tone = 'plain', title, children }: { tone?: 'plain' | 'pos' | 'neg' | 'warn' | 'info'; title?: string; children: ReactNode }) => (
  <span className={'chip chip-' + tone} title={title}>{children}</span>
);

export const Bar = ({ value, color, width }: { value: number; color: string; width?: number }) => (
  <span className="bar" style={width ? { width } : undefined}>
    <span style={{ width: Math.max(0, Math.min(100, value)) + '%', background: color }} />
  </span>
);

export const scoreStats = (e: Evaluation) => [
  { label: 'Synergie', v: e.synergy, w: e.synergy, color: 'var(--accent)', tip: 'Synergie : ' + e.synergy + ' sur 100' },
  { label: 'Counter', v: e.counter, w: e.counter, color: 'var(--ally)', tip: 'Counter : ' + e.counter + ' sur 100' },
  e.mastery == null
    ? { label: 'Maîtrise', v: 'n/a', w: 0, color: 'var(--muted-bar)', tip: "Pas de pool pour ce rôle, la maîtrise n'entre pas dans le score" }
    : { label: 'Maîtrise', v: e.mastery, w: e.mastery, color: 'var(--warn)', tip: 'Maîtrise : ' + e.mastery + ' sur 100' }
];

export const ScalingBars = ({ scaling }: { scaling: Scaling }) => (
  <div className="scal" title="Puissance au début, au milieu et en fin de partie">
    <span>Scaling</span>
    {scaling.map((v, i) => (
      <span key={i} className="scal-col" title={PHASE_LABEL[i as 0 | 1 | 2] + ' : ' + v + ' sur 5'}>
        <span style={{ height: v * 4, background: v >= 4 ? 'var(--accent)' : v === 3 ? 'var(--ally)' : 'var(--muted-bar)' }} />
        <span>{PHASE_SHORT[i as 0 | 1 | 2]}</span>
      </span>
    ))}
  </div>
);

const weightLabel = (w: number) => (w === 1 ? '×1' : w === 0.75 ? '×3/4' : w === 0.5 ? '×1/2' : w === 0.25 ? '×1/4' : '×' + fmt2(w));
const fmt2 = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

interface MatchupRow {
  opponent: string;
  /** « Vis-à-vis » ou le rôle de l'ennemi. */
  label: string;
  winRate: number;
  games: number;
  delta: number;
  weight: number;
}

/**
 * Chip « vs adversaire » : survol, focus ou clic ouvre une fenêtre flottante avec l'effet de chaque ennemi
 * connu sur le counter, vis-à-vis en tête. Sans matchup de lane retenu, le chip résume la compo ennemie.
 */
const MatchupPopover = ({ e }: { e: Evaluation }) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const anchor = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const closeTimer = useRef<number | undefined>(undefined);
  const rows: MatchupRow[] = [
    ...(e.matchup ? [{ ...e.matchup, label: 'Vis-à-vis', weight: 1 }] : []),
    ...e.enemyTeam.map((m) => ({ ...m, label: m.role }))
  ];
  const total = rows.reduce((s, r) => s + r.delta * r.weight, 0);
  const open = () => {
    window.clearTimeout(closeTimer.current);
    const r = anchor.current?.getBoundingClientRect();
    if (!r) return;
    const width = 340;
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)) });
  };
  const closeSoon = () => {
    closeTimer.current = window.setTimeout(() => setPos(null), 120);
  };
  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && close();
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [pos]);
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  return (
    <>
      <button
        ref={anchor}
        type="button"
        className="chip chip-info chip-btn"
        aria-expanded={!!pos}
        aria-controls={pos ? panelId : undefined}
        onMouseEnter={open}
        onMouseLeave={closeSoon}
        onFocus={open}
        onBlur={closeSoon}
        onClick={() => (pos ? setPos(null) : open())}
      >
        {e.matchup ? `vs ${e.matchup.opponent} ${fmtPct(e.matchup.winRate)}` : `vs compo ennemie ${fmtSigned(total)} pts`}
      </button>
      {pos &&
        createPortal(
          <div
            id={panelId}
            role="group"
            aria-label={'Effet des ennemis sur le counter de ' + e.champion}
            className="popover"
            style={{ top: pos.top, left: pos.left }}
            onMouseEnter={open}
            onMouseLeave={closeSoon}
          >
            <div className="popover-head">
              <span className="strong">{e.champion} contre les ennemis connus</span>
              <span className={'strong ' + (total >= 0 ? 'pos-text' : 'neg-text')}>{fmtSigned(total)} pts</span>
            </div>
            <table className="popover-table">
              <thead>
                <tr><th>Ennemi</th><th>Win rate</th><th>Écart</th><th>Poids</th><th>Effet</th></tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.label}>
                    <td>
                      <span className="row-gap"><Portrait name={m.opponent} size={24} /><span><span className="strong">{m.opponent}</span><br /><span className="muted">{m.label}</span></span></span>
                    </td>
                    <td>{fmtPct(m.winRate)}<br /><span className="muted">{fmtInt(m.games)} parties</span></td>
                    <td className={m.delta >= 0 ? 'pos-text' : 'neg-text'}>{fmtSigned(m.delta)}</td>
                    <td>{weightLabel(m.weight)}</td>
                    <td className={'strong ' + (m.delta >= 0 ? 'pos-text' : 'neg-text')}>{fmtSigned(m.delta * m.weight)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="popover-foot muted">
              Écart : win rate contre cet ennemi moins win rate général du champion, en points, lissés. L'effet total s'ajoute au win rate du counter.
            </p>
          </div>,
          document.body
        )}
    </>
  );
};

/** Chips Lane et Partie, plus le matchup contre l'adversaire de lane quand il est connu. */
export const WinRateChips = ({ e }: { e: Evaluation }) => (
  <>
    {e.laneWinRate == null
      ? <Chip title="Win rate de lane indisponible avec la source actuelle"><Icon name="lane" />Lane —</Chip>
      : <Chip title="Win rate de lane"><Icon name="lane" />Lane {fmtPct(e.laneWinRate)}</Chip>}
    <Chip title="Win rate de partie sur la lane, tous adversaires"><Icon name="flag" />Partie {fmtPct(e.gameWinRate)}</Chip>
    {(e.matchup || e.enemyTeam.length > 0) && <MatchupPopover e={e} />}
  </>
);
