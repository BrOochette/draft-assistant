import { useState, type ReactNode } from 'react';
import type { BuildChoice, BuildOption, BuildProposal } from '@draft/engine';
import { BUILD_TEXT as B, buildReasonText } from '@draft/i18n-fr';
import { Portrait, useData } from '../ui';
import { Splash } from './Cards';

// Build proposé pour ton pick : runes, sorts, départ, bottes, objets principaux et situationnels, avec les icônes
// fournies avec l'appli (aucun appel réseau).

type Kind = 'item' | 'rune' | 'tree' | 'spell';

/** Icône d'un objet, d'une rune ou d'un sort ; sans fichier, le nom seul. */
const BuildIcon = ({ kind, id, size = 32 }: { kind: Kind; id: number; size?: number }) => {
  const { buildCatalog } = useData();
  const [failed, setFailed] = useState(false);
  const name = (kind === 'item' ? buildCatalog?.items[id] : kind === 'spell' ? buildCatalog?.spells[id] : kind === 'tree' ? buildCatalog?.trees[id] : buildCatalog?.runes[id])?.name ?? String(id);
  if (failed) return <span className="build-icon is-text" title={name}>{name}</span>;
  return (
    <span className="build-icon" style={{ width: size, height: size }} role="img" aria-label={name} title={name}>
      <img src={import.meta.env.BASE_URL + 'build/' + kind + '/' + id + '.png'} alt="" onError={() => setFailed(true)} />
    </span>
  );
};

const useName = () => {
  const { buildCatalog } = useData();
  return (kind: 'item' | 'rune' | 'spell', id: number) =>
    (kind === 'item' ? buildCatalog?.items[id] : kind === 'spell' ? buildCatalog?.spells[id] : buildCatalog?.runes[id])?.name ?? String(id);
};

const Stats = ({ o }: { o: { winRate: number; games: number } }) => (
  <span className="small muted nowrap" title={B.statsTip}>{B.stats(o.winRate, o.games)}</span>
);

const Block = ({ title, stats, wide = false, children }: { title: string; stats?: BuildOption<unknown> | null; wide?: boolean; children: ReactNode }) => (
  <section className={'build-block' + (wide ? ' is-wide' : '')} aria-label={title}>
    <span className="build-head">
      <span className="eyebrow">{title}</span>
      {stats && <Stats o={stats} />}
    </span>
    {children}
  </section>
);

const Reason = ({ choice }: { choice: { reason: BuildChoice<unknown>['reason'] } | null }) =>
  choice?.reason ? <span className="small accent-text">{buildReasonText(choice.reason)}</span> : null;

/** Autres options d'un choix : petites icônes, win rate et parties. */
const Alternatives = <T,>({ list, icons, label = B.others }: { list: BuildOption<T>[]; icons: (v: T) => ReactNode; label?: string }) =>
  list.length ? (
    <div className="build-alts" aria-label={label}>
      <span className="small muted">{label}</span>
      {list.map((o, i) => (
        <span key={i} className="build-row build-alt">
          {icons(o.value)}
          <Stats o={o} />
        </span>
      ))}
    </div>
  ) : null;

const RunePage = ({ page, label }: { page: BuildProposal['runes'][number]; label: string }) => {
  const name = useName();
  const { buildCatalog } = useData();
  const tree = (rune: number | undefined) => (rune != null ? buildCatalog?.runes[rune]?.tree : undefined);
  const primaryTree = tree(page.primary[0]);
  const secondaryTree = tree(page.secondary[0]);
  return (
    <div className="build-runes">
      <span className="build-head">
        <span className="small strong">{label} · {name('rune', page.primary[0]!)}</span>
        <Stats o={page} />
      </span>
      <span className="build-row">
        {primaryTree != null && <BuildIcon kind="tree" id={primaryTree} size={22} />}
        <BuildIcon kind="rune" id={page.primary[0]!} size={40} />
        {page.primary.slice(1).map((id) => <BuildIcon key={id} kind="rune" id={id} size={28} />)}
        {secondaryTree != null && <BuildIcon kind="tree" id={secondaryTree} size={22} />}
        {page.secondary.map((id) => <BuildIcon key={id} kind="rune" id={id} size={28} />)}
      </span>
      <span className="small muted">{page.shards.map((id) => name('rune', id)).join(' · ')}</span>
    </div>
  );
};

export const BuildPanel = ({ build, opponent }: { build: BuildProposal; opponent: string | null }) => {
  const name = useName();
  const items = (ids: number[], size = 22) => ids.map((id, i) => <BuildIcon key={i} kind="item" id={id} size={size} />);
  return (
    <section aria-label={B.region(build.champion)} className="card fit-focus build-panel">
      <div className="build-title">
        <Splash name={build.champion} />
        <Portrait name={build.champion} size={44} />
        <span className="col min0">
          <span className="h3">{B.title(build.champion)}</span>
          <span className="small muted">{build.role}{opponent ? ' · ' + B.vs(opponent) : ''}</span>
        </span>
      </div>
      <div className="build-grid">
        {build.runes.length > 0 && (
          <Block title={B.runes} wide>
            <div className="build-pages">
              {build.runes.map((page, i) => <RunePage key={i} page={page} label={i === 0 ? B.mostPlayed : B.bestWinRate} />)}
            </div>
          </Block>
        )}
        <div className="build-trio">
          {build.spells && (
            <Block title={B.spells} stats={build.spells}>
              <span className="build-row">
                {build.spells.value.map((id) => <BuildIcon key={id} kind="spell" id={id} />)}
              </span>
              <Alternatives list={build.spells.alternatives} icons={(ids) => ids.map((id) => <BuildIcon key={id} kind="spell" id={id} size={22} />)} />
            </Block>
          )}
          {build.start && (
            <Block title={B.start} stats={build.start}>
              <span className="build-row">{items(build.start.value, 32)}</span>
              <Reason choice={build.start} />
              <Alternatives list={build.start.alternatives} icons={(ids) => items(ids)} />
            </Block>
          )}
          {build.boots && (
            <Block title={B.boots} stats={build.boots}>
              <span className="build-row">
                <BuildIcon kind="item" id={build.boots.value} />
                <span className="small">{name('item', build.boots.value)}</span>
              </span>
              <Reason choice={build.boots} />
              <Alternatives list={build.boots.alternatives} icons={(id) => items([id])} />
            </Block>
          )}
        </div>
        {build.core.length > 0 && (
          <Block title={B.core} wide>
            <ol className="plain-list build-core">
              {build.core.map((c, i) => (
                <li key={c.item} className="build-core-item">
                  <span className="small muted">{B.nth(i + 1)}</span>
                  <span className="build-row">
                    <BuildIcon kind="item" id={c.item} />
                    <span className="col min0">
                      <span className="small">{name('item', c.item)}</span>
                      {c.stats && <Stats o={c.stats} />}
                    </span>
                  </span>
                  <Alternatives list={c.alternatives} label={B.insteadOf(name('item', c.item))} icons={(id) => <>{items([id])}<span className="small ellipsis">{name('item', id)}</span></>} />
                </li>
              ))}
            </ol>
          </Block>
        )}
        <Block title={B.situational} wide>
          {build.situational.length === 0 && <span className="small muted">{B.noSituational}</span>}
          <ul className="plain-list build-items">
            {build.situational.map((s) => (
              <li key={s.items[0]} className="build-row build-sit">
                <BuildIcon kind="item" id={s.items[0]!} />
                <span className="col min0 grow">
                  <span className="small">{name('item', s.items[0]!)}</span>
                  <span className="small accent-text">{buildReasonText(s.reason)}</span>
                  {s.items.length > 1 && (
                    <span className="build-row build-sit-alts" aria-label={B.insteadOf(name('item', s.items[0]!))}>
                      <span className="small muted">{B.or}</span>
                      {s.items.slice(1).map((id) => (
                        <span key={id} className="build-row">{items([id])}<span className="small">{name('item', id)}</span></span>
                      ))}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Block>
      </div>
    </section>
  );
};
