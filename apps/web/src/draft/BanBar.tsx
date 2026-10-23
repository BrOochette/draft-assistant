import { useMemo, useState, type Dispatch } from 'react';
import { availability, MAX_BANS, type DraftAction, type DraftResult, type Side } from '@draft/engine';
import { BAN_BLOCKED_LABEL } from '@draft/i18n-fr';
import { ROLES, type DraftState, type Role } from '@draft/schemas';
import { Icon, Portrait, useData } from '../ui';
import { ChampionPicker } from './ChampionPicker';

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
  const [roleFilter, setRoleFilter] = useState<Role | 'Tous'>('Tous');

  const openPicker = (side: Side) => {
    setPicker(side);
    setQuery('');
    setRoleFilter('Tous');
  };

  const items = useMemo(() => {
    if (!picker) return [];
    const avail = availability(draft);
    const full = (picker === 'ally' ? draft.allyBans : draft.enemyBans).length >= MAX_BANS;
    const q = query.trim().toLowerCase();
    const all = [...engine.catalog.values()];
    const list = roleFilter === 'Tous'
      ? all.map((c) => c.name).sort((a, b) => a.localeCompare(b, 'fr'))
      : all.filter((c) => c.roles.includes(roleFilter)).map((c) => c.name);
    return list
      .filter((n) => !q || n.toLowerCase().includes(q))
      .map((n) => {
        const why = avail.banBlocked(n);
        return { name: n, note: why ? BAN_BLOCKED_LABEL[why] : engine.catalog.get(n)!.roles[0]!, disabled: !!why || full };
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
      <div className="bans-head">
        <h2 className="h2">Bans</h2>
        <div className="row-gap" role="group" aria-label="Bans de ton équipe">
          <span className="side-label ally">Alliés</span>
          {slots('ally')}
        </div>
        <div className="row-gap" role="group" aria-label="Bans de l'équipe ennemie">
          <span className="side-label enemy">Ennemis</span>
          {slots('enemy')}
        </div>
        <span className="grow" />
        <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen(!open)}>
          Suggestions de bans <Icon name="chevron" size={16} rotate={open} />
        </button>
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
                <span className="small soft ellipsis">{c.reason}</span>
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
          filters={
            <div role="group" aria-label="Filtrer par rôle" className="row-gap wrap">
              {(['Tous', ...ROLES] as const).map((r) => (
                <button key={r} type="button" className={'btn btn-toggle' + (roleFilter === r ? ' is-on' : '')} aria-pressed={roleFilter === r} onClick={() => setRoleFilter(r)}>{r}</button>
              ))}
            </div>
          }
          footer={sideFull ? <span className="small warn-text">Les 5 bans de ce côté sont déjà posés.</span> : null}
        />
      )}
    </section>
  );
};
