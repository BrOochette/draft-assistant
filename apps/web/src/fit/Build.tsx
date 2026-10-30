import { createContext, useContext, useState, type ReactNode } from 'react';
import type { BuildChoice, BuildOption, BuildProposal } from '@draft/engine';
import { BUILD_TEXT as B, buildReasonText, fmtInt, fmtPct } from '@draft/i18n-fr';
import type { Role } from '@draft/schemas';
import { Portrait, useData } from '../ui';
import { Splash } from './Cards';

// Build d'un champion : styles joués, runes, sorts, départ, bottes, chemin d'objets et objets situationnels, sur un
// seul écran, avec les icônes fournies avec l'appli (aucun appel réseau).

/** Champion dont on regarde le build : son rôle et son équipe (le build tient compte des deux compos de son point de vue). */
export interface BuildTarget {
  champion: string;
  role: Role;
  side: 'ally' | 'enemy';
}

/**
 * Champion en focus de l'écran Draft, partagé par les onglets Picks et Build : un clic sur une suggestion ou un pick le
 * choisit. null hors de l'écran Draft.
 */
export const ChampionFocus = createContext<{ target: BuildTarget | null; select: (t: BuildTarget) => void } | null>(null);

/** Props d'un élément cliquable qui met un champion en focus (carte, ligne), et s'il est en focus. */
export const useChampionFocus = (target: BuildTarget) => {
  const ctx = useContext(ChampionFocus);
  const on = !!ctx?.target && ctx.target.champion === target.champion && ctx.target.role === target.role && ctx.target.side === target.side;
  return {
    selected: on,
    onSelect: ctx
      ? (e: { target: EventTarget }) => {
          // Les boutons de la carte (Verrouiller…) gardent leur action.
          if ((e.target as HTMLElement).closest('button, a, input')) return;
          ctx.select(target);
        }
      : undefined
  };
};

type Kind = 'item' | 'rune' | 'tree' | 'spell';

const useName = () => {
  const { buildCatalog } = useData();
  return (kind: Kind, id: number) =>
    (kind === 'item' ? buildCatalog?.items[id] : kind === 'spell' ? buildCatalog?.spells[id] : kind === 'tree' ? buildCatalog?.trees[id] : buildCatalog?.runes[id])?.name ?? String(id);
};

/** Icône d'un objet, d'une rune ou d'un sort ; sans fichier, le nom seul. `tip` : infobulle à la place du nom. */
const BuildIcon = ({ kind, id, size = 32, tip }: { kind: Kind; id: number; size?: number; tip?: string }) => {
  const name = useName()(kind, id);
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="build-icon is-text" title={tip ?? name}>{name}</span>;
  return (
    <span className="build-icon" style={{ width: size, height: size }} role="img" aria-label={tip ?? name} title={tip ?? name}>
      <img src={import.meta.env.BASE_URL + 'build/' + kind + '/' + id + '.png'} alt="" onError={() => setFailed(true)} />
    </span>
  );
};

const Stats = ({ o }: { o: { winRate: number; games: number } }) => (
  <span className="small muted nowrap" title={B.statsTip}>{B.stats(o.winRate, o.games)}</span>
);

/** Infobulle d'une option : nom (ou noms), win rate et parties. */
const tipOf = (names: string, o: BuildOption<unknown>) => names + ' · ' + B.stats(o.winRate, o.games);

const Section = ({ title, stats, children, className = '' }: { title: string; stats?: BuildOption<unknown> | null; children: ReactNode; className?: string }) => (
  <section className={'build-section ' + className} aria-label={title}>
    <span className="build-head">
      <span className="eyebrow">{title}</span>
      {stats && <Stats o={stats} />}
    </span>
    {children}
  </section>
);

const Reason = ({ choice }: { choice: { reason: BuildChoice<unknown>['reason'] } | null }) =>
  choice?.reason ? <span className="small accent-text build-reason">{buildReasonText(choice.reason)}</span> : null;

/** Autres options, en petites icônes après « ou » ; win rate et parties dans l'infobulle. */
const Or = <T,>({ list, icons }: { list: BuildOption<T>[]; icons: (v: T, tip: (names: string) => string) => ReactNode }) =>
  list.length ? (
    <span className="build-or" aria-label={B.others}>
      <span className="small muted">{B.or}</span>
      {list.map((o, i) => <span key={i} className="build-row">{icons(o.value, (names) => tipOf(names, o))}</span>)}
    </span>
  ) : null;

/** Lignes d'un arbre de runes ou des fragments : runes prises en couleur, les autres estompées. */
const RuneRows = ({ rows, picked, size, first }: { rows: number[][]; picked: (row: number, id: number) => boolean; size: number; first?: number }) => (
  <span className="rune-rows">
    {rows.map((row, i) => (
      <span key={i} className="rune-row">
        {row.map((id, j) => (
          // Cases de même largeur dans tout l'arbre : les lignes de 3 restent centrées sous celle des runes principales.
          <span key={j} className={'rune-slot'} style={{ width: (first ?? size) + 6 }}>
          <span className={'rune-cell' + (picked(i, id) ? ' is-picked' : '')}>
            <BuildIcon kind="rune" id={id} size={i === 0 && first ? first : size} />
          </span>
          </span>
        ))}
      </span>
    ))}
  </span>
);

/**
 * Runes : une ligne par rune principale jouée (win rate, parties), puis l'arborescence complète de la ligne choisie :
 * arbre principal, arbre secondaire et fragments, runes prises en couleur. Sans page complète collectée pour cette
 * rune principale, seule elle est marquée.
 */
const Runes = ({ pages, keystones }: { pages: BuildProposal['runes']; keystones: BuildProposal['keystones'] }) => {
  const name = useName();
  const { buildCatalog } = useData();
  // Sans stats par rune (collecte antérieure) : la rune principale de chaque page.
  const options = keystones.length ? keystones : pages.map((p) => ({ value: p.primary[0]!, winRate: p.winRate, games: p.games }));
  const [chosen, setChosen] = useState(pages[0]?.primary[0] ?? options[0]?.value);
  const page = pages.find((p) => p.primary[0] === chosen);
  const treeOf = (rune: number | undefined) => (rune != null ? buildCatalog?.runes[rune]?.tree : undefined);
  const primaryId = treeOf(chosen);
  const secondaryId = treeOf(page?.secondary[0]);
  const primary = primaryId != null ? buildCatalog?.trees[primaryId] : undefined;
  const secondary = secondaryId != null ? buildCatalog?.trees[secondaryId] : undefined;
  const picked = new Set([...(page ? [...page.primary, ...page.secondary] : chosen != null ? [chosen] : [])]);
  const shardRows = buildCatalog?.shardRows ?? [];
  return (
    <Section title={B.runes} className="build-runes">
      <div role="group" aria-label={B.keystones} className="build-keystones">
        {options.map((k) => (
          <button key={k.value} type="button" className={'build-keystone' + (k.value === chosen ? ' is-on' : '')} aria-pressed={k.value === chosen} title={B.stats(k.winRate, k.games)} onClick={() => setChosen(k.value)}>
            <BuildIcon kind="rune" id={k.value} size={32} />
            <span className="small strong ellipsis grow">{name('rune', k.value)}</span>
            <span className="col build-keystone-stats">
              <span className="small strong">{fmtPct(k.winRate)}</span>
              <span className="small muted nowrap">{fmtInt(k.games)}</span>
            </span>
          </button>
        ))}
      </div>
      {primary && (
        <div className="rune-tree">
          <span className="build-row">{primaryId != null && <BuildIcon kind="tree" id={primaryId} size={18} />}<span className="small muted">{primary.name}</span></span>
          <RuneRows rows={primary.slots} picked={(_, id) => picked.has(id)} size={32} first={40} />
        </div>
      )}
      {page ? (
        <div className="rune-bottom">
          {secondary && (
            <div className="rune-tree">
              <span className="build-row">{secondaryId != null && <BuildIcon kind="tree" id={secondaryId} size={18} />}<span className="small muted">{secondary.name}</span></span>
              <RuneRows rows={secondary.slots.slice(1)} picked={(_, id) => picked.has(id)} size={28} />
            </div>
          )}
          {shardRows.length > 0 && (
            <div className="rune-tree" title={page.shards.map((id) => name('rune', id)).join(' · ')}>
              <span className="small muted">{B.shards}</span>
              <RuneRows rows={shardRows} picked={(row, id) => page.shards[row] === id} size={22} />
            </div>
          )}
        </div>
      ) : <span className="small muted">{B.noPage}</span>}
    </Section>
  );
};

/** Barre des picks connus des deux équipes, à part du build : un clic montre leur build. Ton pick est marqué « Moi ». */
export const BuildPicks = ({ picks, current, mine, onSelect }: { picks: BuildTarget[]; current: BuildTarget | null; mine: BuildTarget | null; onSelect: (t: BuildTarget) => void }) => {
  const button = (p: BuildTarget) => {
    const on = !!current && p.champion === current.champion && p.role === current.role && p.side === current.side;
    return (
      <button key={p.side + p.role} type="button" className={'build-pick is-' + p.side + (on ? ' is-on' : '')} aria-pressed={on} title={B.explore(p.champion, p.role)} onClick={() => onSelect(p)}>
        <Portrait name={p.champion} size={30} label={p.champion} />
        {mine && p.champion === mine.champion && p.side === mine.side && <span className="build-pick-me">{B.me}</span>}
      </button>
    );
  };
  const allies = picks.filter((p) => p.side === 'ally');
  const enemies = picks.filter((p) => p.side === 'enemy');
  return (
    <div role="group" aria-label={B.picks} className="build-picks">
      <span className="build-row">{allies.map(button)}</span>
      <span className="build-row">{enemies.map(button)}</span>
    </div>
  );
};

export const BuildPanel = ({ build, opponent, side }: { build: BuildProposal; opponent: string | null; side: BuildTarget['side'] }) => {
  const name = useName();
  const items = (ids: number[], size = 22, tip?: (names: string) => string) =>
    ids.map((id, i) => <BuildIcon key={i} kind="item" id={id} size={size} tip={tip?.(name('item', id))} />);
  // Style choisi (Bruiser, AP…) : le plus joué par défaut ; il fixe le chemin d'objets et les situationnels.
  const [chosen, setChosen] = useState(0);
  const path = build.paths[chosen] ?? build.paths[0]!;
  return (
    <section aria-label={B.region(build.champion)} className="card fit-focus build-panel">
      <div className="build-title">
        <Splash name={build.champion} />
        <Portrait name={build.champion} size={40} />
        <span className="col min0">
          <span className="h3">{B.title(build.champion)}</span>
          <span className="small muted">{build.role}{side === 'enemy' ? ' · ' + B.enemy : ''}{opponent ? ' · ' + B.vs(opponent) : ''}</span>
        </span>
        {build.paths.length > 1 && (
          <div role="group" aria-label={B.styles} className="build-styles">
            {build.paths.map((p, i) => (
              <button key={p.style ?? i} type="button" className={'build-style' + (p === path ? ' is-on' : '')} aria-pressed={p === path} title={p.games != null ? B.styleGames(p.games) : undefined} onClick={() => setChosen(i)}>
                <span className="strong">{p.style ? B.style[p.style] : B.general}</span>
                <span className="build-row">{items(p.core.map((c) => c.item), 20)}</span>
                {p.winRate != null && <span className="small strong nowrap" title={B.styleTip}>{B.wr(p.winRate)}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="build-board">
        <Runes key={build.champion + build.role} pages={build.runes} keystones={build.keystones} />

        <div className="build-basics">
          {build.spells && (
            <Section title={B.spells} stats={build.spells}>
              <span className="build-row">
                {build.spells.value.map((id) => <BuildIcon key={id} kind="spell" id={id} size={40} />)}
                <Or list={build.spells.alternatives} icons={(ids, tip) => ids.map((id) => <BuildIcon key={id} kind="spell" id={id} size={26} tip={tip(ids.map((x) => name('spell', x)).join(' + '))} />)} />
              </span>
            </Section>
          )}
          {build.start && (
            <Section title={B.start} stats={build.start}>
              <span className="build-row">
                {items(build.start.value, 40)}
                <Or list={build.start.alternatives} icons={(ids, tip) => items(ids, 26, () => tip(ids.map((x) => name('item', x)).join(' + ')))} />
              </span>
              <Reason choice={build.start} />
            </Section>
          )}
          {build.boots && (
            <Section title={B.boots} stats={build.boots}>
              <span className="build-row">
                {items([build.boots.value], 40)}
                <Or list={build.boots.alternatives} icons={(id, tip) => items([id], 26, tip)} />
              </span>
              <Reason choice={build.boots} />
            </Section>
          )}
        </div>

        <div className="build-items">
          {path.core.length > 0 && (
            <Section title={B.core}>
              <ol className="plain-list build-path">
                {path.core.map((c, i) => (
                  <li key={c.item} className="build-step">
                    {i > 0 && <span className="build-arrow" aria-hidden="true">›</span>}
                    <span className="col build-step-body">
                      {items([c.item], 46)}
                      <span className="small ellipsis">{name('item', c.item)}</span>
                      {c.stats && <span className="small muted nowrap" title={B.statsTip}>{B.wr(c.stats.winRate)}</span>}
                      <Or list={c.alternatives} icons={(id, tip) => items([id], 28, tip)} />
                    </span>
                  </li>
                ))}
              </ol>
              {path.later.some((l) => l.length > 0) && (
                <div className="build-later">
                  {path.later.map((list, i) => (
                    <div key={i} className="build-later-slot">
                      <span className="small muted">{B.nth(i + 4)}</span>
                      {list.length === 0 && <span className="small muted">—</span>}
                      {list.map((o) => (
                        <span key={o.value} className="build-row">
                          {items([o.value], 32)}
                          <span className="col min0">
                            <span className="small ellipsis">{name('item', o.value)}</span>
                            <span className="small muted nowrap" title={B.statsTip}>{B.wr(o.winRate)}</span>
                          </span>
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}
          <Section title={B.situational}>
            {path.situational.length === 0 && <span className="small muted">{B.noSituational}</span>}
            <ul className="plain-list build-sits">
              {path.situational.map((s) => (
                <li key={s.items[0]} className="build-row build-sit">
                  {items([s.items[0]!], 42)}
                  <span className="col min0 grow">
                    <span className="small ellipsis">{name('item', s.items[0]!)}</span>
                    <span className="small accent-text ellipsis" title={buildReasonText(s.reason)}>{buildReasonText(s.reason)}</span>
                  </span>
                  {s.items.length > 1 && (
                    <span className="build-or">
                      <span className="small muted">{B.or}</span>
                      {items(s.items.slice(1), 30)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </section>
  );
};
