import { useEffect, useMemo, useRef, useState } from 'react';
import { proposeBuild, type BuildProposal } from '@draft/engine';
import { BUILD_TEXT as B, CHAMPIONS_TEXT as T, fmtInt, fmtSigned } from '@draft/i18n-fr';
import { emptySlots, type Build, type Candidate, type Role } from '@draft/schemas';
import { BuildBoard, POPULAR_MAX } from './BuildBoard';
import { Portrait, useData } from '../ui';
import { loadBuild, useLoads, type LoadState } from './loader';
import { championHash } from './route';

// Onglet Build de la fiche d'un champion : build général (snapshot), ou build contre un adversaire de lane chargé sur
// Lolalytics au clic (appli desktop). Pages de runes complètes chargées au clic sur une rune principale.

const Fail = ({ title, error, onRetry }: { title: string; error: keyof typeof T.fail; onRetry: () => void }) => (
  <div className="card champ-fail" role="alert">
    <span className="strong">{title}</span>
    <span className="champ-why">{T.fail[error][0]}</span>
    <span className="small muted">{T.fail[error][1]}</span>
    <button type="button" className="btn btn-sm" onClick={onRetry}>{T.retry}</button>
  </div>
);

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
  // Identifiants d'URL relevés par la collecte (absents d'un snapshot antérieur : déduits des noms par l'appli).
  const slugs = snapshot.lolalyticsSlugs ?? {};
  const slug = slugs[champion];
  const vsKey = selected ? { patch, champion, role, opponent: selected, slug, opponentSlug: slugs[selected] } : null;
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
  const pageKey = (keystone: number) => ({ patch, champion, role, keystone, slug });
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
