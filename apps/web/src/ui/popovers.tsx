import type { AllyEffect, ClassPriorUsed, EnemyEffect, Evaluation } from '@draft/engine';
import { CARD_TEXT, fmtPct, fmtSigned, POPOVER_TEXT as P } from '@draft/i18n-fr';
import { Chip, Portrait, toneOf } from './base';
import { FloatingChip } from './FloatingChip';

const fmt2 = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');
const weightLabel = (w: number) => (w === 1 ? '×1' : w === 0.75 ? '×3/4' : w === 0.5 ? '×1/2' : w === 0.25 ? '×1/4' : '×' + fmt2(w));
const weighted = (rows: readonly { weight: number; delta: number }[]) => rows.reduce((s, r) => s + r.weight * r.delta, 0);

/** Portrait, nom et sous-titre d'un champion dans une ligne de fenêtre flottante. */
const PopoverChamp = ({ name, sub }: { name: string; sub: string }) => (
  <span className="row-gap"><Portrait name={name} size={24} /><span><span className="strong">{name}</span><br /><span className="muted">{sub}</span></span></span>
);

/** Mesure brute : valeur et parties, ou « Pas de données ». */
const Measured = ({ value, games }: { value: string | null; games: number }) =>
  value == null ? <span className="muted">{P.noData}</span> : <>{value}<br /><span className="muted">{P.games(games)}</span></>;

/** Écart lissé, avec la moyenne de classe utilisée. */
const Gap = ({ delta, prior, text }: { delta: number; prior: ClassPriorUsed | null; text: (a: string, b: string) => string }) => (
  <>
    <span className={toneOf(delta)}>{fmtSigned(delta)}</span>
    {prior && <><br /><span className="muted small" title={P.games(prior.games)}>{text(prior.classes[0], prior.classes[1])} {fmtSigned(prior.delta)}</span></>}
  </>
);

const EffectTable = <T extends { weight: number; delta: number }>({ head, rows, cells }: { head: string; rows: T[]; cells: (r: T) => [JSX.Element, JSX.Element, JSX.Element] }) => (
  <table className="popover-table">
    <thead>
      <tr><th>{head}</th><th>{P.colMeasured}</th><th>{P.colGap}</th><th>{P.colWeight}</th><th>{P.colEffect}</th></tr>
    </thead>
    <tbody>
      {rows.map((r, i) => {
        const [who, measured, gap] = cells(r);
        return (
          <tr key={i}>
            <td>{who}</td>
            <td>{measured}</td>
            <td>{gap}</td>
            <td>{weightLabel(r.weight)}</td>
            <td className={'strong ' + toneOf(r.delta * r.weight)}>{fmtSigned(r.delta * r.weight)}</td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

/**
 * Chip « vs adversaire » : effet de chaque ennemi connu sur le win rate attendu, vis-à-vis en tête.
 * Sans adversaire de lane connu, le chip résume la compo ennemie.
 */
const MatchupPopover = ({ e }: { e: Evaluation }) => {
  const total = weighted(e.enemyTeam);
  const m = e.matchup;
  const [name, value] = m ? [P.vs(m.opponent), m.winRate != null ? fmtPct(m.winRate) : P.pts(m.delta)] : [P.vsCompo, P.pts(total)];
  return (
    <FloatingChip name={name} value={value} label={name + ' ' + value} panelLabel={P.enemyPanel(e.champion)}>
      <div className="popover-head">
        <span className="strong">{P.enemyHead(e.champion)}</span>
        <span className={'strong ' + toneOf(total)}>{P.pts(total)}</span>
      </div>
      <EffectTable<EnemyEffect>
        head={P.colEnemy}
        rows={e.enemyTeam}
        cells={(r) => [
          <PopoverChamp name={r.opponent} sub={r.lane ? P.vsLane : r.role} />,
          <Measured value={r.winRate != null ? fmtPct(r.winRate) : null} games={r.games} />,
          <Gap delta={r.delta} prior={r.prior} text={P.classVs} />
        ]}
      />
      <p className="popover-foot muted">{P.enemyFoot}</p>
    </FloatingChip>
  );
};

/** Chip « avec allié(s) » : effet de chaque allié verrouillé (duo) sur le win rate attendu. */
const AllyPopover = ({ e }: { e: Evaluation }) => {
  const total = weighted(e.allyTeam);
  const name = e.allyTeam.length === 1 ? P.with(e.allyTeam[0]!.ally) : P.withAllies;
  const value = P.pts(total);
  return (
    <FloatingChip name={name} value={value} label={name + ' ' + value} panelLabel={P.allyPanel(e.champion)}>
      <div className="popover-head">
        <span className="strong">{P.allyHead(e.champion)}</span>
        <span className={'strong ' + toneOf(total)}>{value}</span>
      </div>
      <EffectTable<AllyEffect>
        head={P.colAlly}
        rows={e.allyTeam}
        cells={(r) => [
          <PopoverChamp name={r.ally} sub={r.role} />,
          <Measured value={r.raw != null ? fmtSigned(r.raw) : null} games={r.games} />,
          <Gap delta={r.delta} prior={r.prior} text={P.classWith} />
        ]}
      />
      <p className="popover-foot muted">{P.allyFoot}</p>
    </FloatingChip>
  );
};

/** Win rate de partie (et de lane s'il est connu), puis ennemis et alliés connus, chacun avec sa fenêtre flottante. */
export const WinRateChips = ({ e }: { e: Evaluation }) => (
  <>
    <Chip title={CARD_TEXT.wrTip(e.laneWinRate != null)}>{CARD_TEXT.wr(e.gameWinRate, e.laneWinRate)}</Chip>
    {e.enemyTeam.length > 0 && <MatchupPopover e={e} />}
    {e.allyTeam.length > 0 && <AllyPopover e={e} />}
  </>
);

