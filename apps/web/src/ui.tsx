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
  list: 'M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4v.01M2.5 8v.01M2.5 12v.01',
  grid: 'M2.5 3h4v4h-4zM9.5 3h4v4h-4zM2.5 10h4v3h-4zM9.5 10h4v3h-4z'
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

/** Durée du loader affiché avant le contenu de la fenêtre flottante. */
export const POPOVER_LOADER_MS = 300;

/**
 * Chip « vs adversaire » : survol, focus ou clic ouvre une fenêtre flottante avec l'effet de chaque ennemi
 * connu sur le counter, vis-à-vis en tête, après un loader de POPOVER_LOADER_MS. Sans matchup de lane retenu,
 * le chip résume la compo ennemie.
 */
const MatchupPopover = ({ e }: { e: Evaluation }) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const anchor = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const closeTimer = useRef<number | undefined>(undefined);
  const loadTimer = useRef<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  /** Position du loader : sous le curseur à la souris, sur le chip au clavier. */
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const rows: MatchupRow[] = [
    ...(e.matchup ? [{ ...e.matchup, label: 'Vis-à-vis', weight: 1 }] : []),
    ...e.enemyTeam.map((m) => ({ ...m, label: m.role }))
  ];
  const total = rows.reduce((s, r) => s + r.delta * r.weight, 0);
  // Seul le nom est tronqué si la place manque, jamais la valeur.
  const [name, value] = e.matchup ? ['vs ' + e.matchup.opponent, fmtPct(e.matchup.winRate)] : ['vs compo', fmtSigned(total)];
  const label = name + ' ' + value + (e.matchup ? '' : ' pts');
  const close = () => {
    window.clearTimeout(loadTimer.current);
    setLoading(false);
    setPos(null);
  };
  const open = (at?: { x: number; y: number }) => {
    window.clearTimeout(closeTimer.current);
    if (pos) return;
    const r = anchor.current?.getBoundingClientRect();
    if (!r) return;
    const width = 340;
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)) });
    setCursor(at ?? { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    setLoading(true);
    loadTimer.current = window.setTimeout(() => setLoading(false), POPOVER_LOADER_MS);
  };
  const closeSoon = () => {
    closeTimer.current = window.setTimeout(close, 120);
  };
  useEffect(() => {
    if (!pos) return;
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
  useEffect(
    () => () => {
      window.clearTimeout(closeTimer.current);
      window.clearTimeout(loadTimer.current);
    },
    []
  );

  return (
    <>
      <button
        ref={anchor}
        type="button"
        className="chip chip-info chip-btn"
        title={label}
        aria-label={label}
        aria-expanded={!!pos}
        aria-controls={pos ? panelId : undefined}
        onMouseEnter={(ev) => open({ x: ev.clientX, y: ev.clientY })}
        onMouseMove={(ev) => loading && setCursor({ x: ev.clientX, y: ev.clientY })}
        onMouseLeave={closeSoon}
        onFocus={() => open()}
        onBlur={closeSoon}
        onClick={(ev) => (pos ? close() : open(ev.detail > 0 ? { x: ev.clientX, y: ev.clientY } : undefined))}
      >
        <span className="ellipsis">{name}</span>
        <span className="nowrap">{value}</span>
      </button>
      {pos && loading && cursor &&
        createPortal(
          <div id={panelId} role="status" aria-label="Chargement" className="cursor-loader" style={{ top: cursor.y + 12, left: cursor.x + 12 }}>
            <span className="spinner" aria-hidden="true" />
          </div>,
          document.body
        )}
      {pos && !loading &&
        createPortal(
          <div
            id={panelId}
            role="group"
            aria-label={'Effet des ennemis sur le counter de ' + e.champion}
            className="popover"
            style={{ top: pos.top, left: pos.left }}
            onMouseEnter={() => open()}
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

/**
 * Win rate de partie (et de lane s'il est connu) puis matchup contre l'adversaire de lane, sur une seule ligne :
 * le nom de l'adversaire est tronqué si la place manque.
 */
export const WinRateChips = ({ e }: { e: Evaluation }) => (
  <span className="wr-line">
    <Chip title={'Win rate de partie sur ce rôle, tous adversaires' + (e.laneWinRate == null ? '' : ', puis win rate de lane')}>
      WR {fmtPct(e.gameWinRate)}{e.laneWinRate != null && <> · lane {fmtPct(e.laneWinRate)}</>}
    </Chip>
    {(e.matchup || e.enemyTeam.length > 0) && <MatchupPopover e={e} />}
  </span>
);
