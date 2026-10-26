import { useLayoutEffect, useRef, useState, type Dispatch } from 'react';
import { ARCHETYPE_OF_CLASS, LOW_SAMPLE_GAMES, type ArchetypeGroup, type DraftAction, type DraftResult, type RoleResult } from '@draft/engine';
import {
  allyReadText,
  ARCHETYPE_LABEL,
  BANS_TEXT as B,
  CARD_TEXT as C,
  COMPO_TEXT as CT,
  DRAFT_TEXT as D,
  enemyReadText,
  fmtInt,
  fmtPct,
  fmtSigned,
  VIEW_TEXT as T
} from '@draft/i18n-fr';
import { ROLES } from '@draft/schemas';
import { Chip, Icon, Portrait, ScalingBars, toneOf, useData } from '../ui';
import { ScoreSub, ScoreValue } from '../draft/score';
import { Contribs, ScalingChart } from './parts';
import { BanReason } from '../draft/BanBar';
import { EnemyCard, Splash, TeamBar } from './Cards';
import { FocusCard } from './Focus';
import type { usePicker } from './parts';

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

/**
 * Une lane sur une ligne (panneau des deux équipes sur un écran moins haut) : ton pick (score, « Compo +N »,
 * contributions, scaling) face au pick ennemi (win rate, parties, dégâts, archétype, effet sur ton vis-à-vis ;
 * l'effet sur tes autres picks est dans l'infobulle).
 */
const LaneRow = ({ row, allies }: { row: RoleResult; allies: RoleResult[] }) => {
  const { engine } = useData();
  const e = row.locked;
  const enemy = row.enemyPick;
  const champ = enemy ? engine.catalog.get(enemy) : undefined;
  const stats = enemy ? engine.stats.getRoleStats(enemy, row.role) : null;
  const archetype = champ?.classes?.[0] ? ARCHETYPE_OF_CLASS[champ.classes[0]] : undefined;
  const effects = enemy
    ? allies.flatMap((a) => {
        const x = a.locked?.enemyTeam.find((m) => m.opponent === enemy);
        return a.locked && x ? [{ ally: a.locked.champion, lane: x.lane, effect: x.delta * x.weight }] : [];
      })
    : [];
  const lane = effects.find((x) => x.lane);
  return (
    <section aria-label={D.roleRegion(row.role)} className="lane-row">
      <div className="lane-side is-ally">
        {e && (
          <>
            <Portrait name={e.champion} size={40} />
            <span className="col min0">
              <span className="strong ellipsis">{e.champion}</span>
              <span className="small muted ellipsis">{row.player ?? D.noPlayer}</span>
            </span>
            <span className="col lane-score">
              <ScoreValue e={e} className="fit-score" avg={row.averageWr} />
              <ScoreSub e={e} />
            </span>
            <span className="lane-contribs"><Contribs e={e} /></span>
            <span className="lane-extra"><ScalingBars scaling={e.scaling} /></span>
          </>
        )}
      </div>
      <div className="lane-side is-enemy" title={effects.map((x) => T.versus(x.ally) + ' ' + fmtSigned(x.effect)).join('\n') || undefined}>
        {enemy && champ && stats && (
          <>
            <Portrait name={enemy} size={40} />
            <span className="col min0">
              <span className="strong ellipsis">{enemy}</span>
              <span className="small nowrap" title={T.enemyWrTip(row.role)}>
                <span className="muted">{T.enemyWr}</span> <span className="strong">{fmtPct(stats.gameWinRate)}</span>{' '}
                <span className={stats.games < LOW_SAMPLE_GAMES ? 'warn-text' : 'muted'}>· {fmtInt(stats.games)}</span>
              </span>
            </span>
            <span className="lane-chips">
              <Chip>{T.damage[champ.damage]}</Chip>
              {archetype && <Chip>{ARCHETYPE_LABEL[archetype]}</Chip>}
            </span>
            {lane && <span className={'small strong nowrap ' + toneOf(lane.effect)}>{T.versus(lane.ally)} {fmtSigned(lane.effect)}</span>}
            <span className="lane-extra"><ScalingBars scaling={stats.scaling} /></span>
          </>
        )}
      </div>
    </section>
  );
};

/**
 * Draft complète : les deux équipes face à face, lane par lane (Top au-dessus de Top). Bandeau de chaque équipe
 * (note, dégâts, critères), tes picks en cartes détaillées, les picks ennemis (win rate, dégâts, archétype,
 * effet sur tes picks), puis la lecture des deux compos.
 */
export const TeamPanel = ({ result, dispatch, picker }: { result: DraftResult; dispatch: Dispatch<DraftAction>; picker: ReturnType<typeof usePicker> }) => {
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
        {result.roles.map((r) => <EnemyCard key={r.role} row={r} allies={result.roles} dispatch={dispatch} picker={picker} />)}
      </div>
      {/* Écran moins haut : une ligne par lane à la place des deux rangées de cartes (bascule en CSS). */}
      <div className="team-lanes">
        {result.roles.map((r) => <LaneRow key={r.role} row={r} allies={result.roles} />)}
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
