import { useMemo, useState, type Dispatch } from 'react';
import { availability, MAX_BANS, type BanCard, type DraftAction, type DraftResult, type Side } from '@draft/engine';
import { BAN_BLOCKED_LABEL, BANS_TEXT as B } from '@draft/i18n-fr';
import { ROLES, type DraftState } from '@draft/schemas';
import { Icon, Portrait, toneOf, useData } from '../ui';
import { ChampionPicker, filterChampions, RoleFilter, type RoleFilterValue } from './ChampionPicker';

interface Props {
  draft: DraftState;
  bans: DraftResult['bans'];
  dispatch: Dispatch<DraftAction>;
}

/** Raison d'un ban : valeur pour nous (stats mesurées), sinon raison rédigée ou menace (données d'exemple). */
const BanReason = ({ c }: { c: BanCard }) => {
  const i = c.impact;
  if (i) {
    return (
      <span className="small muted ellipsis" title={B.impactTip(i.strength, i.ours, i.drop)}>
        <span className={'strong ' + toneOf(i.value)}>{B.impact(i.value)}</span> · {B.impactDetail(c.winRate ?? 50, i.ours, i.drop)}
      </span>
    );
  }
  return <span className="small muted ellipsis" title={B.threatTip(c.threat)}>{c.reason ?? B.threatTip(c.threat)}</span>;
};

export const BanBar = ({ draft, bans, dispatch }: Props) => {
  const { engine } = useData();
  const [open, setOpen] = useState(false);
  const [picker, setPicker] = useState<Side | null>(null);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilterValue>('Tous');

  const openPicker = (side: Side) => {
    setPicker(side);
    setQuery('');
    setRoleFilter('Tous');
  };

  const items = useMemo(() => {
    if (!picker) return [];
    const avail = availability(draft);
    const full = (picker === 'ally' ? draft.allyBans : draft.enemyBans).length >= MAX_BANS;
    return filterChampions(engine.catalog, roleFilter, query).map((c) => {
      const why = avail.banBlocked(c.name);
      return { name: c.name, note: why ? BAN_BLOCKED_LABEL[why] : c.roles[0]!, disabled: !!why || full };
    });
  }, [picker, draft, query, roleFilter, engine]);

  const slots = (side: Side) => {
    const list = side === 'ally' ? draft.allyBans : draft.enemyBans;
    return Array.from({ length: MAX_BANS }, (_, i) => {
      const n = list[i];
      return n ? (
        <button key={'ban-' + n} type="button" className={'ban-slot is-' + side} aria-label={B.remove(n)} title={B.remove(n)} onClick={() => dispatch({ type: 'removeBan', side, champion: n })}>
          <Portrait name={n} size={46} />
          <svg aria-hidden="true" className="strike" viewBox="0 0 48 48"><line x1="6" y1="42" x2="42" y2="6" /></svg>
        </button>
      ) : (
        <button key={i} type="button" className="ban-slot is-empty" aria-label={side === 'ally' ? B.addAlly : B.addEnemy} onClick={() => openPicker(side)}>+</button>
      );
    });
  };

  const sideFull = picker && (picker === 'ally' ? draft.allyBans : draft.enemyBans).length >= MAX_BANS;
  // Tous rôles confondus, les 3 plus fortes valeurs (ou menaces avec les données d'exemple).
  const top = [...bans.suggestions].sort((a, b) => b.threat - a.threat).slice(0, 3);

  return (
    <section aria-label={B.title} className="card bans">
      <div className="row-between wrap">
        <h2 className="h2">{B.title}</h2>
        <div className="row-gap wrap">
          {/* Les 3 bans les plus utiles, bannis en un clic ; le panneau garde le détail par rôle. */}
          {!bans.allyFull && top.length > 0 && (
            <div className="row-gap ban-top" role="group" aria-label={B.topGroup}>
              <span className="small muted">{B.topLabel}</span>
              {top.map((c) => (
                <button
                  key={c.champion}
                  type="button"
                  className="ban-top-btn"
                  aria-label={B.banChampion(c.champion)}
                  title={B.topTip(c.champion, c.role, c.impact ? B.impact(c.impact.value) : c.reason ?? B.threatTip(c.threat))}
                  onClick={() => dispatch({ type: 'addBan', side: 'ally', champion: c.champion })}
                >
                  <Portrait name={c.champion} size={34} />
                </button>
              ))}
            </div>
          )}
          <button type="button" className="btn btn-sm" aria-expanded={open} onClick={() => setOpen(!open)}>
            {B.suggestions} <Icon name="chevron" size={14} rotate={open} />
          </button>
        </div>
      </div>
      {/* Alliés à gauche, ennemis collés à droite, en miroir comme les lignes de rôle. */}
      <div className="bans-row">
        <div className="ban-side" role="group" aria-label={B.allyGroup}>
          <span className="side-label ally">{B.allies}</span>
          <div className="ban-slots">{slots('ally')}</div>
        </div>
        <div className="ban-side is-enemy" role="group" aria-label={B.enemyGroup}>
          <span className="side-label enemy">{B.enemies}</span>
          <div className="ban-slots">{slots('enemy')}</div>
        </div>
      </div>

      {open && (bans.allyFull ? (
        <p className="small soft">{B.allyFull}</p>
      ) : (
        <div className="ban-roles">
          {ROLES.map((role) => {
            const list = bans.suggestions.filter((c) => c.role === role);
            if (!list.length) return null;
            return (
              <section key={role} className="col gap-6" aria-label={B.suggestedIn(role)}>
                <span className="detail-head muted">{role}</span>
                <ul className="ban-cards">
                  {list.map((c) => (
                    <li key={c.champion} className="ban-card">
                      <Portrait name={c.champion} size={44} label={c.champion} />
                      <div className="grow min0 col">
                        <span className="strong ellipsis">{c.champion}</span>
                        <BanReason c={c} />
                      </div>
                      <button type="button" className="btn btn-accent" aria-label={B.banChampion(c.champion)} onClick={() => dispatch({ type: 'addBan', side: 'ally', champion: c.champion })}>{B.ban}</button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ))}

      {picker && (
        <ChampionPicker
          title={picker === 'ally' ? B.pickerAlly : B.pickerEnemy}
          accent={picker === 'ally' ? 'var(--ally)' : 'var(--enemy)'}
          query={query}
          onQuery={setQuery}
          items={items}
          actionLabel={B.banChampion}
          onChoose={(n) => {
            dispatch({ type: 'addBan', side: picker, champion: n });
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
          filters={<RoleFilter value={roleFilter} onChange={setRoleFilter} />}
          footer={sideFull ? <span className="small warn-text">{B.sideFull}</span> : null}
        />
      )}
    </section>
  );
};
