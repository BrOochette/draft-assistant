import type { Dispatch } from 'react';
import { ARCHETYPE_OF_CLASS, LOW_SAMPLE_GAMES, type CompScore, type DraftAction, type DraftResult, type RoleResult, type Verdict } from '@draft/engine';
import {
  ARCHETYPE_LABEL,
  allyReadText,
  CARD_TEXT as C,
  COMPO_TEXT as CT,
  CRITERION_LABEL,
  CRITERION_TIP,
  DRAFT_TEXT as D,
  fmtPct,
  fmtSigned,
  PHASE_SHORT,
  phaseTitle,
  SCALING_VERDICT_LABEL,
  VIEW_TEXT as T,
  VERDICT_LABEL
} from '@draft/i18n-fr';
import type { DraftState, Pools, Role } from '@draft/schemas';
import { Bar, Chip, ScalingBars, toneOf, useData } from '../ui';
import { Face, type usePicker } from './parts';

// Briques du panneau des deux équipes (fin de draft) : bandeau d'équipe (note, critères, dégâts) et carte d'un pick ennemi.

interface Props {
  result: DraftResult;
  draft: DraftState;
  hover: Partial<Record<Role, string>>;
  pools: Pools;
  dispatch: Dispatch<DraftAction>;
  picker: ReturnType<typeof usePicker>;
}

const VERDICT_TONE: Record<Verdict, string> = { solid: 'pos', fair: 'info', fragile: 'warn', fix: 'neg' };
const DAMAGE_COLOR = { AD: 'var(--neg)', AP: 'var(--ally)', TANK: 'var(--muted-bar)' } as const;

/** Portrait du champion en fond de carte, très flou (toutes les cartes champion de la vue client). */
export const Splash = ({ name }: { name: string | null }) => {
  const { engine } = useData();
  const id = name ? engine.catalog.get(name)?.ddragonId : undefined;
  return id ? <img className="pcard-bg" src={import.meta.env.BASE_URL + 'champions/' + id + '.png'} alt="" aria-hidden="true" /> : null;
};

/** Répartition des dégâts d'une équipe, en part des picks connus. */
export const DamageSplit = ({ names }: { names: string[] }) => {
  const { engine } = useData();
  const counts = { AD: 0, AP: 0, TANK: 0 };
  for (const n of names) counts[engine.catalog.get(n)?.damage ?? 'AD']++;
  const total = names.length;
  const parts = (['AD', 'AP', 'TANK'] as const).filter((k) => counts[k] > 0);
  const tip = T.damageTip(parts.map((k) => T.damage[k] + ' ' + counts[k]).join(', '));
  return (
    <div className="dmg" title={total ? tip : undefined}>
      {total === 0 && <span className="dmg-empty small muted">{T.noPick}</span>}
      {parts.map((k) => (
        <span key={k} className="dmg-part" style={{ flexGrow: counts[k], borderColor: DAMAGE_COLOR[k] }}>
          {T.damage[k]} {Math.round((counts[k] / total) * 100)} %
        </span>
      ))}
    </div>
  );
};

/** Bandeau d'une équipe : note de compo et verdict, 5 critères, dégâts, et pour toi le scaling. */
export const TeamBar = ({ side, score, names, result }: { side: 'ally' | 'enemy'; score: CompScore & { verdict: Verdict }; names: string[]; result: DraftResult }) => (
  <section aria-label={side === 'ally' ? CT.ally : CT.enemy} className={'team-bar is-' + side}>
    <div className="team-bar-score" title={side === 'ally' ? result.allyRead.map(allyReadText).join('\n') : undefined}>
      <span className={'eyebrow ' + side + '-text'}>{side === 'ally' ? CT.ally : CT.enemy}</span>
      <span className="row-gap">
        <span className={'team-bar-big tone-' + VERDICT_TONE[score.verdict]}>{score.total}</span>
        <span className={'chip chip-' + VERDICT_TONE[score.verdict]}>{VERDICT_LABEL[score.verdict]}</span>
      </span>
    </div>
    <div className="team-bar-top">
      <DamageSplit names={names} />
      {side === 'ally' && (
        <span className="row-gap">
          {result.scaling.map((p) => (
            <span key={p.phase} className={'chip chip-' + (p.verdict === 'advantage' ? 'pos' : p.verdict === 'disadvantage' ? 'neg' : 'plain')} title={phaseTitle(p.phase)}>
              {PHASE_SHORT[p.phase]} {SCALING_VERDICT_LABEL[p.verdict]}
            </span>
          ))}
        </span>
      )}
    </div>
    <div className="team-bar-crits">
      {score.criteria.map((c) => (
        <span key={c.key} className="team-bar-crit" title={CRITERION_TIP[c.key] + ' · ' + c.value}>
          <span className="small muted nowrap">{CRITERION_LABEL[c.key]}</span>
          {/* Valeur écrite quand le bandeau est trop étroit pour les barres. */}
          <span className="small strong team-bar-value">{c.value}</span>
          <Bar value={c.value} color={side === 'ally' ? 'var(--ally)' : 'var(--enemy)'} />
        </span>
      ))}
    </div>
  </section>
);

/** Carte d'un rôle ennemi : champion, son win rate sur le rôle, dégâts, archétype, scaling, effet sur ton pick. */
export const EnemyCard = ({ row, allies, dispatch, picker }: { row: RoleResult; allies: RoleResult[]; dispatch: Dispatch<DraftAction>; picker: Props['picker'] }) => {
  const { engine } = useData();
  const { role, enemyPick: name } = row;
  const champ = name ? engine.catalog.get(name) : undefined;
  const stats = name ? engine.stats.getRoleStats(name, role) : null;
  const archetype = champ?.classes?.[0] ? ARCHETYPE_OF_CLASS[champ.classes[0]] : undefined;
  // Effet de ce pick sur chacun de tes picks verrouillés, vu de ton côté : vis-à-vis en tête, avec son poids.
  const effects = name
    ? allies.flatMap((a) => {
        const x = a.locked?.enemyTeam.find((m) => m.opponent === name);
        return a.locked && x ? [{ ally: a.locked.champion, lane: x.lane, effect: x.delta * x.weight, delta: x.delta }] : [];
      }).sort((a, b) => Number(b.lane) - Number(a.lane))
    : [];
  return (
    <section aria-label={D.roleRegion(role) + ', ' + CT.enemy} className={'pcard is-enemy' + (name ? '' : ' is-empty')}>
      <Splash name={name} />
      <div className="pcard-head">
        <span className="role-name enemy-text">{role}</span>
        {stats && name && <ScalingBars scaling={stats.scaling} />}
      </div>
      <div className="pcard-id">
        <Face side="enemy" role={role} name={name} size={56} onOpen={() => picker.open({ kind: 'pick', side: 'enemy', role })} onRemove={() => dispatch({ type: 'clearEnemy', role })} />
        <span className="col min0">
          <span className={'pcard-name' + (name ? '' : ' muted')}>{name ?? D.waiting}</span>
          {stats && (
            <span className="row-gap small">
              <span title={T.enemyWrTip(role)}><span className="muted">{T.enemyWr}</span> <span className="strong">{fmtPct(stats.gameWinRate)}</span></span>
              <span className={stats.games < LOW_SAMPLE_GAMES ? 'warn-text' : 'muted'}>{C.sample(stats.games, false)}</span>
            </span>
          )}
        </span>
      </div>
      {champ && stats && (
        <>
          <div className="pcard-chips">
            <Chip>{T.damage[champ.damage]}</Chip>
            {archetype && <Chip>{ARCHETYPE_LABEL[archetype]}</Chip>}
            {/* Apports, sans répéter l'archétype (Engage) ni le type de dégâts (Physique). */}
            {champ.provides.filter((t) => t !== 'Physique' && !(archetype && ARCHETYPE_LABEL[archetype] === t)).map((t) => <Chip key={t}>{t}</Chip>)}
          </div>
          {effects.length > 0 && (
            <ul className="plain-list pcard-effects">
              {effects.map((x) => (
                <li key={x.ally} className="row-between small" title={T.versusTip(x.ally, name!)}>
                  <span className={x.lane ? 'strong' : 'muted'}>{T.versus(x.ally)}</span>
                  <span className={'strong ' + toneOf(x.effect)}>{fmtSigned(x.effect)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
};
