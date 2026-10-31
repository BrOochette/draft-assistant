import { createContext, useContext, useState, type ReactNode } from 'react';
import type { BuildProposal } from '@draft/engine';
import { BUILD_TEXT as B, fmtInt, fmtPct } from '@draft/i18n-fr';
import type { Role } from '@draft/schemas';
import { Portrait, useData } from '../ui';

// Briques du build d'un champion : champion regardé, icônes (fournies avec l'appli, aucun appel réseau), runes, choix
// du pick dont on regarde le build.

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

export const useName = () => {
  const { buildCatalog } = useData();
  return (kind: Kind, id: number) =>
    (kind === 'item' ? buildCatalog?.items[id] : kind === 'spell' ? buildCatalog?.spells[id] : kind === 'tree' ? buildCatalog?.trees[id] : buildCatalog?.runes[id])?.name ?? String(id);
};

/** Icône d'un objet, d'une rune ou d'un sort ; sans fichier, le nom seul. `tip` : infobulle à la place du nom. */
export const BuildIcon = ({ kind, id, size = 32, tip }: { kind: Kind; id: number; size?: number; tip?: string }) => {
  const name = useName()(kind, id);
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="build-icon is-text" title={tip ?? name}>{name}</span>;
  return (
    <span className="build-icon" style={{ width: size, height: size }} role="img" aria-label={tip ?? name} title={tip ?? name}>
      <img src={import.meta.env.BASE_URL + 'build/' + kind + '/' + id + '.png'} alt="" onError={() => setFailed(true)} />
    </span>
  );
};

export const Section = ({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) => (
  <section className={'build-section ' + className} aria-label={title}>
    <span className="build-head"><span className="eyebrow">{title}</span></span>
    {children}
  </section>
);

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
 * rune principale, seule elle est marquée, ou `missing` l'affiche (chargement à la demande). `withPagesOnly` : seules les
 * runes principales qui ont une page complète (site web, sans chargement).
 */
export const Runes = ({ pages, keystones, missing, onChoose, withPagesOnly }: {
  pages: BuildProposal['runes'];
  keystones: BuildProposal['keystones'];
  missing?: (keystone: number) => ReactNode;
  onChoose?: (keystone: number) => void;
  withPagesOnly?: boolean;
}) => {
  const name = useName();
  const { buildCatalog } = useData();
  // Sans stats par rune (collecte antérieure) : la rune principale de chaque page.
  const all = keystones.length ? keystones : pages.map((p) => ({ value: p.primary[0]!, winRate: p.winRate, games: p.games }));
  const options = withPagesOnly ? all.filter((k) => pages.some((p) => p.primary[0] === k.value)) : all;
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
          <button key={k.value} type="button" className={'build-keystone' + (k.value === chosen ? ' is-on' : '')} aria-pressed={k.value === chosen} title={B.stats(k.winRate, k.games)} onClick={() => {
            setChosen(k.value);
            onChoose?.(k.value);
          }}>
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
      ) : chosen != null && missing ? missing(chosen) : <span className="small muted">{B.noPage}</span>}
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
