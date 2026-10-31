import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { proposeBuild, type BuildChoice, type BuildOption, type BuildProposal } from '@draft/engine';
import { BUILD_TEXT as B, CHAMPIONS_TEXT as T, buildReasonText, fmtInt, fmtPct, fmtSigned } from '@draft/i18n-fr';
import { emptySlots, type Build, type Candidate, type Role } from '@draft/schemas';
import { BuildIcon, Runes, useName } from '../fit/Build';
import { Portrait, useData } from '../ui';
import { loadBuild, useLoads, type LoadState } from './loader';
import { championHash } from './route';

// Onglet Build de la fiche d'un champion : build général (snapshot), ou build contre un adversaire de lane chargé sur
// Lolalytics au clic (appli desktop). Pages de runes complètes chargées au clic sur une rune principale.

/** Objets les plus construits affichés à côté des objets principaux. */
const POPULAR_MAX = 10;
const KEYS = ['Q', 'W', 'E', 'R'] as const;

const WrGames = ({ o }: { o: { winRate: number; games: number } | null | undefined }) =>
  o ? (
    <span className="champ-wrg num" title={B.statsTip}>
      <span className="small strong">{fmtPct(o.winRate)}</span>
      <span className="small muted">{fmtInt(o.games)}</span>
    </span>
  ) : <span className="small muted">–</span>;

/** Option retenue en grand, puis les autres options jouées, plus petites. */
const Choice = <V,>({ choice, icons }: { choice: BuildChoice<V> | null; icons: (v: V, size: number) => ReactNode }) =>
  choice ? (
    <>
      <div className="champ-opt"><span className="champ-icons">{icons(choice.value, 40)}</span><WrGames o={choice} /></div>
      {choice.alternatives.map((a, i) => (
        <div key={i} className="champ-opt is-alt"><span className="champ-icons">{icons(a.value, 32)}</span><WrGames o={a} /></div>
      ))}
      {choice.reason && <span className="small accent-text">{buildReasonText(choice.reason)}</span>}
    </>
  ) : <span className="small muted">–</span>;

/** Icône d'une compétence (Data Dragon, téléchargée à l'ingestion) et sa touche. */
const Ability = ({ ddragonId, k, size }: { ddragonId: string; k: (typeof KEYS)[number]; size: number }) => {
  const { buildCatalog } = useData();
  const name = buildCatalog?.abilities[ddragonId]?.[KEYS.indexOf(k)];
  const [failed, setFailed] = useState(false);
  return (
    <span className="champ-ab" title={name ? k + ' · ' + name : k} role="img" aria-label={name ? k + ' · ' + name : k}>
      {failed ? <span className="champ-ab-empty" style={{ width: size, height: size }} /> : (
        <img src={import.meta.env.BASE_URL + 'build/ability/' + ddragonId + '_' + k + '.png'} width={size} height={size} alt="" onError={() => setFailed(true)} />
      )}
      <b>{k}</b>
    </span>
  );
};

/** Compétences : priorité de montée la plus jouée et les autres, puis l'ordre des 15 premiers niveaux le plus joué. */
const Skills = ({ ddragonId, skills }: { ddragonId: string; skills: NonNullable<Build['skills']> }) => {
  const [main, ...alts] = skills.priority;
  const order = skills.order[0];
  if (!main && !order) return null;
  const prio = (keys: string, size: number) =>
    [...keys].map((k, i) => (
      <span key={i} className="champ-prio-step">
        {i > 0 && <span className="muted small" aria-hidden="true">›</span>}
        <Ability ddragonId={ddragonId} k={k as (typeof KEYS)[number]} size={size} />
      </span>
    ));
  return (
    <section className="card champ-skills" aria-label={T.skills}>
      <div>
        <h3 className="champ-sec">{T.skills}</h3>
        {main && <div className="champ-opt"><span className="champ-prio">{prio(main[0], 34)}</span><WrGames o={{ winRate: main[1], games: main[2] }} /></div>}
        {alts.map(([keys, wr, games]) => (
          <div key={keys} className="champ-opt is-alt"><span className="champ-prio">{prio(keys, 24)}</span><WrGames o={{ winRate: wr, games }} /></div>
        ))}
      </div>
      {order && (
        <div className="min0">
          <div className="champ-levels" role="table" aria-label={T.skillsOrder}>
            <span />
            {Array.from({ length: order[0].length }, (_, i) => <span key={i} className="champ-lv">{i + 1}</span>)}
            {KEYS.map((k) => (
              <span key={k} className="champ-levels-row" role="row">
                <Ability ddragonId={ddragonId} k={k} size={26} />
                {[...order[0]].map((x, i) => (
                  <span key={i} className={'champ-cell' + (x === k ? ' is-on' + (k === 'R' ? ' is-r' : '') : '')}>{x === k ? i + 1 : ''}</span>
                ))}
              </span>
            ))}
          </div>
          <div className="champ-lv-foot small">
            <span className="muted">{T.skillsOrder}</span>
            <span className="num"><span className="strong">{fmtPct(order[1])}</span> <span className="muted">{fmtInt(order[2])}</span></span>
          </div>
        </div>
      )}
    </section>
  );
};

const Fail = ({ title, error, onRetry }: { title: string; error: keyof typeof T.fail; onRetry: () => void }) => (
  <div className="card champ-fail" role="alert">
    <span className="strong">{title}</span>
    <span className="champ-why">{T.fail[error][0]}</span>
    <span className="small muted">{T.fail[error][1]}</span>
    <button type="button" className="btn btn-sm" onClick={onRetry}>{T.retry}</button>
  </div>
);

/** Build affiché : styles, runes, sorts, départ, bottes, compétences, objets principaux et plus construits, 4e à 6e objet. */
const BuildBoard = ({ build, popular, skills, ddragonId, runes }: {
  build: BuildProposal;
  popular: Build['items'];
  skills: Build['skills'];
  ddragonId: string;
  runes: { missing?: (keystone: number) => ReactNode; onChoose?: (keystone: number) => void; withPagesOnly?: boolean };
}) => {
  const name = useName();
  const [chosen, setChosen] = useState(0);
  const path = build.paths[chosen] ?? build.paths[0]!;
  const items = (ids: number[], size: number) => ids.map((id, i) => <BuildIcon key={i} kind="item" id={id} size={size} />);
  return (
    <>
      {build.paths.length > 1 && (
        <div role="group" aria-label={B.styles} className="champ-styles">
          <span className="small muted">{B.styles}</span>
          {build.paths.map((p, i) => (
            <button key={p.style ?? i} type="button" className={'btn btn-sm champ-style' + (p === path ? ' is-on' : '')} aria-pressed={p === path} title={B.styleTip} onClick={() => setChosen(i)}>
              <span className="strong">{p.style ? B.style[p.style] : B.general}</span>
              <span className="build-row">{items(p.core.map((c) => c.item), 24)}</span>
              {p.winRate != null && <span className="small num">{fmtPct(p.winRate)}{p.games != null ? ' · ' + fmtInt(p.games) : ''}</span>}
            </button>
          ))}
        </div>
      )}
      <div className="champ-board">
        <section className="card champ-runes">
          <Runes key={build.champion + build.role} pages={build.runes} keystones={build.keystones} {...runes} />
        </section>
        <div className="champ-right">
          <div className="champ-basics">
            <section className="card"><h3 className="champ-sec">{B.spells}</h3><Choice choice={build.spells} icons={(ids, s) => ids.map((id) => <BuildIcon key={id} kind="spell" id={id} size={s} />)} /></section>
            <section className="card"><h3 className="champ-sec">{B.start}</h3><Choice choice={build.start} icons={(ids, s) => items(ids, s)} /></section>
            <section className="card"><h3 className="champ-sec">{B.boots}</h3><Choice choice={build.boots} icons={(id, s) => items([id], s)} /></section>
          </div>
          {skills && <Skills ddragonId={ddragonId} skills={skills} />}
          <section className="card champ-core">
            <div>
              <h3 className="champ-sec">{B.core}</h3>
              <ol className="plain-list champ-path">
                {path.core.map((c, i) => (
                  <li key={c.item} className="champ-step">
                    {i > 0 && <span className="champ-arrow" aria-hidden="true">→</span>}
                    <span className="champ-step-body">
                      <span className="small muted">{T.nthItem(i + 1)}</span>
                      <BuildIcon kind="item" id={c.item} size={46} />
                      <span className="small soft">{name('item', c.item)}</span>
                      <WrGames o={c.stats} />
                      {c.alternatives.length > 0 && (
                        <span className="champ-alts" aria-label={B.others}>
                          {c.alternatives.map((a) => <BuildIcon key={a.value} kind="item" id={a.value} size={26} tip={name('item', a.value) + ' · ' + B.stats(a.winRate, a.games)} />)}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            {popular.length > 0 && (
              <div className="champ-popular">
                <h3 className="champ-sec">{T.popular}</h3>
                <div className="champ-pop-items">
                  {popular.map(([id, winRate, games]) => (
                    <div key={id} className="champ-opt"><BuildIcon kind="item" id={id} size={32} /><WrGames o={{ winRate, games }} /></div>
                  ))}
                </div>
              </div>
            )}
          </section>
          <section className="card champ-later">
            {path.later.map((list: BuildOption<number>[], i) => (
              <div key={i}>
                <h3 className="champ-sec">{B.nth(i + 4)}</h3>
                {list.length === 0 && <span className="small muted">–</span>}
                {list.map((o) => <div key={o.value} className="champ-opt"><BuildIcon kind="item" id={o.value} size={32} /><WrGames o={o} /></div>)}
              </div>
            ))}
          </section>
          {path.situational.length > 0 && (
            <section className="card">
              <h3 className="champ-sec">{B.situational}</h3>
              <ul className="plain-list champ-sits">
                {path.situational.map((s) => (
                  <li key={s.items[0]} className="champ-opt">
                    <span className="champ-icons">{items(s.items, 32)}</span>
                    <span className="small accent-text">{buildReasonText(s.reason)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
};

/** Liste « Contre » : tous les adversaires (build général), puis les adversaires de lane du plus joué au moins joué. */
const OpponentPicker = ({ opponents, selected, stats, hrefOf }: {
  opponents: [string, number, number][];
  selected: string | null;
  stats: Candidate;
  hrefOf: (opponent: string | null) => string;
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  const needle = q.trim().toLowerCase();
  const pick = () => {
    setOpen(false);
    setQ('');
  };
  return (
    <div className="champ-picker" ref={ref}>
      <button type="button" className="btn btn-sm champ-pick-btn" aria-expanded={open} aria-haspopup="listbox" onClick={() => setOpen((o) => !o)}>
        {selected ? <><Portrait name={selected} size={22} /><span className="strong">{selected}</span></> : <span className="strong">{T.allOpponents}</span>}
        <span className="muted" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="champ-pop" role="listbox" aria-label={T.opponents}>
          <input className="input btn-sm" type="search" autoFocus placeholder={T.opponentSearch} aria-label={T.opponentSearch} value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="champ-pop-row is-head small muted"><span /><span>{T.opponentHead(opponents.length)}</span><span>{T.winRate}</span><span>{T.games}</span></div>
          <div className="champ-pop-list">
            {!needle && (
              <a className={'champ-pop-row is-all' + (!selected ? ' is-on' : '')} role="option" aria-selected={!selected} href={hrefOf(null)} onClick={pick}>
                <span /><span className="strong small">{T.allOpponents}</span><span className="num small">{T.pct2(stats.gameWinRate)}</span><span className="num small muted">{fmtInt(stats.games)}</span>
              </a>
            )}
            {opponents.filter(([n]) => !needle || n.toLowerCase().includes(needle)).map(([n, wr, games]) => (
              <a key={n} className={'champ-pop-row' + (n === selected ? ' is-on' : '')} role="option" aria-selected={n === selected} href={hrefOf(n)} onClick={pick}>
                <Portrait name={n} size={28} /><span className="strong small">{n}</span><span className="num small">{T.pct2(wr)}</span><span className="num small muted">{fmtInt(games)}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/** Pages de runes chargées (une par rune principale) ajoutées à celles du build. */
const withPages = (b: BuildProposal, pages: Build['runes']): BuildProposal =>
  pages.length ? { ...b, runes: [...b.runes, ...pages.filter((p) => !b.runes.some((x) => x.primary[0] === p.primary[0]))] } : b;

export const ChampionBuild = ({ champion, role, stats, opponent, direct, canLoad }: {
  champion: string;
  role: Role;
  stats: Candidate;
  /** Adversaire choisi dans l'adresse, null : build général. */
  opponent: string | null;
  /** Adversaire direct dans la draft en cours. */
  direct: string | null;
  canLoad: boolean;
}) => {
  const { engine, buildCatalog, snapshot } = useData();
  const loads = useLoads();
  const ddragonId = engine.catalog.get(champion)?.ddragonId ?? '';
  const patch = snapshot.patch;
  const opponents = useMemo(
    () => Object.entries(stats.matchups ?? {}).map(([n, [wr, games]]): [string, number, number] => [n, wr, games]).sort((a, b) => b[2] - a[2]),
    [stats]
  );
  const selected = canLoad && opponent && opponents.some(([n]) => n === opponent) ? opponent : null;
  const vsKey = selected ? { patch, champion, role, opponent: selected } : null;
  const vs: LoadState | undefined = vsKey ? loads(vsKey) : undefined;
  useEffect(() => {
    if (vsKey) loadBuild(vsKey);
  }, [patch, champion, role, selected]);

  const general = useMemo(
    () => (buildCatalog ? proposeBuild({ champion, role, allies: emptySlots(), enemies: emptySlots() }, engine, buildCatalog) : null),
    [buildCatalog, engine, champion, role]
  );
  const vsBuild = useMemo(
    () => (buildCatalog && selected && vs?.status === 'ok' ? proposeBuild({ champion, role, allies: emptySlots(), enemies: { ...emptySlots(), [role]: selected }, build: vs.build }, engine, buildCatalog) : null),
    [buildCatalog, engine, champion, role, selected, vs]
  );

  if (!buildCatalog || !general) return <p className="muted">{T.noBuild}</p>;

  // Pages de runes du build général chargées au clic sur une rune principale.
  const pageKey = (keystone: number) => ({ patch, champion, role, keystone });
  const loadedPages = general.keystones.flatMap((k) => {
    const s = loads(pageKey(k.value));
    return s?.status === 'ok' ? s.build.runes.filter((p) => p.primary[0] === k.value).slice(0, 1).map((p) => ({ ...p, winRate: k.winRate, games: k.games })) : [];
  });
  const missingPage = (keystone: number) => {
    const s = loads(pageKey(keystone));
    if (!s || s.status === 'loading') return <p className="small muted"><span className="champ-spinner" aria-hidden="true" />{T.pageLoading}</p>;
    if (s.status === 'error') {
      return (
        <div className="champ-fail-inline small" role="alert">
          <span className="champ-why">{T.pageFail(T.fail[s.error][0])}</span>
          <button type="button" className="btn btn-sm" onClick={() => loadBuild(pageKey(keystone))}>{T.retry}</button>
        </div>
      );
    }
    return <span className="small muted">{B.noPage}</span>;
  };
  const hrefOf = (o: string | null) => championHash(champion, role, 'build', o);

  if (!canLoad) {
    return <BuildBoard build={general} popular={stats.build?.items.slice(0, POPULAR_MAX) ?? []} skills={stats.build?.skills} ddragonId={ddragonId} runes={{ withPagesOnly: true }} />;
  }

  const ctx = (
    <div className="champ-ctx">
      <span className="small muted">{T.against}</span>
      <OpponentPicker opponents={opponents} selected={selected} stats={stats} hrefOf={hrefOf} />
      {direct && opponents.some(([n]) => n === direct) && (
        <a className={'btn btn-sm direct' + (selected === direct ? ' is-on' : '')} href={hrefOf(direct)} title={T.directTip} aria-current={selected === direct ? 'page' : undefined}>
          <Portrait name={direct} size={22} />
          <span><span className="muted small">{T.direct}</span> <span className="strong">{direct}</span></span>
        </a>
      )}
    </div>
  );

  if (!selected) {
    return (
      <>
        {ctx}
        <BuildBoard
          build={withPages(general, loadedPages)}
          popular={stats.build?.items.slice(0, POPULAR_MAX) ?? []}
          skills={stats.build?.skills}
          ddragonId={ddragonId}
          runes={{ missing: missingPage, onChoose: (k) => { if (!general.runes.some((p) => p.primary[0] === k)) loadBuild(pageKey(k)); } }}
        />
      </>
    );
  }

  const m = stats.matchups?.[selected];
  const oppId = engine.catalog.get(selected)?.ddragonId;
  const banner = (
    <section className="card champ-vs" aria-label={T.buildVs(selected)}>
      {oppId && <img className="champ-blur" src={import.meta.env.BASE_URL + 'champions/' + oppId + '.png'} alt="" aria-hidden="true" />}
      <span className="champ-vs-who">
        <Portrait name={champion} size={44} />
        <span className="small muted">{T.versus}</span>
        <Portrait name={selected} size={44} />
        <span className="h2">{selected}</span>
      </span>
      <span className="champ-vs-stat"><span className="small muted">{T.matchupWr}</span><span className="champ-v num">{m ? T.pct2(m[0]) : '–'}</span></span>
      <span className="champ-vs-stat">
        <span className="small muted">{T.gap}</span>
        <span className={'champ-v num' + (m ? (m[0] - stats.gameWinRate >= 0.05 ? ' pos-text' : m[0] - stats.gameWinRate <= -0.05 ? ' neg-text' : '') : '')}>{m ? fmtSigned(m[0] - stats.gameWinRate) : '–'}</span>
      </span>
      <span className="champ-vs-stat"><span className="small muted">{T.buildGames}</span><span className="champ-v num">{vs?.status === 'ok' ? fmtInt(vs.games) : '–'}</span></span>
      <span className="small muted champ-vs-src">{vs?.status === 'ok' ? T.source(vs.fetchedAt, patch) : ''}</span>
    </section>
  );
  return (
    <>
      {ctx}
      {banner}
      {!vs || vs.status === 'loading' ? (
        <div className="card champ-loading" role="status"><span className="champ-spinner" aria-hidden="true" />{T.loading(selected)}</div>
      ) : vs.status === 'error' ? (
        <Fail title={T.failTitle(selected)} error={vs.error} onRetry={() => loadBuild(vsKey!)} />
      ) : vsBuild ? (
        <BuildBoard key={selected} build={vsBuild} popular={vs.build.items.slice(0, POPULAR_MAX)} skills={vs.build.skills} ddragonId={ddragonId} runes={{}} />
      ) : (
        <p className="muted">{T.noBuild}</p>
      )}
    </>
  );
};
