import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  safePolygon,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  type OpenChangeReason
} from '@floating-ui/react';
import { POPOVER_TEXT } from '@draft/i18n-fr';

/** Durée du loader affiché sous le curseur avant le contenu de la fenêtre flottante. */
export const POPOVER_LOADER_MS = 300;

interface Props {
  /** Partie du libellé tronquée si la place manque. */
  name: string;
  /** Valeur jamais tronquée. */
  value: string;
  /** Nom accessible du chip. */
  label: string;
  /** Nom accessible de la fenêtre. */
  panelLabel: string;
  children: ReactNode;
}

/**
 * Chip qui ouvre une fenêtre flottante au survol, au focus ou au clic (positionnement, fermeture à l'Échap ou au clic
 * extérieur : @floating-ui/react). Au survol, un loader de POPOVER_LOADER_MS s'affiche d'abord sous le curseur ;
 * un clic ouvre tout de suite, garde la fenêtre ouverte, et un second clic la ferme.
 */
export const FloatingChip = ({ name, value, label, panelLabel, children }: Props) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const loadTimer = useRef<number | undefined>(undefined);
  const panelId = useId();

  const onOpenChange = (next: boolean, _event?: Event, reason?: OpenChangeReason) => {
    window.clearTimeout(loadTimer.current);
    setOpen(next);
    if (next && reason === 'hover') {
      setLoading(true);
      loadTimer.current = window.setTimeout(() => setLoading(false), POPOVER_LOADER_MS);
    } else setLoading(false);
  };
  useEffect(() => () => window.clearTimeout(loadTimer.current), []);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange,
    placement: 'bottom-start',
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    // Pendant le loader, quitter le chip ferme tout de suite ; ensuite, la souris peut rejoindre la fenêtre.
    useHover(context, { handleClose: loading ? null : safePolygon() }),
    // Ouverte au survol, le clic la garde (et saute le loader, voir onClick) ; un second clic la ferme.
    useClick(context, { stickIfOpen: true }),
    useFocus(context),
    useDismiss(context)
  ]);

  const follow = (x: number, y: number) => setCursor({ x, y });

  return (
    <>
      <button
        ref={refs.setReference}
        type="button"
        className="chip chip-info chip-btn"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        {...getReferenceProps({
          onMouseEnter: (ev) => follow(ev.clientX, ev.clientY),
          onMouseMove: (ev) => loading && follow(ev.clientX, ev.clientY),
          onFocus: (ev) => {
            const r = ev.currentTarget.getBoundingClientRect();
            follow(r.left + r.width / 2, r.top + r.height / 2);
          },
          onClick: () => {
            window.clearTimeout(loadTimer.current);
            setLoading(false);
          }
        })}
      >
        <span className="ellipsis">{name}</span>
        <span className="nowrap">{value}</span>
      </button>
      {open && (
        <FloatingPortal>
          {loading && cursor ? (
            <div id={panelId} role="status" aria-label={POPOVER_TEXT.loading} className="cursor-loader" style={{ top: cursor.y + 12, left: cursor.x + 12 }}>
              <span className="spinner" aria-hidden="true" />
            </div>
          ) : (
            <div ref={refs.setFloating} id={panelId} role="group" aria-label={panelLabel} className="popover" style={floatingStyles} {...getFloatingProps()}>
              {children}
            </div>
          )}
        </FloatingPortal>
      )}
    </>
  );
};
