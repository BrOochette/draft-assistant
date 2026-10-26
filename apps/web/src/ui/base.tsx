import { createContext, useContext, useState, type ReactNode } from 'react';
import { CARD_TEXT, PHASE_LABEL, PHASE_SHORT } from '@draft/i18n-fr';
import type { Scaling } from '@draft/schemas';
import type { AppData } from '../data';

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
  grid: 'M2.5 3h4v4h-4zM9.5 3h4v4h-4zM2.5 10h4v3h-4zM9.5 10h4v3h-4z',
  swap: 'M2.5 5.5h10M10 3l2.5 2.5L10 8M13.5 10.5h-10M6 8l-2.5 2.5L6 13',
  ban: 'M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM4.1 4.1l7.8 7.8'
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

export const ScalingBars = ({ scaling }: { scaling: Scaling }) => (
  <div className="scal" title={CARD_TEXT.scalingTip}>
    <span>{CARD_TEXT.scaling}</span>
    {scaling.map((v, i) => (
      <span key={i} className="scal-col" title={CARD_TEXT.phaseTip(PHASE_LABEL[i as 0 | 1 | 2], v)}>
        <span style={{ height: v * 4, background: v >= 4 ? 'var(--accent)' : v >= 3 ? 'var(--ally)' : 'var(--muted-bar)' }} />
        <span>{PHASE_SHORT[i as 0 | 1 | 2]}</span>
      </span>
    ))}
  </div>
);

/** Classe de couleur d'un écart signé. */
export const toneOf = (v: number) => (Math.round(v * 10) >= 0 ? 'pos-text' : 'neg-text');
