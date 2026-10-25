import { useEffect, useMemo, useState, type Dispatch } from 'react';
import { computeDraft, type ClientOrder, type DraftAction, type DraftResult, type DraftSession, type SuggestionMode } from '@draft/engine';
import { APP_TEXT as A, DRAFT_TEXT as D, VIEW_TEXT as T } from '@draft/i18n-fr';
import { ROLES, type DraftState, type Pools, type Role } from '@draft/schemas';
import { useData } from '../ui';
import { GlobalModes, useSuggestionModes, type Modes } from '../draft/modes';
import { PlayerSelect } from '../draft/PlayerSelect';
import { QuickPick } from '../draft/QuickPick';
import { FocusPanel, LockedPanel } from './Focus';
import { BanPanel, PANEL_BANS_PER_ROLE, TeamPanel } from './Phases';
import { BanStrip, CompoCompact, Face, usePicker } from './parts';

interface Props {
  session: DraftSession;
  dispatch: Dispatch<DraftAction>;
  pools: Pools;
  /** Draft en direct : bans encore attendus dans le client ; null sans draft en direct. */
  liveBans?: boolean | null;
}

type Picker = ReturnType<typeof usePicker>;
interface ClientProps {
  result: DraftResult;
  draft: DraftState;
  hover: Partial<Record<Role, string>>;
  /** Ordre des joueurs dans le client, null sans draft lue dans le client (ordre des rôles). */
  order: ClientOrder | null;
  pools: Pools;
  dispatch: Dispatch<DraftAction>;
  picker: Picker;
  /** Type de suggestion de chaque rôle. */
  modes: Modes;
  onModeChange: (role: Role, m: SuggestionMode) => void;
  /** Phase de bans : le centre montre les suggestions de bans. */
  banPhase: boolean;
  /** Draft en direct : rôles dont le joueur est en train de choisir. */
  picking: ClientOrder;
}

/** Choix du joueur d'un rôle, en version compacte. */
const Player = ({ role, player, draft, pools, dispatch }: { role: Role; player: string | null; draft: DraftState; pools: Pools; dispatch: Dispatch<DraftAction> }) => (
  <div className="fit-player">
    <PlayerSelect role={role} player={player} pools={pools} assign={draft.assign} onChange={(p) => dispatch({ type: 'assignPlayer', role, player: p })} />
  </div>
);

/** Vue client : équipe alliée à gauche, ennemie à droite, et au centre le rôle choisi, les bans ou les deux équipes. */
const Client = ({ result, draft, hover, order, pools, dispatch, picker, modes, onModeChange, banPhase, picking }: ClientProps) => {
  // Comme dans le client : chaque équipe dans l'ordre de ses cases (ordre de pick), pas Top, Jungle, Mid…
  const inOrder = (roles: readonly Role[] | undefined) =>
    roles ? roles.flatMap((r) => result.roles.find((x) => x.role === r) ?? []) : result.roles;
  const allies = inOrder(order?.ally);
  const enemies = inOrder(order?.enemy);
  const open = allies.filter((r) => !r.locked);
  /** Rôle choisi, et s'il était déjà verrouillé au clic : un rôle verrouillé ensuite (ici ou dans le client) cède la place. */
  const [focus, setFocus] = useState<{ role: Role; wasLocked: boolean } | null>(null);
  const focused = focus ? allies.find((r) => r.role === focus.role) : undefined;
  // Sans rôle choisi d'un clic, le centre suit l'allié en train de choisir dans le client, sinon le premier rôle ouvert.
  const pickingAlly = allies.find((r) => picking.ally.includes(r.role) && !r.locked);
  const current = (focused && (!focused.locked || focus!.wasLocked) ? focused : undefined) ?? pickingAlly ?? open[0] ?? allies[0] ?? null;
  const complete = ROLES.every((r) => draft.ally[r] && draft.enemy[r]);
  // Bans en cours, sauf si un rôle a été choisi d'un clic.
  const showBans = banPhase && !focus;
  // Après un verrouillage depuis le centre, on passe au rôle ouvert suivant.
  const lockFocused = (role: Role) => (champion: string) => {
    dispatch({ type: 'lock', role, champion });
    setFocus(null);
  };
  return (
    <div className="fit-client">
      <ul className="plain-list fit-team-col" aria-label={D.player}>
        {allies.map((row) => {
          const best = row.recommendations[0];
          const isPicking = picking.ally.includes(row.role);
          return (
            <li key={row.role} className={'fit-member card' + (current?.role === row.role ? ' is-focus' : '') + (isPicking ? ' is-picking' : '')}>
              <Face side="ally" role={row.role} name={row.allyPick} hover={hover[row.role]} size={52} onOpen={() => picker.open({ kind: 'pick', side: 'ally', role: row.role })} onRemove={() => dispatch({ type: 'unlock', role: row.role })} />
              <div className="fit-member-body">
                <button type="button" className="fit-member-info" aria-pressed={current?.role === row.role} aria-label={T.focus(row.role)} onClick={() => setFocus({ role: row.role, wasLocked: !!row.locked })}>
                  <span className="role-name">{row.role}</span>
                  {isPicking && <span className="picking-chip">{D.picking}</span>}
                  {row.locked
                    ? <span className="small strong ellipsis">{row.locked.champion}</span>
                    : best && <span className="fit-best"><span className="small muted">{T.best}</span> <span className="small strong">{best.champion}</span></span>}
                </button>
                <Player role={row.role} player={row.player} draft={draft} pools={pools} dispatch={dispatch} />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="fit-center">
        {/* Bans en cours (sauf rôle choisi d'un clic), draft complète, sinon le rôle choisi. */}
        {showBans ? (
          <BanPanel result={result} dispatch={dispatch} />
        ) : complete ? (
          <TeamPanel result={result} dispatch={dispatch} picker={picker} />
        ) : current ? (
          current.locked
            ? <LockedPanel rows={allies} current={current} />
            : <FocusPanel key={current.role} row={current} onLock={lockFocused(current.role)} mode={modes[current.role]} onModeChange={(m) => onModeChange(current.role, m)} />
        ) : <section className="card fit-focus" />}
        {/* Draft complète : notes et lecture des compos sont dans le panneau des deux équipes. Bans : aucun pick à noter. */}
        {!complete && !showBans && <div className="card"><CompoCompact result={result} horizontal /></div>}
      </div>
      <ul className="plain-list fit-team-col is-enemy" aria-label={D.waiting}>
        {enemies.map((row) => {
          const isPicking = picking.enemy.includes(row.role);
          return (
            <li key={row.role} className={'fit-member card is-enemy' + (isPicking ? ' is-picking' : '')}>
              <span className="fit-member-info">
                <span className="role-name">{row.role}</span>
                {isPicking && <span className="picking-chip">{D.picking}</span>}
                <span className={'small strong ellipsis' + (row.enemyPick ? '' : ' muted')}>{row.enemyPick ?? D.waiting}</span>
              </span>
              <Face side="enemy" role={row.role} name={row.enemyPick} size={52} onOpen={() => picker.open({ kind: 'pick', side: 'enemy', role: row.role })} onRemove={() => dispatch({ type: 'clearEnemy', role: row.role })} />
            </li>
          );
        })}
      </ul>
    </div>
  );
};

/** La draft entière dans la fenêtre, sans défilement, en vue client : l'écran Draft sur grand écran. */
export const FitScreen = ({ session, dispatch, pools, liveBans = null }: Props) => {
  const { engine } = useData();
  // Side de ton équipe (draft en direct ; bleu par défaut) : le thème inverse les couleurs des deux camps côté rouge.
  const side = session.side ?? 'blue';
  useEffect(() => {
    document.body.dataset.side = side;
    return () => {
      delete document.body.dataset.side;
    };
  }, [side]);
  // Même type de suggestion que l'écran Draft en lignes (mémorisé sur l'appareil).
  const { modes, shared, setAll, setRole } = useSuggestionModes();
  const result = useMemo(() => computeDraft(session.draft, pools, engine, { modeByRole: modes, bansPerRole: PANEL_BANS_PER_ROLE }), [session.draft, pools, engine, modes]);
  const picker = usePicker(session.draft, dispatch);
  // Phase de bans : lue dans le client, sinon tant qu'aucun pick n'est saisi et que tes bans ne sont pas tous posés.
  const noPick = ROLES.every((r) => !session.draft.ally[r] && !session.draft.enemy[r]);
  const banPhase = liveBans ?? (noPick && !result.bans.allyFull);
  return (
    <main className="fit" aria-label={A.draft}>
      <div className="fit-top">
        <span id="fit-modes" className="visually-hidden">{D.modesLabel}</span>
        <GlobalModes shared={shared} onChange={setAll} labelId="fit-modes" short />
        <BanStrip draft={session.draft} side="ally" size={40} dispatch={dispatch} onAdd={() => picker.open({ kind: 'ban', side: 'ally' })} />
        <div className="fit-quick"><QuickPick draft={session.draft} dispatch={dispatch} /></div>
        <BanStrip draft={session.draft} side="enemy" size={40} dispatch={dispatch} onAdd={() => picker.open({ kind: 'ban', side: 'enemy' })} />
      </div>
      <Client
        result={result}
        draft={session.draft}
        hover={session.hover}
        order={session.order}
        pools={pools}
        dispatch={dispatch}
        picker={picker}
        modes={modes}
        onModeChange={setRole}
        banPhase={banPhase}
        picking={session.picking}
      />
      {picker.element}
    </main>
  );
};
