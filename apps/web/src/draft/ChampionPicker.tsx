import { useEffect, useRef, type ReactNode } from 'react';
import { Portrait } from '../ui';

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

/** Sélecteur manuel avec recherche. Les champions indisponibles sont grisés avec leur raison. */
export const ChampionPicker = ({ title, accent, query, onQuery, items, onChoose, onClose, actionLabel, actions, filters, footer }: Props) => {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  return (
    <div role="group" aria-label={title} className="picker" style={{ borderColor: accent }}>
      <div className="picker-head">
        <span className="strong">{title}</span>
        <div className="row-gap">
          {actions}
          <button type="button" className="btn" onClick={onClose}>Fermer</button>
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
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
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
  );
};
