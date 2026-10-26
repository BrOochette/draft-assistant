import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { applyClientDraft, createSession, draftReducer } from '@draft/engine';
import { emptySlots, ROLES, type Pools, type RiotIds } from '@draft/schemas';
import { useClientBridge } from './client';
import { initialDraft, loadAppData, type AppData } from './data';
import { PlayersScreen } from './players/PlayersScreen';
import { FitScreen } from './fit/FitScreen';
import { loadPools, loadRiotIds, savePools, saveRiotIds } from './store';
import { APP_TEXT as T, CLIENT_TEXT } from '@draft/i18n-fr';
import { DataContext, TooltipLayer } from './ui';
import { StatsUpdate } from './desktop';

type Screen = 'draft' | 'players';

/** Draft de départ : l'état de la maquette avec les données d'exemple, une draft vide avec de vraies stats. */
const startDraft = (data: AppData | undefined) =>
  !data || data.snapshot.source === 'sample' ? initialDraft() : { ...initialDraft(), ally: emptySlots(), enemy: emptySlots(), allyBans: [], enemyBans: [] };
/** Largeur à partir de laquelle l'écran Draft est la vue client (3 colonnes) ; en dessous, la mise en page en lignes. */
const WIDE_QUERY = '(min-width: 1200px)';

/** Grand écran ou non, suivi en direct (jsdom n'a pas matchMedia : mise en page en lignes). */
const useWide = (): boolean => {
  const query = () => typeof window.matchMedia === 'function' && window.matchMedia(WIDE_QUERY).matches;
  const [wide, setWide] = useState(query);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(WIDE_QUERY);
    const onChange = () => setWide(mq.matches);
    // « change » ne part pas toujours (émulation de taille, certains navigateurs) : on recalcule aussi au redimensionnement.
    mq.addEventListener('change', onChange);
    window.addEventListener('resize', onChange);
    onChange();
    return () => {
      mq.removeEventListener('change', onChange);
      window.removeEventListener('resize', onChange);
    };
  }, []);
  return wide;
};

const screenFromHash = (): Screen => (location.hash === '#/joueurs' ? 'players' : 'draft');

interface Props {
  /** Pour les tests : données déjà chargées, sans fetch ni IndexedDB. */
  initialData?: AppData;
  initialPools?: Pools;
}

export const App = ({ initialData, initialPools }: Props) => {
  const [data, setData] = useState<AppData | null>(initialData ?? null);
  const [pools, setPools] = useState<Pools | null>(initialPools ?? null);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>(screenFromHash);
  const wide = useWide();
  // Vue client sur tous les écrans ; sur grand écran, elle tient dans la fenêtre sans défilement.
  const fit = screen === 'draft' && wide;
  const [confirmReset, setConfirmReset] = useState(false);
  const [session, dispatch] = useReducer(draftReducer, undefined, () => createSession(startDraft(initialData)));
  const [riotIds, setRiotIds] = useState<RiotIds>({});
  const client = useClientBridge();
  // Draft en direct : bans encore attendus dans le client (null hors draft en direct).
  const liveBans = client.draft ? client.draft.bansPending : null;
  const draftRef = useRef(session.draft);
  draftRef.current = session.draft;
  /** Partie suivie dans le client : une autre partie, ou une sélection après une sortie, repart d'une draft vide. */
  const gameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!initialData) {
      loadAppData().then(
        (d) => {
          // Même rendu pour les données et la draft de départ : pas d'état intermédiaire affiché.
          dispatch({ type: 'load', draft: startDraft(d) });
          setData(d);
        },
        (e: Error) => setError(e.message)
      );
    }
    if (!initialPools) {
      loadPools().then(setPools, (e: Error) => setError(e.message));
      loadRiotIds().then(setRiotIds, (e: Error) => setError(e.message));
    }
  }, [initialData, initialPools]);

  // Un joueur supprimé (ou absent des pools enregistrés) n'est plus placé sur aucun rôle.
  useEffect(() => {
    if (!pools) return;
    for (const role of ROLES) {
      const player = session.draft.assign[role];
      if (player && !pools[player]) dispatch({ type: 'assignPlayer', role, player: null });
    }
  }, [pools, session.draft.assign]);

  // Joueurs à reconnaître dans le client : leur nom et, s'il est renseigné, leur Riot ID.
  const players = useMemo(() => Object.keys(pools ?? {}).map((name) => ({ name, riotId: riotIds[name] })), [pools, riotIds]);

  // Draft lue dans le client : appliquée à chaque message du pont, et quand un joueur ou un Riot ID change.
  useEffect(() => {
    if (!data || !pools) return;
    if (!client.draft) {
      // Fin de la sélection : la draft reste affichée, sans les survols.
      if (gameRef.current != null) dispatch({ type: 'syncClient', draft: draftRef.current, hover: {} });
      gameRef.current = null;
      return;
    }
    const fresh = gameRef.current !== client.draft.gameId;
    gameRef.current = client.draft.gameId;
    dispatch({ type: 'syncClient', ...applyClientDraft(draftRef.current, client.draft, data.engine, players, fresh) });
  }, [client.draft, data, pools, players]);

  useEffect(() => {
    const onHash = () => setScreen(screenFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const changeRiotIds = useCallback((next: RiotIds) => {
    setRiotIds(next);
    saveRiotIds(next).catch((e: Error) => setError(e.message));
  }, []);

  const changePools = useCallback((next: Pools) => {
    setPools(next);
    savePools(next).catch((e: Error) => setError(e.message));
    // Un joueur supprimé perd son Riot ID.
    if (Object.keys(riotIds).some((p) => !next[p])) changeRiotIds(Object.fromEntries(Object.entries(riotIds).filter(([p]) => next[p])));
  }, [riotIds, changeRiotIds]);

  return (
    // Vue client : en-tête et draft occupent exactement la fenêtre ; les mentions légales restent juste en dessous.
    <div className={'app' + (fit ? ' is-fit' : '')}>
      <TooltipLayer />
      <div className="app-screen">
        <header className="header">
          <div className="brand">
            <svg aria-hidden="true" width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="1" y="1" width="26" height="26" rx="6" stroke="var(--accent)" strokeWidth="2" />
              <path d="M8 19l6-11 6 11" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{T.brand}</span>
          </div>
          <nav aria-label={T.nav} className="row-gap">
            <a href="#/joueurs" className={'nav-link' + (screen === 'players' ? ' is-on' : '')} aria-current={screen === 'players' ? 'page' : undefined}>{T.players}</a>
            <a href="#/" className={'nav-link' + (screen === 'draft' ? ' is-on' : '')} aria-current={screen === 'draft' ? 'page' : undefined}>{T.draft}</a>
          </nav>
          <span className="grow" />
          {data && (
            <span className="chip chip-plain">
              <span title={T.dataTip(data.snapshot.source === 'sample', data.snapshot.region)}>
                {T.dataChip(data.snapshot.patch, data.snapshot.rank, data.snapshot.region, data.snapshot.source === 'lolalytics')}
              </span>
              <StatsUpdate />
            </span>
          )}
          {data?.snapshot.source === 'sample' && <span className="chip chip-warn">{T.sampleData}</span>}
          {client.status !== 'off' && (
            <span role="status" className={'chip ' + (client.status === 'champSelect' ? 'chip-pos' : client.status === 'outdated' ? 'chip-warn' : 'chip-plain')} title={client.status === 'outdated' ? CLIENT_TEXT.outdatedTip : CLIENT_TEXT.tip}>
              {CLIENT_TEXT.status[client.status]}
            </span>
          )}
          {screen !== 'players' && (confirmReset ? (
            <div role="group" aria-label={T.resetGroup} className="row-gap wrap center">
              <span className="small warn-text strong">{T.resetAsk}</span>
              <button type="button" className="btn btn-danger" onClick={() => { dispatch({ type: 'reset' }); setConfirmReset(false); }}>{T.resetYes}</button>
              <button type="button" className="btn" onClick={() => setConfirmReset(false)}>{T.cancel}</button>
            </div>
          ) : (
            <button type="button" className="btn" onClick={() => setConfirmReset(true)}>{T.newDraft}</button>
          ))}
        </header>

        {error && <p role="alert" className="error">{error}</p>}
        {!error && (!data || !pools) && <p className="loading">{T.loading}</p>}
        {data && pools && (
          <DataContext.Provider value={data}>
            {screen === 'draft'
              ? <FitScreen session={session} dispatch={dispatch} pools={pools} liveBans={liveBans} />
              : <PlayersScreen pools={pools} onChange={changePools} riotIds={riotIds} onRiotIdsChange={changeRiotIds} />}
          </DataContext.Provider>
        )}
      </div>
      <footer className="footer" aria-label={T.footer}>
        <p>{T.legalSources}</p>
        <p lang="en">{T.legalRiot}</p>
      </footer>
    </div>
  );
};
