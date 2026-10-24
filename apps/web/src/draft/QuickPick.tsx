import { useEffect, useMemo, useRef, useState, type Dispatch, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { availability, rolesByPlay, type DraftAction, type Side } from '@draft/engine';
import { blockedLabel, QUICK_TEXT as Q } from '@draft/i18n-fr';
import type { DraftState, Role } from '@draft/schemas';
import { launchFrom, Portrait, slotKey, useData } from '../ui';
import { filterChampions } from './ChampionPicker';

/** Champions proposés à la fois. */
const MAX_OPTIONS = 8;

interface Option {
  name: string;
  /** Rôles proposés : libres d'abord, du plus joué au moins joué. */
  roles: Role[];
  /** Indisponible (banni ou déjà pris), avec la raison. */
  why: string | null;
}

/**
 * Saisie rapide d'un pick pendant la draft : on tape le nom (raccourci « / »), Entrée place le champion sur son rôle
 * le plus joué encore libre du camp choisi ; flèches gauche et droite pour un autre rôle. Le camp reste choisi d'une
 * saisie à l'autre. Ennemi : pick ennemi ; allié : pick verrouillé.
 */
export const QuickPick = ({ draft, dispatch }: { draft: DraftState; dispatch: Dispatch<DraftAction> }) => {
  const { engine } = useData();
  const [side, setSide] = useState<Side>('enemy');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [roleIdx, setRoleIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  // « / » place le curseur dans la saisie, sauf pendant une autre saisie ou dans une fenêtre modale.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement).closest('input, textarea, select, [role="dialog"]')) return;
      e.preventDefault();
      input.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const options = useMemo((): Option[] => {
    if (!query.trim()) return [];
    const avail = availability(draft);
    const slots = side === 'enemy' ? draft.enemy : draft.ally;
    return filterChampions(engine.catalog, 'Tous', query)
      .slice(0, MAX_OPTIONS)
      .map((c) => {
        const played = rolesByPlay(engine, c.name);
        const roles = [...played.filter((r) => !slots[r]), ...played.filter((r) => slots[r])];
        const why = avail.blocked(c.name, side, roles[0] ?? 'Top');
        return { name: c.name, roles, why: why ? blockedLabel(why, side) : null };
      });
  }, [query, side, draft, engine]);

  const current = Math.min(active, options.length - 1);
  const slots = side === 'enemy' ? draft.enemy : draft.ally;

  const place = (o: Option, role: Role) => {
    if (o.why) return;
    launchFrom(document.getElementById('quick-option-' + options.indexOf(o))?.querySelector('.portrait'), slotKey(side, role, o.name));
    dispatch(side === 'enemy' ? { type: 'setEnemy', role, champion: o.name } : { type: 'lock', role, champion: o.name });
    setQuery('');
    setActive(0);
    setRoleIdx(0);
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const o = options[current];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(0, Math.min(current + (e.key === 'ArrowDown' ? 1 : -1), options.length - 1)));
      setRoleIdx(0);
    } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && o && query) {
      e.preventDefault();
      const n = o.roles.length;
      setRoleIdx((roleIdx + (e.key === 'ArrowRight' ? 1 : n - 1)) % n);
    } else if (e.key === 'Enter' && o) {
      e.preventDefault();
      place(o, o.roles[Math.min(roleIdx, o.roles.length - 1)]!);
    } else if (e.key === 'Escape') {
      setQuery('');
      input.current?.blur();
    }
  };

  return (
    <section aria-label={Q.region} className="card quick">
      <div role="group" aria-label={Q.sides} className="segmented">
        {(['enemy', 'ally'] as const).map((s) => (
          <button key={s} type="button" className={'segment quick-side is-' + s + (side === s ? ' is-on' : '')} aria-pressed={side === s} onClick={() => setSide(s)}>
            {s === 'enemy' ? Q.enemy : Q.ally}
          </button>
        ))}
      </div>
      <div className="combo grow">
        <input
          ref={input}
          className="input"
          role="combobox"
          autoComplete="off"
          aria-label={Q.input(side)}
          aria-expanded={open && options.length > 0}
          aria-controls="quick-options"
          aria-activedescendant={open && current >= 0 ? 'quick-option-' + current : undefined}
          placeholder={Q.placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setRoleIdx(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        <kbd className="quick-kbd" title={Q.shortcutTip}>{Q.shortcut}</kbd>
        {open && query.trim() && (
          <ul id="quick-options" role="listbox" aria-label={Q.options} className="combo-list">
            {options.length === 0 && <li className="combo-empty muted">{Q.notFound}</li>}
            {options.map((o, i) => {
              const chosen = i === current ? Math.min(roleIdx, o.roles.length - 1) : 0;
              return (
                <li
                  key={o.name}
                  id={'quick-option-' + i}
                  role="option"
                  aria-label={o.why ? o.name + ', ' + o.why : Q.place(o.name, o.roles[chosen]!)}
                  aria-selected={i === current}
                  aria-disabled={!!o.why}
                  className={'combo-option' + (i === current ? ' is-active' : '') + (o.why ? ' is-disabled' : '')}
                  onMouseEnter={() => setActive(i)}
                >
                  <Portrait name={o.name} size={28} />
                  <span className="grow">{o.name}</span>
                  {o.why ? (
                    <span className="small muted">{o.why}</span>
                  ) : (
                    <span className="row-gap quick-roles">
                      {o.roles.map((r, k) => (
                        <button
                          key={r}
                          type="button"
                          tabIndex={-1}
                          className={'quick-role' + (k === chosen ? ' is-on' : '')}
                          title={slots[r] ? Q.replaces(slots[r]!) : undefined}
                          // mousedown : avant le blur du champ, qui fermerait la liste.
                          onMouseDown={(e) => {
                            e.preventDefault();
                            place(o, r);
                          }}
                        >
                          {r}
                        </button>
                      ))}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};
