import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './base';

/**
 * Bouton double : l'action principale, et une flèche collée qui ouvre une seconde action (par exemple la même chose en
 * fichier). Le menu se ferme au clic extérieur, à Échap ou après un choix.
 */
export const SplitButton = ({ children, title, onClick, disabled = false, more, moreLabel }: {
  children: ReactNode;
  title?: string;
  onClick: () => void;
  disabled?: boolean;
  /** Seconde action : libellé (avec icône) et effet. */
  more: { label: ReactNode; title?: string; onClick: () => void };
  /** Nom accessible de la flèche. */
  moreLabel: string;
}) => {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  return (
    <span ref={root} className="split">
      <button type="button" className="btn split-main" title={title} disabled={disabled} onClick={onClick}>{children}</button>
      <button type="button" className="btn split-more" aria-label={moreLabel} title={moreLabel} aria-haspopup="menu" aria-expanded={open} disabled={disabled} onClick={() => setOpen((v) => !v)}>
        <Icon name="chevron" size={12} />
      </button>
      {open && (
        <span role="menu" className="split-menu">
          <button type="button" role="menuitem" className="split-item" title={more.title} onClick={() => { setOpen(false); more.onClick(); }}>{more.label}</button>
        </span>
      )}
    </span>
  );
};
