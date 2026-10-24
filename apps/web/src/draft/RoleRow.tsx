import { useMemo, useRef, useState, type Dispatch } from 'react';
import { availability, type DraftAction, type RoleResult, type Side, type SuggestionMode } from '@draft/engine';
import { blockedLabel, DRAFT_TEXT as D, recNoteText, SUGGESTION_MODE_SHORT, SUGGESTION_MODE_TIP } from '@draft/i18n-fr';
import type { DraftState } from '@draft/schemas';
import { Icon, useData } from '../ui';
import { ChampionPicker, filterChampions, RoleFilter, type RoleFilterValue } from './ChampionPicker';
import { LockedSummary } from './LockedSummary';
import { RecCard } from './RecCard';
import { RoleSide } from './RoleSide';
import { SuggestionList } from './SuggestionList';

interface Props {
  row: RoleResult;
  draft: DraftState;
  players: string[];
  selected: string | undefined;
  mode: SuggestionMode;
  onModeChange: (m: SuggestionMode) => void;
  dispatch: Dispatch<DraftAction>;
}

const MODES: SuggestionMode[] = ['mix', 'synergy', 'counter'];

/** Ligne d'un rôle : colonne des picks, puis suggestions (3 cards ou liste) ou résumé du pick verrouillé. */
export const RoleRow = ({ row, draft, players, selected, mode, onModeChange, dispatch }: Props) => {
  const { engine } = useData();
  const { role, player, allyPick: ally, enemyPick: enemy } = row;
  const [expanded, setExpanded] = useState(false);
  const [picker, setPicker] = useState<Side | null>(null);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilterValue>(role);
  const section = useRef<HTMLElement>(null);

  const openPicker = (side: Side) => {
    setPicker(picker === side ? null : side);
    setQuery('');
    setRoleFilter(role);
  };

  const items = useMemo(() => {
    if (!picker) return [];
    const avail = availability(draft);
    const current = picker === 'ally' ? ally : enemy;
    return filterChampions(engine.catalog, roleFilter, query).map((c) => {
      const why = avail.blocked(c.name, picker, role);
      const isCurrent = c.name === current;
      // Hors rôle : on affiche le rôle principal du champion.
      const note = isCurrent ? D.current : why ? blockedLabel(why, picker) : c.roles.includes(role) ? '' : c.roles[0]!;
      return { name: c.name, note, disabled: !!why, current: isCurrent };
    });
  }, [picker, query, roleFilter, draft, engine, role, ally, enemy]);

  const lock = (champion: string) => {
    dispatch({ type: 'lock', role, champion });
    setPicker(null);
  };

  const scrollToTop = () => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    section.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    section.current?.focus({ preventScroll: true });
  };

  return (
    <section ref={section} tabIndex={-1} className="card role-row" aria-label={D.roleRegion(role)}>
      <div className="role-main">
        <RoleSide row={row} players={players} picker={picker} onOpenPicker={openPicker} dispatch={dispatch} />

        <div className="role-center">
          {!ally && (
            <>
              <div className="row-between wrap">
                {/* Seul le pool épuisé est signalé : sans pool, l'avertissement de la colonne de gauche suffit. */}
                <span className="small soft">{row.note === 'POOL_EXHAUSTED' && player ? recNoteText(row.note, player, role) : ''}</span>
                <div className="row-gap wrap">
                  {/* Mode de suggestion propre au rôle ; le sélecteur global règle les 5 d'un coup. */}
                  <div role="group" aria-label={D.roleModes(role)} className="segmented segmented-sm">
                    {MODES.map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={'segment' + (mode === m ? ' is-on' : '')}
                        aria-pressed={mode === m}
                        aria-label={D.inRole(SUGGESTION_MODE_SHORT[m], role)}
                        title={SUGGESTION_MODE_TIP[m]}
                        onClick={() => onModeChange(m)}
                      >
                        {SUGGESTION_MODE_SHORT[m]}
                      </button>
                    ))}
                  </div>
                  {/* Affichage : les 3 cards, ou la liste détaillée à leur place. */}
                  <div role="group" aria-label={D.viewGroup(role)} className="segmented segmented-icons">
                    {([false, true] as const).map((list) => (
                      <button
                        key={String(list)}
                        type="button"
                        className={'segment' + (expanded === list ? ' is-on' : '')}
                        aria-pressed={expanded === list}
                        aria-label={D.inRole(list ? D.viewList : D.viewTop3, role)}
                        title={list ? D.viewList : D.viewTop3}
                        onClick={() => setExpanded(list)}
                      >
                        <Icon name={list ? 'list' : 'grid'} size={16} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {row.recommendations.length === 0 && <span className="empty-box">{D.noChampion}</span>}
              {expanded ? (
                <SuggestionList row={row} selected={selected} onLock={lock} onScrollTop={scrollToTop} />
              ) : (
                <ul className="recs">
                  {row.recommendations.map((e, i) => (
                    <RecCard
                      key={e.champion}
                      e={e}
                      rank={i + 1}
                      role={role}
                      selected={selected === e.champion}
                      onSelect={() => dispatch({ type: 'select', role, champion: e.champion })}
                      onLock={() => lock(e.champion)}
                    />
                  ))}
                </ul>
              )}
            </>
          )}

          {row.locked && <LockedSummary row={row} />}
        </div>
      </div>

      {picker && (
        <ChampionPicker
          title={picker === 'ally' ? D.pickerAlly(player, role) : D.pickerEnemy(role)}
          accent={picker === 'ally' ? 'var(--ally)' : 'var(--enemy)'}
          query={query}
          onQuery={setQuery}
          items={items}
          actionLabel={(n) => (picker === 'ally' ? D.chooseIn(n, role) : D.enterIn(n, role))}
          onChoose={(n) => {
            if (picker === 'ally') lock(n);
            else {
              dispatch({ type: 'setEnemy', role, champion: n });
              setPicker(null);
            }
          }}
          onClose={() => setPicker(null)}
          filters={<RoleFilter value={roleFilter} onChange={setRoleFilter} />}
          actions={picker === 'enemy' && enemy ? (
            <button type="button" className="btn neg-text" onClick={() => { dispatch({ type: 'clearEnemy', role }); setPicker(null); }}>{D.clear}</button>
          ) : null}
        />
      )}
    </section>
  );
};
