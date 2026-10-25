import { useEffect, useState } from 'react';
import { masteryLevel, PLAYERS_TEXT as T } from '@draft/i18n-fr';
import { ROLES, type Champion, type PoolEntry, type Pools, type RiotIds, type Role } from '@draft/schemas';
import { Bar, Chip, Icon, Portrait, useData } from '../ui';
import { filterChampions } from '../draft/ChampionPicker';

interface Props {
  pools: Pools;
  onChange: (pools: Pools) => void;
  riotIds: RiotIds;
  onRiotIdsChange: (ids: RiotIds) => void;
}

const TRAIT_CHIPS: { label: string; has: (c: Champion) => boolean }[] = [
  { label: T.traits.frontline, has: (c) => c.provides.includes('Frontline') },
  { label: T.traits.engage, has: (c) => c.provides.includes('Engage') },
  { label: T.traits.peel, has: (c) => c.provides.includes('Peel') },
  { label: T.traits.physical, has: (c) => c.provides.includes('Physique') },
  { label: T.traits.early, has: (c) => c.scaling[0] >= 4 },
  { label: T.traits.late, has: (c) => c.scaling[2] >= 5 }
];

export const PlayersScreen = ({ pools, onChange, riotIds, onRiotIdsChange }: Props) => {
  const { engine } = useData();
  const names = Object.keys(pools);
  const [sel, setSel] = useState(names[0] ?? '');
  const [role, setRole] = useState<Role>('Top');
  const [newChamp, setNewChamp] = useState('');
  /** Liste de champions ouverte, et option active au clavier. */
  const [listOpen, setListOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [newPlayer, setNewPlayer] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const player = pools[sel] ? sel : names[0] ?? '';

  const select = (p: string) => {
    setSel(p);
    setConfirmDelete(false);
  };

  const deletePlayer = () => {
    const { [player]: _, ...rest } = pools;
    onChange(rest);
    select(Object.keys(rest)[0] ?? '');
  };
  const pool = pools[player]?.[role] ?? [];

  const setPool = (fn: (list: PoolEntry[]) => PoolEntry[]) =>
    onChange({ ...pools, [player]: { ...pools[player], [role]: fn(pool) } });

  // Tous les champions du catalogue, y compris hors de leurs rôles habituels (rôles affichés à droite), sauf ceux du pool.
  const options = filterChampions(engine.catalog, 'Tous', newChamp)
    .map((c) => c.name)
    .filter((n) => !pool.some((p) => p.champion === n));
  // Option active ramenée dans la liste courante (elle change avec la recherche, le rôle ou le joueur) ; -1 si vide.
  const current = Math.min(active, options.length - 1);

  // Au clavier, l'option active reste visible dans la liste.
  useEffect(() => {
    if (listOpen) document.getElementById('champ-option-' + current)?.scrollIntoView?.({ block: 'nearest' });
  }, [current, listOpen]);

  const addChampion = (name: string) => {
    setPool((list) => [...list, { champion: name, mastery: 5 }]);
    setNewChamp('');
    setActive(0);
  };

  const addPlayer = () => {
    const name = newPlayer.trim();
    if (!name || pools[name]) return;
    onChange({ ...pools, [name]: {} });
    select(name);
    setNewPlayer('');
  };

  const coverage = TRAIT_CHIPS.map((t) => {
    const n = pool.filter((p) => {
      const c = engine.catalog.get(p.champion);
      return c && t.has(c);
    }).length;
    return { label: t.label, n, w: pool.length ? Math.round((n / pool.length) * 100) : 0 };
  });

  return (
    <main className="players">
      <h1 className="h1">{T.title}</h1>
      <div className="players-grid">
        <aside className="col gap-16 players-left">
          <section className="card col gap-10">
            <h2 className="h3">{T.players}</h2>
            <ul className="plain-list gap-8">
              {names.map((p) => {
                const roles = ROLES.filter((r) => (pools[p]?.[r]?.length ?? 0) > 0);
                return (
                  <li key={p}>
                    <button type="button" className={'list-btn' + (p === player ? ' is-on' : '')} aria-pressed={p === player} onClick={() => select(p)}>
                      <span className="strong">{p}</span>
                      <span className="small muted">{T.pools(roles)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {names.length === 0 && <span className="small muted">{T.noPlayer}</span>}
          </section>
          <section className="card col gap-10">
            <h2 className="h3">{T.create}</h2>
            <label htmlFor="player-name" className="small muted">{T.nickname}</label>
            <input id="player-name" className="input" value={newPlayer} onChange={(e) => setNewPlayer(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPlayer()} />
            <button type="button" className="btn btn-accent" disabled={!newPlayer.trim() || !!pools[newPlayer.trim()]} onClick={addPlayer}>{T.createButton}</button>
          </section>
        </aside>

        {player && (
        <section className="col gap-16 players-center">
          <div className="row-between wrap">
            <h2 className="h2">{T.poolsOf(player)}</h2>
            {confirmDelete ? (
              <div role="group" aria-label={T.confirmDelete(player)} className="row-gap wrap">
                <span className="small warn-text strong">{T.deleteAsk(player)}</span>
                <button type="button" className="btn btn-danger" onClick={deletePlayer}>{T.deleteYes}</button>
                <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>{T.cancel}</button>
              </div>
            ) : (
              <button type="button" className="btn neg-text" onClick={() => setConfirmDelete(true)}>
                <Icon name="close" size={14} />{T.deletePlayer}
              </button>
            )}
          </div>
          <div className="row-gap wrap">
            <label htmlFor="riot-id" className="small muted" title={T.riotIdTip}>{T.riotId}</label>
            <input
              id="riot-id"
              className="input riot-id"
              placeholder={T.riotIdPlaceholder}
              autoComplete="off"
              spellCheck={false}
              title={T.riotIdTip}
              value={riotIds[player] ?? ''}
              onChange={(e) => onRiotIdsChange({ ...riotIds, [player]: e.target.value })}
            />
          </div>
          <div role="group" aria-label={T.role} className="row-gap wrap">
            {ROLES.map((r) => {
              const empty = !(pools[player]?.[r]?.length);
              return (
                <button key={r} type="button" className={'role-tab' + (r === role ? ' is-on' : '')} aria-pressed={r === role} onClick={() => setRole(r)}>
                  <span className="strong">{r}</span>
                  {empty && <span className="small warn-text">{T.noPool}</span>}
                </button>
              );
            })}
          </div>

          {pool.length === 0 && (
            <div className="empty-pool">
              <span className="strong warn-text">{T.emptyTitle(role, player)}</span>
              <span className="soft">{T.emptyText(role, player)}</span>
            </div>
          )}

          <ul className="plain-list gap-10">
            {pool.map((p) => {
              const c = engine.catalog.get(p.champion);
              const traits = c ? TRAIT_CHIPS.filter((t) => t.has(c)).map((t) => t.label) : [];
              return (
                <li key={p.champion} className="card pool-row">
                  <Portrait name={p.champion} size={52} label={p.champion} />
                  <div className="col gap-6 grow min0 pool-name">
                    <span className="detail-name">{p.champion}</span>
                    <div className="row-gap wrap">{traits.map((t) => <Chip key={t}>{t}</Chip>)}</div>
                  </div>
                  <div className="col gap-6 pool-mastery">
                    <div className="row-between small muted"><span>{T.masteryLabel(masteryLevel(p.mastery))}</span><span className="strong text">{p.mastery}/10</span></div>
                    <div className="segs" aria-hidden="true">
                      {Array.from({ length: 10 }, (_, i) => <span key={i} className={i < p.mastery ? 'on' : ''} />)}
                    </div>
                  </div>
                  <div className="row-gap">
                    <button type="button" className="square-btn" aria-label={T.masteryLower(p.champion)} disabled={p.mastery <= 1}
                      onClick={() => setPool((l) => l.map((x) => (x.champion === p.champion ? { ...x, mastery: x.mastery - 1 } : x)))}>-</button>
                    <button type="button" className="square-btn" aria-label={T.masteryRaise(p.champion)} disabled={p.mastery >= 10}
                      onClick={() => setPool((l) => l.map((x) => (x.champion === p.champion ? { ...x, mastery: x.mastery + 1 } : x)))}>+</button>
                    <button type="button" className="icon-btn" aria-label={T.removeFromPool(p.champion)}
                      onClick={() => setPool((l) => l.filter((x) => x.champion !== p.champion))}><Icon name="close" size={18} /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
        )}

        {player && (
        <aside className="col gap-16 players-right">
          <section className="card col gap-10">
            <h2 className="h3">{T.add}</h2>
            <label htmlFor="champ-name" className="small muted">{T.addFor(player, role)}</label>
            <div className="combo">
              <input
                id="champ-name"
                className="input"
                role="combobox"
                autoComplete="off"
                aria-expanded={listOpen}
                aria-controls="champ-options"
                aria-activedescendant={listOpen && current >= 0 ? 'champ-option-' + current : undefined}
                placeholder={T.search}
                value={newChamp}
                onChange={(e) => {
                  setNewChamp(e.target.value);
                  setActive(0);
                  setListOpen(true);
                }}
                onFocus={() => setListOpen(true)}
                onBlur={() => setListOpen(false)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setListOpen(true);
                    setActive(Math.max(0, Math.min(current + 1, options.length - 1)));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActive(Math.max(current - 1, 0));
                  } else if (e.key === 'Enter' && listOpen && current >= 0) {
                    addChampion(options[current]!);
                  } else if (e.key === 'Escape') {
                    setListOpen(false);
                  }
                }}
              />
              {listOpen && (
                <ul id="champ-options" role="listbox" aria-label={T.champions(role)} className="combo-list">
                  {options.length === 0 && <li className="combo-empty muted">{T.notFound}</li>}
                  {options.map((n, i) => (
                    <li
                      key={n}
                      id={'champ-option-' + i}
                      role="option"
                      aria-label={n}
                      aria-selected={i === current}
                      className={'combo-option' + (i === current ? ' is-active' : '')}
                      // mousedown : avant le blur du champ, qui fermerait la liste.
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addChampion(n);
                      }}
                      onMouseEnter={() => setActive(i)}
                    >
                      <Portrait name={n} size={28} />
                      <span className="grow">{n}</span>
                      <span className="small muted">{engine.catalog.get(n)?.roles.join(', ')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="card col gap-10">
            <h2 className="h3">{T.coverage(role)}</h2>
            {coverage.map((v) => (
              <div key={v.label} className="coverage">
                <span>{v.label}</span>
                <Bar value={v.w} color="var(--accent)" />
                <span className={'right strong ' + (v.n ? 'text' : 'warn-text')}>{T.coverageCount(v.n)}</span>
              </div>
            ))}
          </section>

          <section className="card col gap-10">
            <h2 className="h3">{T.scale}</h2>
            <dl className="scale">
              {T.scaleItems.map(([range, text]) => [<dt key={range}>{range}</dt>, <dd key={range + '-d'}>{text}</dd>])}
            </dl>
          </section>
        </aside>
        )}
      </div>
    </main>
  );
};
