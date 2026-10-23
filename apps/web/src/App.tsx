import { useCallback, useEffect, useReducer, useState } from 'react';
import { createSession, draftReducer } from '@draft/engine';
import { emptySlots, ROLES, type Pools } from '@draft/schemas';
import { initialDraft, loadAppData, type AppData } from './data';
import { DraftScreen } from './draft/DraftScreen';
import { PlayersScreen } from './players/PlayersScreen';
import { loadPools, savePools } from './store';
import { DataContext } from './ui';

type Screen = 'draft' | 'players';

/** Draft de départ : l'état de la maquette avec les données d'exemple, une draft vide avec de vraies stats. */
const startDraft = (data: AppData | undefined) =>
  !data || data.snapshot.source === 'sample' ? initialDraft() : { ...initialDraft(), ally: emptySlots(), enemy: emptySlots(), allyBans: [], enemyBans: [] };
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
  const [confirmReset, setConfirmReset] = useState(false);
  const [session, dispatch] = useReducer(draftReducer, undefined, () => createSession(startDraft(initialData)));

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
    if (!initialPools) loadPools().then(setPools, (e: Error) => setError(e.message));
  }, [initialData, initialPools]);

  // Un joueur supprimé (ou absent des pools enregistrés) n'est plus placé sur aucun rôle.
  useEffect(() => {
    if (!pools) return;
    for (const role of ROLES) {
      const player = session.draft.assign[role];
      if (player && !pools[player]) dispatch({ type: 'assignPlayer', role, player: null });
    }
  }, [pools, session.draft.assign]);

  useEffect(() => {
    const onHash = () => setScreen(screenFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const changePools = useCallback((next: Pools) => {
    setPools(next);
    savePools(next).catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <svg aria-hidden="true" width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="1" y="1" width="26" height="26" rx="6" stroke="var(--accent)" strokeWidth="2" />
            <path d="M8 19l6-11 6 11" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Draft Assistant</span>
        </div>
        <nav aria-label="Navigation principale" className="row-gap">
          <a href="#/joueurs" className={'nav-link' + (screen === 'players' ? ' is-on' : '')} aria-current={screen === 'players' ? 'page' : undefined}>Joueurs</a>
          <a href="#/" className={'nav-link' + (screen === 'draft' ? ' is-on' : '')} aria-current={screen === 'draft' ? 'page' : undefined}>Draft</a>
        </nav>
        <span className="grow" />
        {data && (
          <span className="chip chip-plain" title={data.snapshot.source === 'sample' ? "Win rates et échantillons : données d'exemple" : 'Stats Lolalytics, classé solo, ' + (data.snapshot.region ?? 'toutes régions')}>
            Patch {data.snapshot.patch} · {data.snapshot.rank}{data.snapshot.region ? ' · ' + data.snapshot.region : ''}{data.snapshot.source === 'lolalytics' ? ' · Lolalytics' : ''}
          </span>
        )}
        {data?.snapshot.source === 'sample' && <span className="chip chip-warn">Données d'exemple</span>}
        {screen === 'draft' && (confirmReset ? (
          <div role="group" aria-label="Confirmer la nouvelle draft" className="row-gap wrap center">
            <span className="small warn-text strong">Effacer picks, bans et sélections ?</span>
            <button type="button" className="btn btn-danger" onClick={() => { dispatch({ type: 'reset' }); setConfirmReset(false); }}>Oui, nouvelle draft</button>
            <button type="button" className="btn" onClick={() => setConfirmReset(false)}>Annuler</button>
          </div>
        ) : (
          <button type="button" className="btn" onClick={() => setConfirmReset(true)}>Nouvelle draft</button>
        ))}
      </header>

      {error && <p role="alert" className="error">{error}</p>}
      {!error && (!data || !pools) && <p className="loading">Chargement…</p>}
      {data && pools && (
        <DataContext.Provider value={data}>
          {screen === 'draft'
            ? <DraftScreen session={session} dispatch={dispatch} pools={pools} />
            : <PlayersScreen pools={pools} onChange={changePools} />}
        </DataContext.Provider>
      )}
    </div>
  );
};
