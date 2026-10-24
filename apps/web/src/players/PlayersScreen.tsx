import { useEffect, useState } from 'react';
import { masteryLevel } from '@draft/i18n-fr';
import { ROLES, type Champion, type PoolEntry, type Pools, type Role } from '@draft/schemas';
import { Bar, Chip, Icon, Portrait, useData } from '../ui';
import { filterChampions } from '../draft/ChampionPicker';

interface Props {
  pools: Pools;
  onChange: (pools: Pools) => void;
}

const TRAIT_CHIPS: { label: string; has: (c: Champion) => boolean }[] = [
  { label: 'Frontline', has: (c) => c.provides.includes('Frontline') },
  { label: 'Engage', has: (c) => c.provides.includes('Engage') },
  { label: 'Peel', has: (c) => c.provides.includes('Peel') },
  { label: 'Dégâts physiques', has: (c) => c.provides.includes('Physique') },
  { label: 'Early game', has: (c) => c.scaling[0] >= 4 },
  { label: 'Scaling tardif', has: (c) => c.scaling[2] >= 5 }
];

export const PlayersScreen = ({ pools, onChange }: Props) => {
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
      <h1 className="h1">Joueurs et champion pools</h1>
      <div className="players-grid">
        <aside className="col gap-16 players-left">
          <section className="card col gap-10">
            <h2 className="h3">Joueurs</h2>
            <ul className="plain-list gap-8">
              {names.map((p) => {
                const roles = ROLES.filter((r) => (pools[p]?.[r]?.length ?? 0) > 0);
                return (
                  <li key={p}>
                    <button type="button" className={'list-btn' + (p === player ? ' is-on' : '')} aria-pressed={p === player} onClick={() => select(p)}>
                      <span className="strong">{p}</span>
                      <span className="small muted">{roles.length ? 'Pools : ' + roles.join(', ') : 'Aucun pool'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {names.length === 0 && <span className="small muted">Aucun joueur.</span>}
          </section>
          <section className="card col gap-10">
            <h2 className="h3">Créer un joueur</h2>
            <label htmlFor="player-name" className="small muted">Pseudo du joueur</label>
            <input id="player-name" className="input" value={newPlayer} onChange={(e) => setNewPlayer(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPlayer()} />
            <button type="button" className="btn btn-accent" disabled={!newPlayer.trim() || !!pools[newPlayer.trim()]} onClick={addPlayer}>Créer le joueur</button>
          </section>
        </aside>

        {player && (
        <section className="col gap-16 players-center">
          <div className="row-between wrap">
            <h2 className="h2">Pools de {player}</h2>
            {confirmDelete ? (
              <div role="group" aria-label={'Confirmer la suppression de ' + player} className="row-gap wrap">
                <span className="small warn-text strong">Supprimer {player} et ses pools ?</span>
                <button type="button" className="btn btn-danger" onClick={deletePlayer}>Oui, supprimer</button>
                <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>Annuler</button>
              </div>
            ) : (
              <button type="button" className="btn neg-text" onClick={() => setConfirmDelete(true)}>
                <Icon name="close" size={14} />Supprimer le joueur
              </button>
            )}
          </div>
          <div role="group" aria-label="Rôle" className="row-gap wrap">
            {ROLES.map((r) => {
              const empty = !(pools[player]?.[r]?.length);
              return (
                <button key={r} type="button" className={'role-tab' + (r === role ? ' is-on' : '')} aria-pressed={r === role} onClick={() => setRole(r)}>
                  <span className="strong">{r}</span>
                  {empty && <span className="small warn-text">Aucun pool</span>}
                </button>
              );
            })}
          </div>

          {pool.length === 0 && (
            <div className="empty-pool">
              <span className="strong warn-text">Aucun pool {role} pour {player}</span>
              <span className="soft">Placé {role} en draft, {player} se voit proposer tous les champions du rôle, sans note de maîtrise.</span>
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
                    <div className="row-between small muted"><span>Maîtrise : {masteryLevel(p.mastery)}</span><span className="strong text">{p.mastery}/10</span></div>
                    <div className="segs" aria-hidden="true">
                      {Array.from({ length: 10 }, (_, i) => <span key={i} className={i < p.mastery ? 'on' : ''} />)}
                    </div>
                  </div>
                  <div className="row-gap">
                    <button type="button" className="square-btn" aria-label={'Baisser la maîtrise de ' + p.champion} disabled={p.mastery <= 1}
                      onClick={() => setPool((l) => l.map((x) => (x.champion === p.champion ? { ...x, mastery: x.mastery - 1 } : x)))}>-</button>
                    <button type="button" className="square-btn" aria-label={'Augmenter la maîtrise de ' + p.champion} disabled={p.mastery >= 10}
                      onClick={() => setPool((l) => l.map((x) => (x.champion === p.champion ? { ...x, mastery: x.mastery + 1 } : x)))}>+</button>
                    <button type="button" className="icon-btn" aria-label={'Retirer ' + p.champion + ' du pool'}
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
            <h2 className="h3">Ajouter un champion</h2>
            <label htmlFor="champ-name" className="small muted">Champion pour {player}, rôle {role}, ajouté avec la note 5</label>
            <div className="combo">
              <input
                id="champ-name"
                className="input"
                role="combobox"
                autoComplete="off"
                aria-expanded={listOpen}
                aria-controls="champ-options"
                aria-activedescendant={listOpen && current >= 0 ? 'champ-option-' + current : undefined}
                placeholder="Rechercher un champion"
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
                <ul id="champ-options" role="listbox" aria-label={'Champions ' + role} className="combo-list">
                  {options.length === 0 && <li className="combo-empty muted">Aucun champion trouvé.</li>}
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
                      <span className="small muted">{engine.catalog.get(n)?.roles.join(", ")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="card col gap-10">
            <h2 className="h3">Couverture du pool {role}</h2>
            {coverage.map((v) => (
              <div key={v.label} className="coverage">
                <span>{v.label}</span>
                <Bar value={v.w} color="var(--accent)" />
                <span className={'right strong ' + (v.n ? 'text' : 'warn-text')}>{v.n === 0 ? 'Aucun' : v.n + (v.n > 1 ? ' champions' : ' champion')}</span>
              </div>
            ))}
          </section>

          <section className="card col gap-10">
            <h2 className="h3">Échelle de maîtrise</h2>
            <dl className="scale">
              <dt>1 à 3</dt><dd>Découverte : tu connais le kit, peu de parties.</dd>
              <dt>4 à 6</dt><dd>À l'aise : tu le joues sans te faire punir.</dd>
              <dt>7 à 8</dt><dd>Solide : combos, matchups et timings acquis.</dd>
              <dt>9 à 10</dt><dd>Maîtrise : tu peux porter une partie avec.</dd>
            </dl>
          </section>
        </aside>
        )}
      </div>
    </main>
  );
};
