import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ROLES, type Champion, type Role } from '@draft/schemas';
import { Icon, Portrait } from '../ui';

export type RoleFilterValue = Role | 'Tous';

/** Champions du catalogue pour un filtre de rôle (« Tous » : ordre alphabétique) et une recherche. */
export const filterChampions = (catalog: ReadonlyMap<string, Champion>, filter: RoleFilterValue, query: string): Champion[] => {
  const q = query.trim().toLowerCase();
  const all = [...catalog.values()].filter((c) => !q || c.name.toLowerCase().includes(q));
  return filter === 'Tous'
    ? all.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    : all.filter((c) => c.roles.includes(filter));
};

export const RoleFilter = ({ value, onChange }: { value: RoleFilterValue; onChange: (v: RoleFilterValue) => void }) => (
  <div role="group" aria-label="Filtrer par rôle" className="row-gap wrap">
    {(['Tous', ...ROLES] as const).map((r) => (
      <button key={r} type="button" className={'btn btn-toggle' + (value === r ? ' is-on' : '')} aria-pressed={value === r} onClick={() => onChange(r)}>{r}</button>
    ))}
  </div>
);

export interface PickerItem {
  name: string;
  /** Raison d'indisponibilité, « Actuel », ou une info (rôle). */
  note: string;
  disabled: boolean;
  current?: boolean;
}

interface Props {
  title: string;
  accent: string;
  query: string;
  onQuery: (q: string) => void;
  items: PickerItem[];
  onChoose: (name: string) => void;
  onClose: () => void;
  actionLabel: (name: string) => string;
  actions?: ReactNode;
  filters?: ReactNode;
  footer?: ReactNode;
}

/** Sélecteur manuel avec recherche, dans une fenêtre modale. Les champions indisponibles sont grisés avec leur raison. */
export const ChampionPicker = ({ title, accent, query, onQuery, items, onChoose, onClose, actionLabel, actions, filters, footer }: Props) => {
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    input.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !dialog.current) return;
    // Garde le focus dans la fenêtre.
    const focusable = [...dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled), input')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  };

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} className="modal picker" style={{ borderColor: accent }} onKeyDown={onKeyDown}>
        <div className="picker-head">
          <h2 id={titleId} className="h3">{title}</h2>
          <div className="row-gap">
            {actions}
            <button type="button" className="icon-btn" aria-label="Fermer" onClick={onClose}><Icon name="close" size={18} /></button>
          </div>
        </div>
        <div className="row-gap wrap">
          <input
            ref={input}
            type="text"
            className="input grow"
            aria-label="Rechercher un champion"
            placeholder="Rechercher un champion"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
          {filters}
        </div>
        <div className="picker-grid">
          {items.map((c) => (
            <button
              key={c.name}
              type="button"
              className={'picker-item' + (c.current ? ' is-current' : '')}
              disabled={c.disabled}
              aria-label={c.disabled ? c.name + ', indisponible : ' + c.note : actionLabel(c.name)}
              onClick={() => onChoose(c.name)}
            >
              <Portrait name={c.name} size={44} />
              <span className="strong small">{c.name}</span>
              <span className="muted small">{c.note}</span>
            </button>
          ))}
        </div>
        {items.length === 0 && <span className="muted small">Aucun champion trouvé.</span>}
        {footer}
      </div>
    </div>,
    document.body
  );
};
