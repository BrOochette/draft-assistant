import { useMemo, useState, type Dispatch } from 'react';
import { computeDraft, LANE_COUNTER_WEIGHT, type DraftAction, type DraftSession, type SuggestionMode } from '@draft/engine';
import { SUGGESTION_MODE_LABEL, SUGGESTION_MODE_TIP } from '@draft/i18n-fr';
import type { Pools } from '@draft/schemas';
import { useData } from '../ui';
import { BanBar } from './BanBar';
import { CompoPanel } from './CompoPanel';
import { RoleRow } from './RoleRow';

interface Props {
  session: DraftSession;
  dispatch: Dispatch<DraftAction>;
  pools: Pools;
}

const MODES: SuggestionMode[] = ['mix', 'synergy', 'counter'];
const MODE_KEY = 'draft-assistant:suggestion-mode';

// Préférence de cet appareil seulement : sans stockage disponible, on revient au mode « mix ».
const readMode = (): SuggestionMode => {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return MODES.includes(v as SuggestionMode) ? (v as SuggestionMode) : 'mix';
  } catch {
    return 'mix';
  }
};
const saveMode = (m: SuggestionMode) => {
  try {
    localStorage.setItem(MODE_KEY, m);
  } catch {
    // Stockage indisponible : le choix vaut pour la session en cours.
  }
};

export const DraftScreen = ({ session, dispatch, pools }: Props) => {
  const { engine } = useData();
  const [mode, setMode] = useState<SuggestionMode>(readMode);
  const result = useMemo(
    () => computeDraft(session.draft, pools, engine, { mode, laneCounterWeight: LANE_COUNTER_WEIGHT }),
    [session.draft, pools, engine, mode]
  );
  const players = Object.keys(pools);
  const choose = (m: SuggestionMode) => {
    setMode(m);
    saveMode(m);
  };
  return (
    <main className="draft">
      <div className="draft-main">
        <BanBar draft={session.draft} bans={result.bans} dispatch={dispatch} />
        <div className="mode-bar">
          <span className="small muted" id="mode-label">Suggestions</span>
          <div role="group" aria-labelledby="mode-label" className="segmented">
            {MODES.map((m) => (
              <button key={m} type="button" className={'segment' + (mode === m ? ' is-on' : '')} aria-pressed={mode === m} title={SUGGESTION_MODE_TIP[m]} onClick={() => choose(m)}>
                {SUGGESTION_MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
        <div className="col gap-12">
          {result.roles.map((row) => (
            <RoleRow key={row.role} row={row} draft={session.draft} players={players} selected={session.selected[row.role]} dispatch={dispatch} />
          ))}
        </div>
      </div>
      <CompoPanel result={result} />
    </main>
  );
};
