import { useMemo, useState, type Dispatch } from 'react';
import { computeDraft, type DraftAction, type DraftSession, type SuggestionMode } from '@draft/engine';
import { DRAFT_TEXT, SUGGESTION_MODE_LABEL, SUGGESTION_MODE_TIP } from '@draft/i18n-fr';
import { ROLES, type Pools, type Role } from '@draft/schemas';
import { useData } from '../ui';
import { BanBar } from './BanBar';
import { CompoPanel } from './CompoPanel';
import { QuickPick } from './QuickPick';
import { RoleRow } from './RoleRow';

interface Props {
  session: DraftSession;
  dispatch: Dispatch<DraftAction>;
  pools: Pools;
}

const MODES: SuggestionMode[] = ['mix', 'synergy', 'counter'];
type Modes = Record<Role, SuggestionMode>;
const MODES_KEY = 'draft-assistant:suggestion-modes';
/** Ancienne clé, un seul mode pour tous les rôles : reprise comme valeur de départ. */
const LEGACY_MODE_KEY = 'draft-assistant:suggestion-mode';

const isMode = (v: unknown): v is SuggestionMode => MODES.includes(v as SuggestionMode);
const allModes = (m: SuggestionMode): Modes => Object.fromEntries(ROLES.map((r) => [r, m])) as Modes;

// Préférence de cet appareil seulement : sans stockage disponible, on revient au mode « mix ».
const readModes = (): Modes => {
  try {
    const saved = JSON.parse(localStorage.getItem(MODES_KEY) ?? 'null') as Partial<Record<Role, unknown>> | null;
    const legacy = localStorage.getItem(LEGACY_MODE_KEY);
    const base = allModes(isMode(legacy) ? legacy : 'mix');
    if (!saved) return base;
    for (const r of ROLES) if (isMode(saved[r])) base[r] = saved[r];
    return base;
  } catch {
    return allModes('mix');
  }
};
const saveModes = (m: Modes) => {
  try {
    localStorage.setItem(MODES_KEY, JSON.stringify(m));
  } catch {
    // Stockage indisponible : le choix vaut pour la session en cours.
  }
};

export const DraftScreen = ({ session, dispatch, pools }: Props) => {
  const { engine } = useData();
  const [modes, setModes] = useState<Modes>(readModes);
  const result = useMemo(
    () => computeDraft(session.draft, pools, engine, { modeByRole: modes }),
    [session.draft, pools, engine, modes]
  );
  const players = Object.keys(pools);
  const update = (next: Modes) => {
    setModes(next);
    saveModes(next);
  };
  // Le sélecteur global règle les 5 rôles ; il n'est allumé que si tous les rôles sont sur le même mode.
  const shared = ROLES.every((r) => modes[r] === modes.Top) ? modes.Top : null;
  return (
    <main className="draft">
      <div className="draft-main">
        <BanBar draft={session.draft} bans={result.bans} dispatch={dispatch} />
        <QuickPick draft={session.draft} dispatch={dispatch} />
        <div className="mode-bar">
          <span className="small muted" id="mode-label">{DRAFT_TEXT.modesLabel}</span>
          <div role="group" aria-labelledby="mode-label" className="segmented">
            {MODES.map((m) => (
              <button key={m} type="button" className={'segment' + (shared === m ? ' is-on' : '')} aria-pressed={shared === m} title={SUGGESTION_MODE_TIP[m]} onClick={() => update(allModes(m))}>
                {SUGGESTION_MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
        <div className="col gap-12">
          {result.roles.map((row) => (
            <RoleRow
              key={row.role}
              row={row}
              draft={session.draft}
              players={players}
              selected={session.selected[row.role]}
              mode={modes[row.role]}
              onModeChange={(m) => update({ ...modes, [row.role]: m })}
              dispatch={dispatch}
            />
          ))}
        </div>
      </div>
      <CompoPanel result={result} />
    </main>
  );
};
