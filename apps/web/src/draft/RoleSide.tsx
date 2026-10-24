import type { Dispatch } from 'react';
import type { DraftAction, RoleResult, Side } from '@draft/engine';
import { DRAFT_TEXT as D } from '@draft/i18n-fr';
import { Icon, Portrait } from '../ui';

interface Props {
  row: RoleResult;
  players: string[];
  picker: Side | null;
  onOpenPicker: (side: Side) => void;
  dispatch: Dispatch<DraftAction>;
}

/** Colonne de gauche d'un rôle : état, picks allié et ennemi (saisie manuelle, retrait), joueur placé. */
export const RoleSide = ({ row, players, picker, onOpenPicker, dispatch }: Props) => {
  const { role, player, allyPick: ally, enemyPick: enemy } = row;
  return (
    <div className="role-side">
      <div className="row-between">
        <span className="role-name">{role}</span>
        {ally
          ? <span className="state state-locked"><Icon name="lock" />{D.locked}</span>
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
              {ally ? <Portrait name={ally} size={58} /> : '?'}
            </button>
            {ally && (
              <button type="button" className="remove" aria-label={D.removeAlly(ally, role)} title={D.removeTip(ally)} onClick={() => dispatch({ type: 'unlock', role })}>
                <Icon name="close" size={12} />
              </button>
            )}
          </div>
          <span className="small strong center-text">{ally ?? D.toChoose}</span>
        </div>
        <span className="vs">{D.vs}</span>
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
              {enemy ? <Portrait name={enemy} size={58} /> : '?'}
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
        <label htmlFor={'player-' + role} className="small muted">{D.player}</label>
        <select id={'player-' + role} className="input" value={player ?? ''} onChange={(e) => dispatch({ type: 'assignPlayer', role, player: e.target.value || null })}>
          <option value="">{D.noPlayer}</option>
          {players.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      {!row.hasPool && <span className="small warn-text row-gap"><Icon name="warn" />{D.noPoolWarn(!!player)}</span>}
      {row.multiRole && <span className="small neg-text row-gap"><Icon name="warn" />{D.multiRole}</span>}
    </div>
  );
};
