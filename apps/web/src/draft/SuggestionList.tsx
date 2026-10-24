import { useMemo, useState } from 'react';
import { MAIN_ROLE_SHARE, type RoleResult } from '@draft/engine';
import { DRAFT_TEXT as D } from '@draft/i18n-fr';
import { Icon } from '../ui';
import { DetailItem } from './RecCard';

/** Champions affichés dans la vue liste sans recherche, puis à chaque « Voir plus ». */
export const LIST_LIMIT = 10;

interface Props {
  row: RoleResult;
  selected: string | undefined;
  onLock: (champion: string) => void;
  onScrollTop: () => void;
}

/** Vue liste d'un rôle : pool, hors pool, rôle secondaire ; recherche sur tous, « Voir plus » et remontée. */
export const SuggestionList = ({ row, selected, onLock, onScrollTop }: Props) => {
  const { role, player } = row;
  const [query, setQuery] = useState('');
  const [count, setCount] = useState(LIST_LIMIT);

  const listed = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sections = [
      { kind: 'pool' as const, list: row.inPool },
      { kind: 'out' as const, list: row.outOfPool },
      { kind: 'secondary' as const, list: row.secondaryRole }
    ];
    const all = sections.flatMap(({ kind, list }) => list.map((e, i) => ({ e, kind, best: kind === 'pool' && i === 0 })));
    const kept = q ? all.filter(({ e }) => e.champion.toLowerCase().includes(q)) : all.slice(0, count);
    return { items: kept.map((x, i) => ({ ...x, first: i === 0 || kept[i - 1]!.kind !== x.kind })), more: !q && all.length > kept.length };
  }, [row, query, count]);

  return (
    <>
      <input type="search" className="input" aria-label={D.searchIn(role)} placeholder={D.search} value={query} onChange={(ev) => setQuery(ev.target.value)} />
      {listed.items.length === 0 && <span className="empty-box">{D.notFound}</span>}
      <ul className="details">
        {listed.items.map(({ e, kind, first, best }) => (
          <li key={e.champion} className="col gap-6">
            {first && kind === 'pool' && <span className="detail-head accent-text">{row.hasPool ? D.headPool : D.headAll(role, !!player)}</span>}
            {first && kind === 'out' && <span className="detail-head warn-text">{D.headOut}</span>}
            {first && kind === 'secondary' && <span className="detail-head muted" title={D.secondaryTip(MAIN_ROLE_SHARE, role)}>{D.headSecondary}</span>}
            <DetailItem e={e} role={role} best={best} secondary={kind === 'secondary'} selected={selected === e.champion} onLock={() => onLock(e.champion)} />
          </li>
        ))}
      </ul>
      {listed.items.length > 0 && (
        <div className="list-end">
          {listed.more && (
            <button type="button" className="btn btn-sm" aria-label={D.moreIn(role)} onClick={() => setCount(count + LIST_LIMIT)}>
              {D.more} <Icon name="chevron" size={14} />
            </button>
          )}
          <button type="button" className="btn btn-sm up-btn" aria-label={D.upIn(role)} title={D.up} onClick={onScrollTop}>
            <Icon name="chevron" size={16} rotate />
          </button>
        </div>
      )}
    </>
  );
};
