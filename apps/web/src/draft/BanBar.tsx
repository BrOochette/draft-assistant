import { useMemo, useState, type Dispatch } from 'react';
import { availability, MAX_BANS, type DraftAction, type DraftResult, type Side } from '@draft/engine';
import { BAN_BLOCKED_LABEL, fmtPct } from '@draft/i18n-fr';
import type { DraftState } from '@draft/schemas';
import { Icon, Portrait, useData } from '../ui';
import { ChampionPicker, filterChampions, RoleFilter, type RoleFilterValue } from './ChampionPicker';

interface Props {
  draft: DraftState;
  bans: DraftResult['bans'];
  dispatch: Dispatch<DraftAction>;
}

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
        <button key={i} type="button" className={'ban-slot is-' + side} aria-label={'Retirer le ban de ' + n} title={'Retirer le ban de ' + n} onClick={() => dispatch({ type: 'removeBan', side, champion: n })}>
          <Portrait name={n} size={46} />
          <svg aria-hidden="true" className="strike" viewBox="0 0 48 48"><line x1="6" y1="42" x2="42" y2="6" /></svg>
        </button>
      ) : (
        <button key={i} type="button" className="ban-slot is-empty" aria-label={side === 'ally' ? 'Ajouter un ban de ton équipe' : "Saisir un ban de l'équipe ennemie"} onClick={() => openPicker(side)}>+</button>
      );
    });
  };

  const sideFull = picker && (picker === 'ally' ? draft.allyBans : draft.enemyBans).length >= MAX_BANS;

  return (
    <section aria-label="Bans" className="card bans">
      <div className="row-between">
        <h2 className="h2">Bans</h2>
        <button type="button" className="btn btn-sm" aria-expanded={open} onClick={() => setOpen(!open)}>
          Suggestions de bans <Icon name="chevron" size={14} rotate={open} />
        </button>
      </div>
      {/* Alliés à gauche, ennemis collés à droite, en miroir comme les lignes de rôle. */}
      <div className="bans-row">
        <div className="ban-side" role="group" aria-label="Bans de ton équipe">
          <span className="side-label ally">Alliés</span>
          <div className="ban-slots">{slots('ally')}</div>
        </div>
        <div className="ban-side is-enemy" role="group" aria-label="Bans de l'équipe ennemie">
          <span className="side-label enemy">Ennemis</span>
          <div className="ban-slots">{slots('enemy')}</div>
        </div>
      </div>

      {open && (bans.allyFull ? (
        <p className="small soft">Les 5 bans de ton équipe sont posés.</p>
      ) : (
        <ul className="ban-cards">
          {bans.suggestions.map((c) => (
            <li key={c.champion} className="ban-card">
              <Portrait name={c.champion} size={44} label={c.champion} />
              <div className="grow min0 col">
                <span className="small muted">{c.role} · menace {c.threat}</span>
                <span className="small soft ellipsis">{c.reason ?? (c.winRate != null ? 'Win rate ' + fmtPct(c.winRate) + ' en ' + c.role : '')}</span>
              </div>
              <button type="button" className="btn btn-accent" aria-label={'Bannir ' + c.champion} onClick={() => dispatch({ type: 'addBan', side: 'ally', champion: c.champion })}>Bannir</button>
            </li>
          ))}
        </ul>
      ))}

      {picker && (
        <ChampionPicker
          title={picker === 'ally' ? 'Ban de ton équipe' : "Ban de l'équipe ennemie"}
          accent={picker === 'ally' ? 'var(--ally)' : 'var(--enemy)'}
          query={query}
          onQuery={setQuery}
          items={items}
          actionLabel={(n) => 'Bannir ' + n}
          onChoose={(n) => {
            dispatch({ type: 'addBan', side: picker, champion: n });
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
          filters={<RoleFilter value={roleFilter} onChange={setRoleFilter} />}
          footer={sideFull ? <span className="small warn-text">Les 5 bans de ce côté sont déjà posés.</span> : null}
        />
      )}
    </section>
  );
};
