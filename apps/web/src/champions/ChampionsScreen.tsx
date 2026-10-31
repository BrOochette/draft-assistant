import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { CHAMPIONS_TEXT as T, fmtInt, fmtPct, fmtSigned, TRAIT_LABEL } from '@draft/i18n-fr';
import { ROLES, type Candidate, type DraftState, type Role } from '@draft/schemas';
import { Portrait, useData } from '../ui';
import { ChampionBuild } from './ChampionBuild';
import { CHAMPION_TABS, championHash, LIST_HASH, type ChampionRoute } from './route';

// Écran Champions (maquette maquettes/5-champions.html, validée le 31/10/2026) : liste de tous les champions, puis la
// fiche d'un champion sur un rôle avec son build, ses matchups et ses duos. Design de l'écran Joueurs.

/** Matchups et duos des listes « plus favorables » et « plus difficiles » à partir de ce nombre de parties. */
export const RELIABLE_GAMES = 200;
const BEST_MAX = 8;

type SortKey = 'name' | 'wr' | 'games' | 'share';
type RoleFilter = Role | 'all';

interface ChampionRow {
  name: string;
  ddragonId: string;
  classes: string[];
  roles: [Role, Candidate][];
}

const share = (c: Candidate) => c.laneShare ?? 100;
const totalGames = (r: ChampionRow) => r.roles.reduce((s, [, c]) => s + c.games, 0);

/** Champions qui ont des stats sur au moins un rôle, rôles du plus joué au moins joué. */
const useChampions = (): ChampionRow[] => {
  const { engine } = useData();
  return useMemo(() => {
    const out = new Map<string, ChampionRow>();
    for (const role of ROLES)
      for (const c of engine.stats.listCandidates(role)) {
        const info = engine.catalog.get(c.name);
        const row = out.get(c.name) ?? { name: c.name, ddragonId: info?.ddragonId ?? '', classes: info?.classes ?? [], roles: [] };
        row.roles.push([role, c]);
        out.set(c.name, row);
      }
    for (const r of out.values()) r.roles.sort((a, b) => share(b[1]) - share(a[1]));
    return [...out.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [engine]);
};

/** Une draft est en cours dès qu'un pick ou un ban est posé. */
export const draftStarted = (d: DraftState) =>
  ROLES.some((r) => d.ally[r] || d.enemy[r]) || d.allyBans.length > 0 || d.enemyBans.length > 0;

/** Adversaire direct dans la draft : le champion du même rôle dans l'autre équipe. */
export const directOpponent = (d: DraftState, champion: string, role: Role): string | null =>
  d.ally[role] === champion ? d.enemy[role] : d.enemy[role] === champion ? d.ally[role] : null;

const Art = ({ id, className }: { id: string; className: string }) =>
  id ? <img className={className} src={import.meta.env.BASE_URL + 'champions/' + id + '.png'} alt="" aria-hidden="true" /> : null;

/** Bandeau de la draft en cours : retour à la draft (état gardé) et portraits des deux équipes, vers leur fiche. */
const DraftBar = ({ draft }: { draft: DraftState }) => {
  const face = (name: string | null, role: Role) =>
    name ? (
      <a key={role} className="dface" href={championHash(name, role)} title={T.openIn(name, role)}>
        <Portrait name={name} size={40} />
        <span className="small muted">{role}</span>
      </a>
    ) : (
      <span key={role} className="dface is-empty"><span className="dface-empty" /><span className="small muted">{role}</span></span>
    );
  return (
    <section className="card champ-draftbar" aria-label={T.draft}>
      <a className="btn" href="#/">{T.toDraft}</a>
      <div className="champ-team is-ally">{ROLES.map((r) => face(draft.ally[r], r))}</div>
      <div className="champ-team is-enemy">{ROLES.map((r) => face(draft.enemy[r], r))}</div>
    </section>
  );
};

/** Recherche, filtre, tri, affichage et défilement de la liste, retrouvés au retour d'une fiche. */
const listMemory: { q: string; role: RoleFilter; sort: { key: SortKey; dir: 1 | -1 }; view: 'grid' | 'table'; scroll: number } = {
  q: '', role: 'all', sort: { key: 'name', dir: 1 }, view: 'grid', scroll: 0
};

const ChampionList = () => {
  const champions = useChampions();
  const [q, setQ] = useState(listMemory.q);
  const [role, setRole] = useState<RoleFilter>(listMemory.role);
  const [sort, setSort] = useState(listMemory.sort);
  const [view, setView] = useState(listMemory.view);
  Object.assign(listMemory, { q, role, sort, view });
  useLayoutEffect(() => {
    window.scrollTo({ top: listMemory.scroll });
    const onScroll = () => {
      listMemory.scroll = window.scrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const statsOf = (c: ChampionRow) => (role === 'all' ? c.roles[0]![1] : c.roles.find(([r]) => r === role)?.[1]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = champions.filter((c) => (!needle || c.name.toLowerCase().includes(needle)) && (role === 'all' || c.roles.some(([r]) => r === role)));
    const value = (c: ChampionRow): number | string => {
      const s = role === 'all' ? c.roles[0]![1] : c.roles.find(([r]) => r === role)![1];
      return sort.key === 'name' ? c.name : sort.key === 'wr' ? s.gameWinRate : sort.key === 'games' ? (role === 'all' ? totalGames(c) : s.games) : share(s);
    };
    return [...list].sort((a, b) => {
      const [x, y] = [value(a), value(b)];
      return (typeof x === 'string' ? x.localeCompare(y as string, 'fr') : x - (y as number)) * sort.dir;
    });
  }, [champions, q, role, sort]);

  const th = (key: SortKey, label: string, right = false) => (
    <th className={(right ? 'r ' : '') + (sort.key === key ? 'is-sort' : '')} aria-sort={sort.key === key ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}>
      <button type="button" className="th-btn" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : key === 'name' ? 1 : -1 }))}>
        {label}{sort.key === key ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );

  return (
    <>
      <div className="champ-toolbar">
        <h1 className="h2">{T.title}</h1>
        <input className="input champ-search" type="search" placeholder={T.search} aria-label={T.search} value={q} onChange={(e) => setQ(e.target.value)} />
        <div role="group" aria-label={T.roleGroup} className="champ-seg">
          {(['all', ...ROLES] as RoleFilter[]).map((r) => (
            <button key={r} type="button" className={'btn btn-sm' + (role === r ? ' is-on' : '')} aria-pressed={role === r} onClick={() => setRole(r)}>{r === 'all' ? T.allRoles : r}</button>
          ))}
        </div>
        <span className="grow" />
        {view === 'grid' && (
          <select className="input champ-sort" aria-label={T.sortLabel} value={sort.key} onChange={(e) => {
            const key = e.target.value as SortKey;
            setSort({ key, dir: key === 'name' ? 1 : -1 });
          }}>
            {(Object.keys(T.sort) as SortKey[]).map((k) => <option key={k} value={k}>{T.sort[k]}</option>)}
          </select>
        )}
        <div role="group" aria-label={T.viewGroup} className="champ-seg">
          <button type="button" className={'btn btn-sm' + (view === 'grid' ? ' is-on' : '')} aria-pressed={view === 'grid'} onClick={() => setView('grid')}>{T.grid}</button>
          <button type="button" className={'btn btn-sm' + (view === 'table' ? ' is-on' : '')} aria-pressed={view === 'table'} onClick={() => setView('table')}>{T.table}</button>
        </div>
      </div>
      {rows.length === 0 && <p className="muted">{T.none}</p>}
      {view === 'grid' ? (
        <ul className="plain-list champ-grid">
          {rows.map((c) => {
            const roles = role === 'all' ? c.roles : c.roles.filter(([r]) => r === role);
            return (
              <li key={c.name}>
                <a className="champ-tile" href={championHash(c.name, role === 'all' ? null : role)}>
                  <Art id={c.ddragonId} className="champ-blur" />
                  <Portrait name={c.name} size={52} />
                  <span className="col min0">
                    <span className="strong ellipsis">{c.name}</span>
                    <span className="champ-rchips">
                      {roles.map(([r, s]) => <span key={r} className="champ-rchip">{r} <b>{fmtPct(s.gameWinRate)}</b></span>)}
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <table className="champ-table">
          <thead>
            <tr>
              {th('name', T.champion)}
              <th>{role === 'all' ? T.roles : T.role}</th>
              {th('wr', T.winRate, true)}
              {th('games', T.games, true)}
              {th('share', T.share, true)}
              <th>{T.classes}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const [mainRole] = role === 'all' ? c.roles[0]! : [role];
              const s = statsOf(c)!;
              return (
                <tr key={c.name} onClick={() => { location.hash = championHash(c.name, mainRole); }}>
                  <td>
                    <a className="champ-who" href={championHash(c.name, mainRole)}><Portrait name={c.name} size={32} /><span className="strong">{c.name}</span></a>
                  </td>
                  <td>
                    <span className="champ-rchip"><b>{mainRole}</b></span>{' '}
                    {role === 'all' && c.roles.slice(1).map(([r]) => <span key={r} className="champ-rchip">{r}</span>)}
                  </td>
                  <td className="r num strong">{T.pct2(s.gameWinRate)}</td>
                  <td className="r num">{fmtInt(role === 'all' ? totalGames(c) : s.games)}</td>
                  <td className="r num">{fmtPct(share(s))}</td>
                  <td className="soft">{c.classes.join(', ')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
};

interface Pair {
  name: string;
  /** Win rate du matchup, ou écart de duo en points. */
  value: number;
  /** Écart au win rate du champion (matchup), ou écart de duo. */
  delta: number;
  games: number;
}
type PairKey = 'name' | 'value' | 'delta' | 'games';

const sortPairs = (list: Pair[], key: PairKey, dir: number) =>
  [...list].sort((a, b) => (key === 'name' ? a.name.localeCompare(b.name, 'fr') : a[key] - b[key]) * dir);
const toneOf = (v: number) => (v >= 0.05 ? ' is-pos' : v <= -0.05 ? ' is-neg' : '');

/**
 * Matchups ou duos : les plus favorables et les plus difficiles (au moins RELIABLE_GAMES parties), puis la liste
 * complète, triée par un clic sur un en-tête de colonne (win rate croissant par défaut).
 */
const PairView = ({ pairs, kind, labels, buildOf }: { pairs: Pair[]; kind: 'matchup' | 'duo'; labels: [string, string]; buildOf?: (name: string) => string }) => {
  const [sort, setSort] = useState<{ key: PairKey; dir: number }>({ key: 'value', dir: 1 });
  const [q, setQ] = useState('');
  const reliable = pairs.filter((p) => p.games >= RELIABLE_GAMES);
  const best = sortPairs(reliable, 'delta', -1).slice(0, BEST_MAX);
  const worst = sortPairs(reliable, 'delta', 1).slice(0, BEST_MAX);
  const needle = q.trim().toLowerCase();
  const all = sortPairs(pairs.filter((p) => !needle || p.name.toLowerCase().includes(needle)), sort.key, sort.dir);
  const cols: [PairKey, string][] = [['name', T.champion], ['value', kind === 'matchup' ? T.winRate : T.duoGap], ['delta', kind === 'matchup' ? T.gap : ''], ['games', T.games]];
  const cls = 'champ-mrow' + (buildOf ? ' has-build' : '');
  const head = (sortable: boolean) => (
    <div className={cls + ' is-head small muted'} role="row">
      <span />
      {cols.map(([k, l]) =>
        !l ? <span key={k} /> : sortable ? (
          <button key={k} type="button" className={'th-btn' + (sort.key === k ? ' is-sort' : '')} onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? -s.dir : k === 'name' || k === 'value' ? 1 : -1 }))}>
            {l}{sort.key === k ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}
          </button>
        ) : <span key={k}>{l}</span>
      )}
      {buildOf && <span />}
    </div>
  );
  const rows = (list: Pair[]) =>
    list.map((p) => (
      <div key={p.name} className={cls} role="row">
        <Portrait name={p.name} size={28} />
        <a className="strong small ellipsis champ-mname" href={championHash(p.name)}>{p.name}</a>
        <span className="num small strong">{kind === 'matchup' ? T.pct2(p.value) : fmtSigned(p.value)}</span>
        {kind === 'matchup' ? <span className={'champ-delta' + toneOf(p.delta)}>{fmtSigned(p.delta)}</span> : <span />}
        <span className="num small muted">{fmtInt(p.games)}</span>
        {buildOf && <a className="btn btn-sm champ-bld" href={buildOf(p.name)} title={T.buildVs(p.name)}>{T.build}</a>}
      </div>
    ));
  return (
    <>
      <div className="champ-two">
        <section className="card"><h3 className="champ-sec">{labels[0]} <span className="muted">{T.reliable(RELIABLE_GAMES)}</span></h3>{head(false)}{rows(best)}</section>
        <section className="card"><h3 className="champ-sec">{labels[1]} <span className="muted">{T.reliable(RELIABLE_GAMES)}</span></h3>{head(false)}{rows(worst)}</section>
      </div>
      <section className="card">
        <div className="champ-mtool">
          <h3 className="champ-sec">{T.all(pairs.length)}</h3>
          <input className="input btn-sm" type="search" placeholder={T.filter} aria-label={T.filter} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {head(true)}
        {rows(all)}
      </section>
    </>
  );
};

const Matchups = ({ champion, role, stats, canLoad }: { champion: string; role: Role; stats: Candidate; canLoad: boolean }) => {
  const targets = [role, ...ROLES.filter((r) => r !== role && Object.keys(stats.crossMatchups?.[r] ?? {}).length > 0)];
  const [target, setTarget] = useState<Role>(role);
  const entries = target === role ? stats.matchups ?? {} : stats.crossMatchups?.[target] ?? {};
  const pairs = Object.entries(entries).map(([name, [wr, games]]) => ({ name, value: wr, delta: wr - stats.gameWinRate, games }));
  if (!pairs.length && target === role) return <p className="muted">{T.noMatchups}</p>;
  return (
    <>
      <div className="champ-mtool">
        <span className="small muted">{T.against}</span>
        <div role="group" aria-label={T.against} className="champ-seg">
          {targets.map((r) => (
            <button key={r} type="button" className={'btn btn-sm' + (r === target ? ' is-on' : '')} aria-pressed={r === target} onClick={() => setTarget(r)}>{r === role ? T.faceToFace(r) : T.enemyRole(r)}</button>
          ))}
        </div>
        <span className="small muted champ-note">{T.gapNote(stats.gameWinRate)}</span>
      </div>
      <PairView key={target} pairs={pairs} kind="matchup" labels={[T.best, T.worst]} buildOf={target === role && canLoad ? (n) => championHash(champion, role, 'build', n) : undefined} />
    </>
  );
};

const Duos = ({ role, stats }: { role: Role; stats: Candidate }) => {
  const targets = ROLES.filter((r) => r !== role && Object.keys(stats.duos?.[r] ?? {}).length > 0);
  const [target, setTarget] = useState<Role | undefined>(targets[0]);
  if (!target) return <p className="muted">{T.noDuos}</p>;
  const pairs = Object.entries(stats.duos?.[target] ?? {}).map(([name, [delta, games]]) => ({ name, value: delta, delta, games }));
  return (
    <>
      <div className="champ-mtool">
        <span className="small muted">{T.with}</span>
        <div role="group" aria-label={T.with} className="champ-seg">
          {targets.map((r) => (
            <button key={r} type="button" className={'btn btn-sm' + (r === target ? ' is-on' : '')} aria-pressed={r === target} onClick={() => setTarget(r)}>{T.allyRole(r)}</button>
          ))}
        </div>
        <span className="small muted champ-note">{T.duoNote}</span>
      </div>
      <PairView key={target} pairs={pairs} kind="duo" labels={[T.bestDuos, T.worstDuos]} />
    </>
  );
};

const ChampionDetail = ({ row, route, draft, canLoad }: { row: ChampionRow; route: ChampionRoute; draft: DraftState | null; canLoad: boolean }) => {
  const { engine } = useData();
  const info = engine.catalog.get(row.name);
  const [role, stats] = row.roles.find(([r]) => r === route.role) ?? row.roles[0]!;
  const direct = draft ? directOpponent(draft, row.name, role) : null;
  return (
    <>
      <a className="btn btn-sm champ-back" href={LIST_HASH}>{T.back}</a>
      <section className="card champ-hero">
        <span className="champ-art" aria-hidden="true">{row.ddragonId && <img src={import.meta.env.BASE_URL + 'champions/centered/' + row.ddragonId + '.jpg'} alt="" />}</span>
        <Portrait name={row.name} size={84} />
        <div className="col gap-8 min0">
          <h1 className="h1">{row.name}</h1>
          <div className="champ-tags">
            {row.classes.map((c) => <span key={c} className="champ-tag">{c}</span>)}
            {info && <span className="champ-tag">{T.damage[info.damage] ?? info.damage}</span>}
            {info?.provides.filter((p) => TRAIT_LABEL[p] !== T.damage[info.damage]).map((p) => <span key={p} className="champ-tag">{TRAIT_LABEL[p]}</span>)}
          </div>
        </div>
        <div role="group" aria-label={T.roleGroup} className="champ-roletabs">
          {row.roles.map(([r, s]) => (
            <a key={r} className={'champ-roletab' + (r === role ? ' is-on' : '')} aria-current={r === role ? 'page' : undefined} href={championHash(row.name, r, route.tab)}>
              <span className="strong">{r}</span>
              <span className="small soft num">{T.roleStats(s.gameWinRate, s.games)}</span>
              <span className="small muted">{T.roleShare(share(s))}</span>
            </a>
          ))}
        </div>
      </section>
      <div className="champ-stats">
        <div className="card champ-stat"><span className="small muted">{T.winRate}</span><span className="champ-v num">{T.pct2(stats.gameWinRate)}</span></div>
        <div className="card champ-stat"><span className="small muted">{T.games}</span><span className="champ-v num">{fmtInt(stats.games)}</span></div>
        <div className="card champ-stat"><span className="small muted">{T.share}</span><span className="champ-v num">{fmtPct(share(stats))}</span></div>
        <div className="card champ-stat">
          <span className="small muted">{T.scaling}</span>
          <div className="champ-scaling">
            {stats.scaling.map((v, i) => (
              <div key={i}>
                <span className="small soft">{T.phases[i]} <span className="muted num">{String(v).replace('.', ',')}</span></span>
                <span className="champ-bar"><i style={{ width: (v / 4) * 100 + '%' }} /></span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <nav className="champ-tabs" aria-label={T.tabsLabel}>
        {CHAMPION_TABS.map((t) => (
          <a key={t} className={'champ-tab' + (route.tab === t ? ' is-on' : '')} aria-current={route.tab === t ? 'page' : undefined} href={championHash(row.name, role, t)}>{T.tabs[t]}</a>
        ))}
      </nav>
      {route.tab === 'matchups' ? (
        <Matchups key={role} champion={row.name} role={role} stats={stats} canLoad={canLoad} />
      ) : route.tab === 'duos' ? (
        <Duos key={role} role={role} stats={stats} />
      ) : (
        <ChampionBuild key={role} champion={row.name} role={role} stats={stats} opponent={route.opponent} direct={direct} canLoad={canLoad} />
      )}
    </>
  );
};

/**
 * `route` : fiche affichée, null pour la liste. `draft` : draft en cours (bandeau des deux équipes, matchup direct),
 * null sinon. `canLoad` : chargement à la demande disponible (appli desktop).
 */
export const ChampionsScreen = ({ route, draft, canLoad }: { route: ChampionRoute | null; draft: DraftState | null; canLoad: boolean }) => {
  const champions = useChampions();
  const row = route ? champions.find((c) => c.name === route.champion) : undefined;
  // En haut de la fiche à chaque champion ouvert.
  useEffect(() => {
    if (row) window.scrollTo({ top: 0 });
  }, [row?.name]);
  return (
    <main className="champions">
      {draft && <DraftBar draft={draft} />}
      {row && route ? <ChampionDetail key={row.name} row={row} route={route} draft={draft} canLoad={canLoad} /> : <ChampionList />}
    </main>
  );
};
