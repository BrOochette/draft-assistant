import { useRef, useState } from 'react';
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  size,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useListNavigation,
  useRole
} from '@floating-ui/react';
import { DRAFT_TEXT as D } from '@draft/i18n-fr';
import type { Pools, Role } from '@draft/schemas';
import { Icon, Portrait } from '../ui';

/** Champions du pool montrés à côté d'un joueur. */
const POOL_PREVIEW = 3;

/** Teinte stable par nom : chaque joueur garde sa couleur d'avatar. */
const hueOf = (name: string) => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

export const PlayerAvatar = ({ name, size: px = 28 }: { name: string | null; size?: number }) => (
  <span
    className={'player-avatar' + (name ? '' : ' is-none')}
    style={{ width: px, height: px, fontSize: Math.round(px * 0.45), ...(name ? { background: `hsl(${hueOf(name)} 42% 32%)` } : {}) }}
    aria-hidden="true"
  >
    {name ? name[0]!.toUpperCase() : <Icon name="close" size={Math.round(px * 0.45)} />}
  </span>
);

/** Meilleurs champions du pool du joueur sur le rôle, par maîtrise. */
const topPool = (pools: Pools, player: string, role: Role) =>
  [...(pools[player]?.[role] ?? [])].sort((a, b) => b.mastery - a.mastery).slice(0, POOL_PREVIEW);

const PoolPreview = ({ pools, player, role, px }: { pools: Pools; player: string; role: Role; px: number }) => {
  const top = topPool(pools, player, role);
  if (!top.length) return <span className="small muted nowrap">{D.noPool}</span>;
  return (
    <span className="player-pool" title={D.poolTip(player, role, top.map((p) => p.champion))}>
      {top.map((p) => <Portrait key={p.champion} name={p.champion} size={px} />)}
    </span>
  );
};

interface Props {
  role: Role;
  player: string | null;
  pools: Pools;
  /** Rôle → joueur placé, pour signaler un joueur déjà pris ailleurs. */
  assign: Partial<Record<Role, string | null>>;
  onChange: (player: string | null) => void;
}

/**
 * Choix du joueur d'un rôle : bouton avec avatar et aperçu du pool, liste déroulante avec, pour chaque joueur,
 * ses meilleurs champions sur le rôle et le rôle où il est déjà placé. Clavier : flèches, Entrée, Échap.
 */
export const PlayerSelect = ({ role, player, pools, assign, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const items = useRef<(HTMLElement | null)[]>([]);
  const options: (string | null)[] = [...Object.keys(pools), null];
  const selectedIndex = options.indexOf(player);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'bottom-start',
    middleware: [
      offset(4),
      flip(),
      shift({ padding: 8 }),
      size({ apply: ({ rects, elements }) => { elements.floating.style.minWidth = rects.reference.width + 'px'; } })
    ],
    whileElementsMounted: autoUpdate
  });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    useClick(context),
    useDismiss(context),
    useRole(context, { role: 'listbox' }),
    useListNavigation(context, { listRef: items, activeIndex: active, selectedIndex, onNavigate: setActive, loop: true })
  ]);

  const choose = (p: string | null) => {
    onChange(p);
    setOpen(false);
  };
  const placedElsewhere = (p: string) => (Object.entries(assign) as [Role, string | null][]).find(([r, q]) => q === p && r !== role)?.[0];

  return (
    <>
      <button
        ref={refs.setReference}
        type="button"
        className={'player-select' + (open ? ' is-open' : '')}
        aria-label={D.playerIn(role, player)}
        {...getReferenceProps()}
      >
        <PlayerAvatar name={player} />
        <span className={'grow ellipsis strong' + (player ? '' : ' muted')}>{player ?? D.noPlayer}</span>
        {player && <PoolPreview pools={pools} player={player} role={role} px={22} />}
        <Icon name="chevron" size={14} />
      </button>
      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false}>
            <div ref={refs.setFloating} className="player-menu" style={floatingStyles} aria-label={D.playersFor(role)} {...getFloatingProps()}>
              {options.map((p, i) => {
                const elsewhere = p ? placedElsewhere(p) : undefined;
                return (
                  <div
                    key={p ?? '-'}
                    ref={(el) => { items.current[i] = el; }}
                    role="option"
                    tabIndex={active === i ? 0 : -1}
                    aria-selected={p === player}
                    className={'player-option' + (active === i ? ' is-active' : '') + (p === player ? ' is-selected' : '') + (p ? '' : ' is-none')}
                    {...getItemProps({
                      onClick: () => choose(p),
                      onKeyDown: (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          choose(p);
                        }
                      }
                    })}
                  >
                    <PlayerAvatar name={p} />
                    <span className="grow ellipsis strong">{p ?? D.noPlayer}</span>
                    {elsewhere && <span className="player-elsewhere" title={D.placedIn(elsewhere)}>{elsewhere}</span>}
                    {p && <PoolPreview pools={pools} player={p} role={role} px={26} />}
                    {p === player && <Icon name="check" size={14} />}
                  </div>
                );
              })}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
};
