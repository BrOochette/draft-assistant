import { useMemo, type Dispatch } from 'react';
import { computeDraft, type DraftAction, type DraftSession } from '@draft/engine';
import { DRAFT_TEXT } from '@draft/i18n-fr';
import type { Pools } from '@draft/schemas';
import { useData } from '../ui';
import { BanBar } from './BanBar';
import { CompoMini, CompoPanel } from './CompoPanel';
import { GlobalModes, useSuggestionModes } from './modes';
import { QuickPick } from './QuickPick';
import { RoleRow } from './RoleRow';

interface Props {
  session: DraftSession;
  dispatch: Dispatch<DraftAction>;
  pools: Pools;
}


export const DraftScreen = ({ session, dispatch, pools }: Props) => {
  const { engine } = useData();
  const { modes, shared, setAll, setRole } = useSuggestionModes();
  const result = useMemo(
    () => computeDraft(session.draft, pools, engine, { modeByRole: modes }),
    [session.draft, pools, engine, modes]
  );
  return (
    <main className="draft">
      <div className="draft-main">
        <BanBar draft={session.draft} bans={result.bans} dispatch={dispatch} />
        <QuickPick draft={session.draft} dispatch={dispatch} />
        <div className="mode-bar">
          <span className="small muted" id="mode-label">{DRAFT_TEXT.modesLabel}</span>
          <GlobalModes shared={shared} onChange={setAll} labelId="mode-label" />
        </div>
        <div className="col gap-12">
          {result.roles.map((row) => (
            <RoleRow
              key={row.role}
              row={row}
              draft={session.draft}
              pools={pools}
              selected={session.selected[row.role]}
              hover={session.hover[row.role]}
              mode={modes[row.role]}
              onModeChange={(m) => setRole(row.role, m)}
              dispatch={dispatch}
            />
          ))}
        </div>
      </div>
      <CompoPanel result={result} />
      <CompoMini result={result} />
    </main>
  );
};
