import { useLayoutEffect, useRef, useState, type Dispatch } from 'react';
import { ARCHETYPE_OF_CLASS, type ArchetypeGroup, type DraftAction, type DraftResult, type Evaluation, type RoleResult } from '@draft/engine';
import {
  allyReadText,
  ARCHETYPE_LABEL,
  BANS_TEXT as B,
  COMPO_TEXT as CT,
  DRAFT_TEXT as D,
  enemyReadText,
  VIEW_TEXT as T
} from '@draft/i18n-fr';
import { ROLES } from '@draft/schemas';
import { Chip, Icon, Portrait, ScalingBars, toneOf, useData, WinRateChips } from '../ui';
import { ScoreValue } from '../draft/score';
import { Contribs, ScalingChart } from './parts';
import { BanReason } from '../draft/BanBar';
import { Splash, TeamBar } from './Cards';
import { FocusCard } from './Focus';

// Centre de la vue client selon la phase : suggestions de bans pendant les bans, les deux équipes une fois la draft complète.

/** Bans calculés par rôle pour le panneau ; seuls ceux qui tiennent dans la hauteur sont affichés. */
export const PANEL_BANS_PER_ROLE = 8;
/** Au moins autant que la barre des bans de l'écran Draft. */
const MIN_PANEL_BANS = 3;

/** Nombre de cartes de ban qui tiennent dans la hauteur du panneau, mesuré en direct (redimensionnement compris). */
const useFittingRows = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState(MIN_PANEL_BANS);
  useLayoutEffect(() => {
    const panel = ref.current;
    if (!panel || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const head = panel.querySelector('.detail-head')?.getBoundingClientRect().height ?? 0;
      const card = panel.querySelector('.ban-card')?.getBoundingClientRect().height ?? 0;
      if (!card) return;
      const gap = 6;
      const fit = Math.floor((panel.clientHeight - head) / (card + gap));
      setRows(Math.max(MIN_PANEL_BANS, Math.min(PANEL_BANS_PER_ROLE, fit)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(panel);
    return () => ro.disconnect();
  }, []);
  return { ref, rows };
};

/** Phase de bans : pour chaque rôle encore ouvert chez l'ennemi, les bans les plus utiles, avec leur valeur décomposée. */
export const BanPanel = ({ result, dispatch }: { result: DraftResult; dispatch: Dispatch<DraftAction> }) => {
  const { ref, rows } = useFittingRows();
  return (
    <section aria-label={B.suggestions} className="card fit-focus">
      <span className="h3">{B.suggestions}</span>
      {result.bans.allyFull ? (
        <p className="small soft">{B.allyFull}</p>
      ) : (
        <div ref={ref} className="ban-panel">
          {ROLES.map((role) => {
            const list = result.bans.suggestions.filter((c) => c.role === role).slice(0, rows);
            if (!list.length) return null;
            return (
              <section key={role} className="col gap-6 min0" aria-label={B.suggestedIn(role)}>
                <span className="detail-head muted">{role}</span>
                <ul className="ban-cards">
                  {list.map((c, i) => (
                    <li
                      key={c.champion}
                      className="ban-card"
                      // Carte étroite : la ligne du win rate est masquée, elle reste dans l'infobulle.
                      title={c.impact ? c.champion + ' · ' + B.strength(c.winRate ?? 50, c.games) + ' · ' + B.strengthTip(c.impact.strength) : undefined}
                    >
                      <Splash name={c.champion} />
                      {/* Portrait, nom et valeur ; puis force, win rate et parties ; puis l'effet sur ta meilleure option. */}
                      <div className="ban-head">
                        <span className="rec-face">
                          <Portrait name={c.champion} size={36} label={c.champion} />
                          <span className={'rank' + (i === 0 ? ' is-first' : '')}>{i + 1}</span>
                        </span>
                        <span className="strong ellipsis grow">{c.champion}</span>
                        {c.impact && <span className={'ban-value ' + toneOf(c.impact.value)} title={B.valueTip}>{B.value(c.impact.value)}<span className="ban-unit">{B.unit}</span></span>}
                      </div>
                      {c.impact ? (
                        <span className="small muted ellipsis" title={B.strengthTip(c.impact.strength)}>{B.strength(c.winRate ?? 50, c.games)}</span>
                      ) : (
                        <BanReason c={c} />
                      )}
                      <div className="ban-foot">
                        <span className="small grow min0" title={c.impact?.ours ? B.versusOursTip(c.impact.ours) : undefined}>
                          {c.impact?.ours ? B.versusOurs(c.impact.ours, c.impact.drop) : ''}
                        </span>
                        <button type="button" className="btn btn-sm btn-ban" aria-label={B.banChampion(c.champion)} onClick={() => dispatch({ type: 'addBan', side: 'ally', champion: c.champion })}><Icon name="ban" size={14} /><span className="btn-text">{B.ban}</span></button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
};

const Archetypes = ({ groups }: { groups: ArchetypeGroup[] }) => (
  <>{groups.map((g) => <Chip key={g.archetype} tone="info" title={CT.archetypeTip}>{CT.archetype(ARCHETYPE_LABEL[g.archetype], g.names)}</Chip>)}</>
);

/** Sous le nom d'un pick ennemi : type de dégâts et archétype (le joueur adverse n'est pas connu). */
const useEnemySub = () => {
  const { engine } = useData();
  return (name: string) => {
    const champ = engine.catalog.get(name);
    if (!champ) return '';
    const archetype = champ.classes?.[0] ? ARCHETYPE_OF_CLASS[champ.classes[0]] : undefined;
    return T.damage[champ.damage] + (archetype ? ' · ' + ARCHETYPE_LABEL[archetype] : '');
  };
};

/**
 * Un pick de la ligne d'une lane, même contenu des deux côtés (en miroir pour l'ennemi) : identité, note sur 20,
 * contributions, chips WR, vs et avec (fenêtres flottantes), scaling.
 */
const LaneSide = ({ e, side, sub, avg }: { e: Evaluation | null; side: 'ally' | 'enemy'; sub: string; avg: number | null }) => (
  <div className={'lane-side is-' + side}>
    {e && (
      <>
        <span className="lane-face"><Portrait name={e.champion} size={40} /></span>
        <span className="col min0 lane-id">
          <span className="strong ellipsis">{e.champion}</span>
          <span className="small muted ellipsis">{sub}</span>
        </span>
        <span className="lane-contribs"><Contribs e={e} /></span>
        <span className="lane-score"><ScoreValue e={e} className="fit-score" avg={avg} /></span>
        <span className="lane-extra"><ScalingBars scaling={e.scaling} /></span>
        <span className="lane-chips"><WinRateChips e={e} /></span>
      </>
    )}
  </div>
);

/** Une lane sur une ligne (panneau des deux équipes sur un écran moins haut) : ton pick face au pick ennemi. */
const LaneRow = ({ row }: { row: RoleResult }) => {
  const enemySub = useEnemySub();
  return (
    <section aria-label={D.roleRegion(row.role)} className="lane-row">
      <LaneSide e={row.locked} side="ally" sub={row.player ?? D.noPlayer} avg={row.averageWr} />
      <LaneSide e={row.enemyEval} side="enemy" sub={row.enemyPick ? enemySub(row.enemyPick) : ''} avg={row.averageWr} />
    </section>
  );
};

/**
 * Draft complète : les deux équipes face à face, lane par lane (Top au-dessus de Top). Bandeau de chaque équipe
 * (note, dégâts, critères), tes picks en cartes détaillées, les picks ennemis (win rate, dégâts, archétype,
 * effet sur tes picks), puis la lecture des deux compos.
 */
export const TeamPanel = ({ result }: { result: DraftResult }) => {
  const enemySub = useEnemySub();
  const allyNames = result.roles.flatMap((r) => r.allyPick ?? []);
  const enemyNames = result.roles.flatMap((r) => r.enemyPick ?? []);
  return (
    <section aria-label={CT.teams} className="card fit-focus team-panel">
      <div className="cards-teams">
        <TeamBar side="ally" score={result.composition.ally} names={allyNames} result={result} />
        <TeamBar side="enemy" score={result.composition.enemy} names={enemyNames} result={result} />
      </div>
      <div className="team-row">
        {result.roles.flatMap((r) => (r.locked ? [<FocusCard key={r.role} e={r.locked} row={r} compact />] : []))}
      </div>
      <div className="team-row">
        {result.roles.flatMap((r) => (r.enemyEval ? [<FocusCard key={r.role} e={r.enemyEval} row={r} compact side="enemy" sub={enemySub(r.enemyEval.champion)} />] : []))}
      </div>
      {/* Écran moins haut : une ligne par lane à la place des deux rangées de cartes (bascule en CSS). */}
      <div className="team-lanes">
        {result.roles.map((r) => <LaneRow key={r.role} row={r} />)}
      </div>
      <div className="team-reads">
        <section aria-label={CT.ally} className="col gap-4">
          <span className="eyebrow ally-text">{CT.ally}</span>
          {/* En chips : la lecture tient en deux ou trois lignes. */}
          <div className="fcard-chips">
            {result.allyRead.map((x, i) => <Chip key={i} tone={x.sign === '+' ? 'pos' : 'neg'}>{x.sign} {allyReadText(x)}</Chip>)}
            <Archetypes groups={result.archetypes.ally} />
          </div>
        </section>
        <section aria-label={CT.enemy} className="col gap-4">
          <span className="eyebrow enemy-text">{CT.enemy}</span>
          <div className="fcard-chips">
            {result.enemyRead.map((x, i) => <Chip key={i}>{enemyReadText(x)}</Chip>)}
            <Archetypes groups={result.archetypes.enemy} />
          </div>
        </section>
        <section aria-label={CT.scalingSection} className="col gap-4 team-scaling">
          <span className="eyebrow">{CT.scaling}</span>
          <ScalingChart phases={result.scaling} height={84} />
        </section>
      </div>
    </section>
  );
};
