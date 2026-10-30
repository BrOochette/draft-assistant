import { useEffect, useRef, useState } from 'react';
import { masteryLevel, PLAYERS_TEXT as T } from '@draft/i18n-fr';
import { ROLES, type Champion, type PoolEntry, type Pools, type RiotIds, type Role } from '@draft/schemas';
import { Bar, Chip, Icon, Portrait, SplitButton, useData } from '../ui';
import { filterChampions } from '../draft/ChampionPicker';
import { Splash } from '../fit/Cards';
import { onePlayer, playersFileName, readPlayersFile, toPlayersFile, type ImportError, type ImportPreview } from './share';

interface Props {
  pools: Pools;
  onChange: (pools: Pools) => void;
  riotIds: RiotIds;
  onRiotIdsChange: (ids: RiotIds) => void;
  /** Joueur marqué « Moi », null sans. */
  me?: string | null;
  onMeChange?: (me: string | null) => void;
}

const TRAIT_CHIPS: { label: string; has: (c: Champion) => boolean }[] = [
  { label: T.traits.frontline, has: (c) => c.provides.includes('Frontline') },
  { label: T.traits.engage, has: (c) => c.provides.includes('Engage') },
  { label: T.traits.peel, has: (c) => c.provides.includes('Peel') },
  { label: T.traits.physical, has: (c) => c.provides.includes('Physique') },
  { label: T.traits.early, has: (c) => c.scaling[0] >= 4 },
  { label: T.traits.late, has: (c) => c.scaling[2] >= 5 }
];

/** Texte d'un fichier choisi (FileReader : pris en charge partout). */
const readText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

export const PlayersScreen = ({ pools, onChange, riotIds, onRiotIdsChange, me = null, onMeChange = () => {} }: Props) => {
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
  // Partage : JSON collé ou fichier choisi, en attente de confirmation ; erreur de lecture ; résultat de la dernière action.
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importError, setImportError] = useState<ImportError | null>(null);
  const [imported, setImported] = useState<number | null>(null);
  const [copied, setCopied] = useState<boolean | null>(null);
  /** Zone de collage à la main (presse-papiers illisible), et son contenu. */
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');

  /** JSON de toute la liste, ou d'un seul joueur. */
  const playersJson = (only?: string) => JSON.stringify(toPlayersFile(only ? onePlayer(pools, only) : pools, riotIds), null, 2) + '\n';
  /** Résultat de la copie du joueur affiché (en-tête de ses pools). */
  const [copiedOne, setCopiedOne] = useState<boolean | null>(null);
  const resetShare = () => {
    setImported(null);
    setPreview(null);
    setImportError(null);
    setCopied(null);
  };
  const copyPlayers = async () => {
    resetShare();
    setPasting(false);
    try {
      await navigator.clipboard.writeText(playersJson());
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const readJson = (text: string) => {
    resetShare();
    const r = readPlayersFile(text, { pools, riotIds }, (c) => engine.catalog.has(c));
    if ('error' in r) setImportError(r.error);
    else {
      setPreview(r);
      setPasting(false);
      setPasted('');
    }
  };

  // « Coller » lit directement le presse-papiers ; s'il est illisible (accès refusé), une zone de texte prend le relais.
  const pasteClipboard = async () => {
    resetShare();
    let text: string | null = null;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      text = null;
    }
    if (text?.trim()) readJson(text);
    else setPasting(true);
  };

  const copyOne = async () => {
    try {
      await navigator.clipboard.writeText(playersJson(player));
      setCopiedOne(true);
    } catch {
      setCopiedOne(false);
    }
  };

  const exportPlayers = (only?: string) => {
    const blob = new Blob([playersJson(only)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = playersFileName(new Date(), only);
    a.click();
    URL.revokeObjectURL(url);
  };
  const readFile = async (file: File | undefined) => {
    resetShare();
    if (!file) return;
    const text = await readText(file).catch(() => null);
    if (text == null) return setImportError('NOT_JSON');
    readJson(text);
  };
  const confirmImport = () => {
    if (!preview) return;
    onChange(preview.pools);
    onRiotIdsChange(preview.riotIds);
    setImported(preview.players.length);
    if (preview.players[0]) select(preview.players[0].name);
    setPreview(null);
  };

  const select = (p: string) => {
    setSel(p);
    setConfirmDelete(false);
    setCopiedOne(null);
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
      <h1 className="visually-hidden">{T.title}</h1>
      <div className="players-grid">
        <aside className="col gap-16 players-left">
          <section className="card col gap-10 players-list" aria-label={T.players}>
            <div className="row-between">
              <h2 className="h3">{T.players}</h2>
              {/* Copier / Coller la liste ; la flèche de chaque bouton propose la même chose en fichier. */}
              <div role="group" aria-label={T.share} className="row-gap players-share">
                <SplitButton
                  title={T.copyTip}
                  disabled={names.length === 0}
                  onClick={() => void copyPlayers()}
                  moreLabel={T.exportMore}
                  more={{ label: <><Icon name="download" />{T.exportFile}</>, title: T.exportTip, onClick: () => exportPlayers() }}
                >
                  <Icon name="copy" />{T.copyButton}
                </SplitButton>
                <SplitButton
                  title={T.pasteTip}
                  onClick={() => void pasteClipboard()}
                  moreLabel={T.importMore}
                  more={{ label: <><Icon name="upload" />{T.importFileButton}</>, title: T.importTip, onClick: () => fileInput.current?.click() }}
                >
                  <Icon name="paste" />{T.pasteButton}
                </SplitButton>
              </div>
            </div>
            <ul className="plain-list gap-8">
              {names.map((p) => {
                const roles = ROLES.filter((r) => (pools[p]?.[r]?.length ?? 0) > 0);
                // Illustration du champion le mieux maîtrisé du joueur, comme les cartes joueurs de l'écran Draft.
                const top = ROLES.flatMap((r) => pools[p]?.[r] ?? []).reduce<PoolEntry | null>((b, e) => (!b || e.mastery > b.mastery ? e : b), null);
                const art = top ? engine.catalog.get(top.champion)?.ddragonId : undefined;
                return (
                  <li key={p}>
                    <button type="button" className={'list-btn player-card' + (p === player ? ' is-on' : '') + (art ? ' has-art' : '')} aria-pressed={p === player} onClick={() => select(p)}>
                      {art && <span className="member-art" aria-hidden="true"><img src={import.meta.env.BASE_URL + 'champions/centered/' + art + '.jpg'} alt="" loading="lazy" /></span>}
                      <span className="row-gap"><span className="strong">{p}</span>{p === me && <span className="chip chip-pos me-chip">{T.me}</span>}</span>
                      <span className="small muted">{T.pools(roles)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {names.length === 0 && <span className="small muted">{T.noPlayer}</span>}
            <div className="players-create">
              <input id="player-name" className="input" aria-label={T.nickname} placeholder={T.nickname} value={newPlayer} onChange={(e) => setNewPlayer(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPlayer()} />
              <button type="button" className="btn btn-accent" disabled={!newPlayer.trim() || !!pools[newPlayer.trim()]} onClick={addPlayer}>{T.createButton}</button>
            </div>
            {pasting && (
              <div className="col gap-8">
                <textarea
                  className="input share-paste"
                  aria-label={T.pasteLabel}
                  placeholder={T.pastePlaceholder}
                  spellCheck={false}
                  autoFocus
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                />
                <div className="row-gap wrap">
                  <button type="button" className="btn btn-accent" disabled={!pasted.trim()} onClick={() => readJson(pasted)}>{T.pasteRead}</button>
                  <button type="button" className="btn" onClick={() => { setPasting(false); setPasted(''); setImportError(null); }}>{T.cancel}</button>
                </div>
              </div>
            )}
            <input
                ref={fileInput}
                type="file"
                accept=".json,application/json"
                hidden
                aria-label={T.importFile}
                onChange={(e) => {
                  void readFile(e.target.files?.[0]);
                  // Le même fichier peut être choisi de nouveau.
                  e.target.value = '';
                }}
              />
            {importError && <span role="alert" className="small neg-text">{T.importError[importError]}</span>}
            {imported != null && <span role="status" className="small pos-text">{T.importDone(imported)}</span>}
            {copied != null && <span role="status" className={'small ' + (copied ? 'pos-text' : 'neg-text')}>{copied ? T.copied : T.copyFailed}</span>}
            {preview && (
              <div role="group" aria-label={T.importAsk} className="col gap-8">
                <ul className="plain-list gap-4">
                  {preview.players.map((p) => (
                    <li key={p.name} className="row-between small">
                      <span className="strong">{p.name}</span>
                      <Chip tone={p.replaced ? 'warn' : 'info'}>{p.replaced ? T.importReplaced : T.importNew}</Chip>
                    </li>
                  ))}
                </ul>
                {preview.unknown.length > 0 && <span className="small warn-text">{T.importUnknown(preview.unknown)}</span>}
                <div className="row-gap wrap">
                  <button type="button" className="btn btn-accent" onClick={confirmImport}>{T.importConfirm(preview.players.length)}</button>
                  <button type="button" className="btn" onClick={() => setPreview(null)}>{T.cancel}</button>
                </div>
              </div>
            )}
          </section>
        </aside>

        {player && (
        <section className="col gap-16 players-center">
          <div className="card col gap-10 player-head">
            <div className="row-between wrap">
              <h2 className="h2">{T.poolsOf(player)}</h2>
              {confirmDelete ? (
                <div role="group" aria-label={T.confirmDelete(player)} className="row-gap wrap">
                  <span className="small warn-text strong">{T.deleteAsk(player)}</span>
                  <button type="button" className="btn btn-danger" onClick={deletePlayer}>{T.deleteYes}</button>
                  <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>{T.cancel}</button>
                </div>
              ) : (
                <div className="row-gap wrap player-actions">
                  {copiedOne != null && <span role="status" className={'small ' + (copiedOne ? 'pos-text' : 'neg-text')}>{copiedOne ? T.copied : T.copyFailed}</span>}
                  <SplitButton
                    title={T.copyOneTip(player)}
                    onClick={() => void copyOne()}
                    moreLabel={T.exportMore}
                    more={{ label: <><Icon name="download" />{T.exportFile}</>, title: T.exportOneTip(player), onClick: () => exportPlayers(player) }}
                  >
                    <Icon name="copy" />{T.copyOne}
                  </SplitButton>
                  <button type="button" className="btn neg-text" onClick={() => setConfirmDelete(true)}>
                    <Icon name="close" size={14} />{T.deletePlayer}
                  </button>
                </div>
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
              <button type="button" className={'btn btn-sm me-toggle' + (me === player ? ' is-on' : '')} aria-pressed={me === player} title={T.meTip} onClick={() => onMeChange(me === player ? null : player)}>
                {me === player && <Icon name="check" size={14} />}{T.me}
              </button>
            </div>
          </div>
          {/* Rôles, puis l'ajout d'un champion sur la même ligne. */}
          <div className="players-roles-row">
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
          <div className="players-add">
              <label htmlFor="champ-name" className="visually-hidden">{T.addFor(player, role)}</label>
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
                  title={T.addFor(player, role)}
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
          </div>
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
                  <Splash name={p.champion} />
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
