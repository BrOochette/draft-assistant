import { useEffect, useMemo, useRef, useState, type Dispatch, type DragEvent } from 'react';
import { computeDraft, proposeBuild, type ClientOrder, type DraftAction, type DraftResult, type DraftSession, type RoleResult, type Side, type SuggestionMode } from '@draft/engine';
import { APP_TEXT as A, BUILD_TEXT as B, DRAFT_TEXT as D, VIEW_TEXT as T } from '@draft/i18n-fr';
import { ROLES, type DraftState, type Pools, type Role } from '@draft/schemas';
import { reducedMotion, useData } from '../ui';
import { useSuggestionModes, type Modes } from '../draft/modes';
import { PlayerSelect } from '../draft/PlayerSelect';
import { QuickPick } from '../draft/QuickPick';
import './member-cards.css';
import { BuildPanel, BuildPicks, ChampionFocus, type BuildTarget } from './Build';
import { FocusPanel, LockedPanel } from './Focus';
import { BanPanel, PANEL_BANS_PER_ROLE, TeamPanel } from './Phases';
import { BanStrip, CompoCompact, Face, usePicker } from './parts';

interface Props {
  session: DraftSession;
  dispatch: Dispatch<DraftAction>;
  pools: Pools;
  /** Draft en direct : bans encore attendus dans le client ; null sans draft en direct. */
  liveBans?: boolean | null;
  /** Joueur marqué « Moi » : son pick reçoit un build proposé (en direct : le joueur connecté au client). */
  me?: string | null;
}

/** Illustration centrée du champion en fond de carte (fichier local, npm run ingest -- illustrations) : champion
    verrouillé, sinon survolé (estompé). */
const MemberArt = ({ name, faded }: { name: string | null; faded: boolean }) => {
  const { engine } = useData();
  const id = name ? engine.catalog.get(name)?.ddragonId : undefined;
  if (!id) return null;
  return (
    <span className={'member-art' + (faded ? ' is-faded' : '')} aria-hidden="true">
      <img src={import.meta.env.BASE_URL + 'champions/centered/' + id + '.jpg'} alt="" loading="lazy" />
    </span>
  );
};

/** Gain à contre-picker (points sur 20) en dessous duquel rien n'est affiché : le rôle peut choisir quand il veut. */
const COUNTER_MIN = 0.3;

/** Type des données d'un pick glissé (case d'origine). */
const DRAG_TYPE = 'application/x-draft-pick';

/**
 * Glisser-déposer d'un pick d'une case de joueur vers une autre (autre rôle, ou autre équipe) : corrige un champion
 * placé sur le mauvais rôle. La case visée s'éclaire pendant le survol.
 */
const useDragPick = (dispatch: Dispatch<DraftAction>) => {
  const [over, setOver] = useState<string | null>(null);
  return (side: Side, role: Role, hasPick: boolean) => {
    const key = side + '|' + role;
    return {
      draggable: hasPick,
      onDragStart: (e: DragEvent) => {
        e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ side, role }));
        e.dataTransfer.effectAllowed = 'move';
      },
      onDragOver: (e: DragEvent) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (over !== key) setOver(key);
      },
      onDragLeave: (e: DragEvent) => {
        if (!(e.currentTarget as Node).contains(e.relatedTarget as Node | null)) setOver((o) => (o === key ? null : o));
      },
      onDrop: (e: DragEvent) => {
        setOver(null);
        const raw = e.dataTransfer.getData(DRAG_TYPE);
        if (!raw) return;
        e.preventDefault();
        const from = JSON.parse(raw) as { side: Side; role: Role };
        dispatch({ type: 'movePick', from, to: { side, role } });
      },
      onDragEnd: () => setOver(null),
      dropClass: over === key ? ' is-drop' : ''
    };
  };
};

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
  /** Ton pick (joueur connecté au client, sinon « Moi »), null sans. */
  mine: BuildTarget | null;
}

/** Choix du joueur d'un rôle, en version compacte. */
const Player = ({ role, player, draft, pools, dispatch }: { role: Role; player: string | null; draft: DraftState; pools: Pools; dispatch: Dispatch<DraftAction> }) => (
  <div className="fit-player">
    <PlayerSelect role={role} player={player} pools={pools} assign={draft.assign} onChange={(p) => dispatch({ type: 'assignPlayer', role, player: p })} />
  </div>
);

/** Vue client : équipe alliée à gauche, ennemie à droite, et au centre le rôle choisi, les bans ou les deux équipes. */
/** Onglets du centre. */
type Tab = 'bans' | 'picks' | 'build' | 'teams';

const Client = ({ result, draft, hover, order, pools, dispatch, picker, modes, onModeChange, banPhase, picking, mine }: ClientProps) => {
  const { engine, buildCatalog } = useData();
  // Comme dans le client : chaque équipe dans l'ordre de ses cases (ordre de pick), pas Top, Jungle, Mid…
  const inOrder = (roles: readonly Role[] | undefined) =>
    roles ? roles.flatMap((r) => result.roles.find((x) => x.role === r) ?? []) : result.roles;
  const allies = inOrder(order?.ally);
  // Ordre de pick : le rôle ouvert qui gagne le plus à choisir après son vis-à-vis est mis en avant.
  const bestCounter = Math.max(0, ...allies.map((r) => r.counterPick?.gain ?? 0));
  const enemies = inOrder(order?.enemy);
  const open = allies.filter((r) => !r.locked);
  /** Rôle choisi, et s'il était déjà verrouillé au clic : un rôle verrouillé ensuite (ici ou dans le client) cède la place. */
  const [focus, setFocusState] = useState<{ role: Role; wasLocked: boolean } | null>(null);
  const complete = ROLES.every((r) => draft.ally[r] && draft.enemy[r]);
  // Onglet du centre : celui de la phase (bans, picks, draft complète), sauf onglet choisi d'un clic, gardé jusqu'au
  // changement de phase suivant.
  const autoTab: Tab = banPhase ? 'bans' : complete ? 'teams' : 'picks';
  const [manualTab, setManualTab] = useState<{ tab: Tab; at: Tab } | null>(null);
  const tab = manualTab && manualTab.at === autoTab ? manualTab.tab : autoTab;
  const showTab = (next: Tab) => setManualTab({ tab: next, at: autoTab });
  /** Champion en focus, choisi d'un clic (suggestion, pick) : partagé par les onglets Picks et Build. */
  const [selected, setSelected] = useState<BuildTarget | null>(null);
  // Choisir un rôle ouvre l'onglet Picks sur ce rôle ; son pick verrouillé devient le champion en focus.
  const setFocus = (f: { role: Role; wasLocked: boolean }) => {
    setFocusState(f);
    showTab('picks');
    const row = allies.find((r) => r.role === f.role);
    setSelected(row?.locked ? { champion: row.locked.champion, role: f.role, side: 'ally' } : null);
  };
  // Petit écran : le centre est sous les équipes ; choisir un rôle y fait défiler.
  const center = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focus && typeof window.matchMedia === 'function' && !window.matchMedia('(min-width: 1200px)').matches) {
      center.current?.scrollIntoView?.({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }
  }, [focus]);
  const focused = focus ? allies.find((r) => r.role === focus.role) : undefined;
  // Sans rôle choisi d'un clic, le centre suit l'allié en train de choisir dans le client, sinon le premier rôle ouvert.
  const pickingAlly = allies.find((r) => picking.ally.includes(r.role) && !r.locked);
  const current = (focused && (!focused.locked || focus!.wasLocked) ? focused : undefined) ?? pickingAlly ?? open[0] ?? allies[0] ?? null;
  // Après un verrouillage depuis le centre, on passe au rôle ouvert suivant.
  const lockFocused = (role: Role) => (champion: string) => {
    dispatch({ type: 'lock', role, champion });
    setFocusState(null);
    setSelected(null);
  };

  // Build : le champion en focus, sinon ton pick, sinon celui du rôle choisi d'un clic ou affiché (verrouillé, ou la
  // meilleure suggestion).
  const roleChampion = (r: RoleResult | null | undefined): BuildTarget | null => {
    const champion = r ? r.locked?.champion ?? r.recommendations[0]?.champion : undefined;
    return r && champion ? { champion, role: r.role, side: 'ally' } : null;
  };
  // Recalculé à chaque rendu : les mémos suivent le champion, le rôle et le camp, pas l'objet.
  const target = selected ?? mine ?? roleChampion(current);
  const { ally, enemy } = draft;
  const build = useMemo(() => {
    if (!target || !buildCatalog) return null;
    // Build d'un ennemi : son équipe est l'équipe ennemie, son vis-à-vis est dans ton équipe.
    const own = target.side === 'ally' ? ally : enemy;
    const other = target.side === 'ally' ? enemy : ally;
    const proposal = proposeBuild({ champion: target.champion, role: target.role, allies: own, enemies: other }, engine, buildCatalog);
    return proposal ? { proposal, opponent: other[target.role], side: target.side } : null;
  }, [target?.champion, target?.role, target?.side, ally, enemy, engine, buildCatalog]);
  const buildPicks = useMemo(
    () => [
      ...ROLES.flatMap((r): BuildTarget[] => (ally[r] ? [{ champion: ally[r]!, role: r, side: 'ally' }] : [])),
      ...(mine && !ally[mine.role] ? [mine] : []),
      ...ROLES.flatMap((r): BuildTarget[] => (enemy[r] ? [{ champion: enemy[r]!, role: r, side: 'enemy' }] : []))
    ],
    [ally, enemy, mine]
  );
  const focusValue = useMemo(() => ({ target, select: setSelected }), [target?.champion, target?.role, target?.side]);
  const tabs: { id: Tab; label: string }[] = [
    { id: 'bans', label: B.bansTab },
    { id: 'picks', label: B.picksTab },
    { id: 'build', label: B.buildTab },
    { id: 'teams', label: B.teamsTab }
  ];
  const drag = useDragPick(dispatch);
  return (
    <div className="fit-client">
      <ul className="plain-list fit-team-col" aria-label={D.player}>
        {allies.map((row) => {
          const best = row.recommendations[0];
          const isPicking = picking.ally.includes(row.role);
          const { dropClass, ...dnd } = drag('ally', row.role, !!row.allyPick);
          return (
            <li key={row.role} {...dnd} className={'fit-member card' + (current?.role === row.role ? ' is-focus' : '') + (isPicking ? ' is-picking' : '') + (row.allyPick ?? hover[row.role] ? ' has-art' : '') + dropClass}>
              <MemberArt name={row.allyPick ?? hover[row.role] ?? null} faded={!row.allyPick} />
              <Face side="ally" role={row.role} name={row.allyPick} hover={hover[row.role]} size={52} label={T.focus(row.role)} onOpen={() => setFocus({ role: row.role, wasLocked: !!row.locked })} onRemove={() => dispatch({ type: 'unlock', role: row.role })} />
              <div className="fit-member-body">
                <button type="button" className="fit-member-info" aria-pressed={current?.role === row.role} aria-label={T.focus(row.role)} onClick={() => setFocus({ role: row.role, wasLocked: !!row.locked })}>
                  <span className="role-name">
                    {row.role}
                    {row.counterPick && row.counterPick.gain >= COUNTER_MIN && (
                      <span className={'counter-chip' + (row.counterPick.gain === bestCounter ? ' is-top' : '')} title={T.counterPickTip(row.counterPick.gain, row.counterPick.blind, row.counterPick.opponents)}>
                        {T.counterPick(row.counterPick.gain)}
                      </span>
                    )}
                  </span>
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
      <div ref={center} className="fit-center">
        <div role="group" aria-label={B.tabs} className="center-tabs">
          {tabs.map((x) => (
            <button key={x.id} type="button" className={'center-tab' + (tab === x.id ? ' is-on' : '')} aria-pressed={tab === x.id} onClick={() => showTab(x.id)}>{x.label}</button>
          ))}
        </div>
        <ChampionFocus.Provider value={buildCatalog ? focusValue : null}>
          {tab === 'bans' ? (
            <BanPanel result={result} dispatch={dispatch} />
          ) : tab === 'teams' ? (
            <TeamPanel result={result} />
          ) : tab === 'build' ? (
            <>
              {buildPicks.length > 0 && <BuildPicks picks={buildPicks} current={target} mine={mine} onSelect={setSelected} />}
              {build
                ? <BuildPanel key={build.side + build.proposal.champion + build.proposal.role} build={build.proposal} opponent={build.opponent} side={build.side} />
                : <section className="card fit-focus center-empty"><span className="muted">{B.noBuild}</span></section>}
            </>
          ) : current ? (
            current.locked
              ? <LockedPanel rows={allies} current={current} />
              : <FocusPanel key={current.role} row={current} onLock={lockFocused(current.role)} onManual={() => picker.open({ kind: 'pick', side: 'ally', role: current.role })} mode={modes[current.role]} onModeChange={(m) => onModeChange(current.role, m)} />
          ) : <section className="card fit-focus" />}
        </ChampionFocus.Provider>
        {/* Équipes : notes et lecture des compos sont dans le panneau. Bans : aucun pick à noter. */}
        {(tab === 'picks' || tab === 'build') && <div className="card"><CompoCompact result={result} horizontal /></div>}
      </div>
      <ul className="plain-list fit-team-col is-enemy" aria-label={D.waiting}>
        {enemies.map((row) => {
          const isPicking = picking.enemy.includes(row.role);
          const { dropClass, ...dnd } = drag('enemy', row.role, !!row.enemyPick);
          return (
            <li key={row.role} {...dnd} className={'fit-member card is-enemy' + (isPicking ? ' is-picking' : '') + (row.enemyPick ? ' has-art' : '') + dropClass}>
              <MemberArt name={row.enemyPick} faded={false} />
              {/* Un clic sur un pick ennemi ouvre son build. */}
              <button
                type="button"
                className="fit-member-info"
                disabled={!row.enemyPick || !buildCatalog}
                aria-label={row.enemyPick ? B.explore(row.enemyPick, row.role) : undefined}
                onClick={() => {
                  if (!row.enemyPick) return;
                  setSelected({ champion: row.enemyPick, role: row.role, side: 'enemy' });
                  showTab('build');
                }}
              >
                <span className="role-name">{row.role}</span>
                {isPicking && <span className="picking-chip">{D.picking}</span>}
                <span className={'small strong ellipsis' + (row.enemyPick ? '' : ' muted')}>{row.enemyPick ?? D.waiting}</span>
              </button>
              <Face side="enemy" role={row.role} name={row.enemyPick} size={52} onOpen={() => picker.open({ kind: 'pick', side: 'enemy', role: row.role })} onRemove={() => dispatch({ type: 'clearEnemy', role: row.role })} />
            </li>
          );
        })}
      </ul>
    </div>
  );
};

/**
 * Écran Draft en vue client. Grand écran (1200 px et plus) : la draft entière dans la fenêtre, sans défilement. En dessous :
 * les mêmes blocs empilés (les deux équipes côte à côte, puis le centre), la page défile.
 */
export const FitScreen = ({ session, dispatch, pools, liveBans = null, me = null }: Props) => {
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
  const { modes, setRole } = useSuggestionModes();
  const result = useMemo(() => computeDraft(session.draft, pools, engine, { modeByRole: modes, bansPerRole: PANEL_BANS_PER_ROLE }), [session.draft, pools, engine, modes]);
  const picker = usePicker(session.draft, dispatch);
  // Phase de bans : lue dans le client, sinon tant qu'aucun pick n'est saisi et que tes bans ne sont pas tous posés.
  const noPick = ROLES.every((r) => !session.draft.ally[r] && !session.draft.enemy[r]);
  const banPhase = liveBans ?? (noPick && !result.bans.allyFull);
  // Ton rôle : celui du joueur connecté au client en direct, sinon celui du joueur « Moi ». Ton pick : verrouillé, sinon survolé.
  const myRole = session.localRole ?? ROLES.find((r) => me != null && session.draft.assign[r] === me) ?? null;
  const myPick = myRole ? session.draft.ally[myRole] ?? session.hover[myRole] ?? null : null;
  const mine = useMemo<BuildTarget | null>(() => (myRole && myPick ? { champion: myPick, role: myRole, side: 'ally' } : null), [myRole, myPick]);
  return (
    <main className="fit" aria-label={A.draft}>
      <div className="fit-top">
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
        mine={mine}
      />
      {picker.element}
    </main>
  );
};
