import { useLayoutEffect, useRef, type Dispatch } from 'react';
import type { DraftAction, RoleResult, Side } from '@draft/engine';
import type { DraftState, Pools } from '@draft/schemas';
import { DRAFT_TEXT as D } from '@draft/i18n-fr';
import { Icon, land, Portrait, slotKey } from '../ui';
import { PlayerSelect } from './PlayerSelect';

/** Portrait d'un emplacement : quand le champion change, il arrive en vol depuis le portrait cliqué. */
const SlotPortrait = ({ name, landing }: { name: string; landing: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const first = useRef(true);
  useLayoutEffect(() => {
    // À l'apparition, seulement un vol (pas de rebond au chargement de la page) ; au changement, vol ou rebond.
    land(landing, ref.current, !first.current);
    first.current = false;
  }, [landing]);
  return <span ref={ref} className="face-img"><Portrait name={name} size={58} /></span>;
};

interface Props {
  row: RoleResult;
  /** Champion survolé par l'allié dans le client : affiché, hors calcul. */
  hover?: string | undefined;
  pools: Pools;
  assign: DraftState['assign'];
  picker: Side | null;
  onOpenPicker: (side: Side) => void;
  dispatch: Dispatch<DraftAction>;
}

/** Colonne de gauche d'un rôle : état, picks allié et ennemi (saisie manuelle, retrait), joueur placé. */
export const RoleSide = ({ row, hover, pools, assign, picker, onOpenPicker, dispatch }: Props) => {
  const { role, player, allyPick: ally, enemyPick: enemy } = row;
  const hovered = ally ? null : hover ?? null;
  return (
    <div className="role-side">
      <div className="row-between">
        <span className="role-name">{role}</span>
        {ally
          ? <span className="state state-locked"><Icon name="lock" />{D.locked}</span>
          : hovered
            ? <span className="state state-hover" title={D.hoverTip(hovered)}><Icon name="circle" />{D.hovered}</span>
            : <span className="state state-open"><Icon name="circle" />{D.toChoose}</span>}
      </div>
      <div className="faces">
        <div className="face-col">
          <div className="face-wrap">
            <button
              type="button"
              className={'face ' + (ally ? 'is-ally' : 'is-empty-ally')}
              aria-expanded={picker === 'ally'}
              aria-label={D.allyFace(!!ally, player, role)}
              title={D.allyFaceTip(!!ally)}
              onClick={() => onOpenPicker('ally')}
            >
              {ally
                ? <SlotPortrait name={ally} landing={slotKey('ally', role, ally)} />
                : hovered ? <span className="face-img is-hover" title={D.hoverTip(hovered)}><Portrait name={hovered} size={58} /></span> : '?'}
            </button>
            {ally && (
              <button type="button" className="remove" aria-label={D.removeAlly(ally, role)} title={D.removeTip(ally)} onClick={() => dispatch({ type: 'unlock', role })}>
                <Icon name="close" size={12} />
              </button>
            )}
          </div>
          <span className={'small strong center-text' + (!ally && hovered ? ' muted' : '')}>{ally ?? hovered ?? D.toChoose}</span>
        </div>
        {/* « VS » devient un bouton d'échange dès qu'un des deux picks est saisi. */}
        {ally || enemy ? (
          <button type="button" className="vs swap-btn" aria-label={D.swap(role)} title={D.swapTip} onClick={() => dispatch({ type: 'swapRole', role })}>
            <Icon name="swap" size={16} />
          </button>
        ) : (
          <span className="vs">{D.vs}</span>
        )}
        <div className="face-col">
          <div className="face-wrap">
            <button
              type="button"
              className={'face ' + (enemy ? 'is-enemy' : 'is-waiting')}
              aria-expanded={picker === 'enemy'}
              aria-label={D.enemyFace(!!enemy, role)}
              title={D.enemyFaceTip(!!enemy)}
              onClick={() => onOpenPicker('enemy')}
            >
              {enemy ? <SlotPortrait name={enemy} landing={slotKey('enemy', role, enemy)} /> : '?'}
            </button>
            {enemy && (
              <button type="button" className="remove" aria-label={D.removeEnemy(enemy, role)} title={D.removeTip(enemy)} onClick={() => dispatch({ type: 'clearEnemy', role })}>
                <Icon name="close" size={12} />
              </button>
            )}
          </div>
          <span className={'small strong center-text' + (enemy ? '' : ' muted')}>{enemy ?? D.waiting}</span>
        </div>
      </div>
      <div className="col gap-4">
        <span className="small muted" aria-hidden="true">{D.player}</span>
        <PlayerSelect role={role} player={player} pools={pools} assign={assign} onChange={(p) => dispatch({ type: 'assignPlayer', role, player: p })} />
      </div>
      {/* Sans joueur, rien à signaler : tous les champions sont proposés. */}
      {player && !row.hasPool && <span className="small warn-text row-gap"><Icon name="warn" />{D.noPoolWarn}</span>}
      {row.multiRole && <span className="small neg-text row-gap"><Icon name="warn" />{D.multiRole}</span>}
    </div>
  );
};
