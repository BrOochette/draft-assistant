import { useState, type ReactNode } from 'react';
import type { BuildChoice, BuildOption, BuildProposal } from '@draft/engine';
import { BUILD_TEXT as B, CHAMPIONS_TEXT as T, buildReasonText, fmtInt, fmtPct } from '@draft/i18n-fr';
import type { Build } from '@draft/schemas';
import { BuildIcon, Runes, useName } from '../fit/Build';
import { useData } from '../ui';

// Affichage d'un build, commun à la fiche d'un champion et à l'onglet Build de la draft.

/** Objets les plus construits affichés à côté des objets principaux. */
export const POPULAR_MAX = 10;
const KEYS = ['Q', 'W', 'E', 'R'] as const;

export const WrGames = ({ o }: { o: { winRate: number; games: number } | null | undefined }) =>
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

/** Build affiché : styles, runes, sorts, départ, bottes, compétences, objets principaux et plus construits, 4e et 5e objets. */
export const BuildBoard = ({ build, popular, skills, ddragonId, runes }: {
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
