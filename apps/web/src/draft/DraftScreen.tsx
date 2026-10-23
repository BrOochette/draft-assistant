import { useMemo, type Dispatch } from 'react';
import { computeDraft, type DraftAction, type DraftSession } from '@draft/engine';
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

export const DraftScreen = ({ session, dispatch, pools }: Props) => {
  const { engine } = useData();
  const result = useMemo(() => computeDraft(session.draft, pools, engine), [session.draft, pools, engine]);
  const players = Object.keys(pools);
  return (
    <main className="draft">
      <div className="draft-main">
        <BanBar draft={session.draft} bans={result.bans} dispatch={dispatch} />
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
