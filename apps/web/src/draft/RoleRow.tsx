import { useMemo, useState, type Dispatch } from 'react';
import { availability, type DraftAction, type Evaluation, type RoleResult, type Side } from '@draft/engine';
import { blockedLabel, fmtDelta, fmtInt, fmtPct, formatReason, POOL_TAG, recNoteText } from '@draft/i18n-fr';
import type { DraftState, Note } from '@draft/schemas';
import { Bar, Chip, Icon, Portrait, ScalingBars, scoreStats, useData, WinRateChips } from '../ui';
import { ChampionPicker } from './ChampionPicker';

interface Props {
  row: RoleResult;
  draft: DraftState;
  players: string[];
  selected: string | undefined;
  dispatch: Dispatch<DraftAction>;
}

const ReasonChip = ({ r }: { r: Parameters<typeof formatReason>[0] }) => (
  <Chip tone={r.sign === '+' ? 'pos' : 'neg'}>{formatReason(r)}</Chip>
);

const sampleText = (e: Evaluation) => fmtInt(e.games) + ' parties' + (e.lowSample ? ' : peu fiable' : '');
const sampleTip = (e: Evaluation) => 'Échantillon de ' + fmtInt(e.games) + ' parties : sous 500 parties, le win rate est peu fiable';

const RecCard = ({ e, rank, selected, onSelect, onLock, role }: { e: Evaluation; rank: number; selected: boolean; onSelect: () => void; onLock: () => void; role: string }) => {
  const stats = scoreStats(e);
  return (
    <li className={'rec' + (selected ? ' is-selected' : '')}>
      <button
        type="button"
        className="rec-body"
        aria-pressed={selected}
        aria-label={e.champion + ', score ' + e.total + ' sur 100. ' + (selected ? 'Sélectionné.' : 'Sélectionner.')}
        title={e.champion + ' : ' + stats.map((s) => s.label + ' ' + s.v).join(', ')}
        onClick={onSelect}
      >
        <span className="rec-top">
          <span className="rec-face">
            <Portrait name={e.champion} size={56} />
            <span className={'rank' + (rank === 1 ? ' is-first' : '')}>{rank}</span>
          </span>
          <span className="col">
            <span className={'score' + (rank === 1 ? ' is-best' : '')}>{e.total}</span>
            <span className="delta">Compo {fmtDelta(e.compoDelta)}</span>
          </span>
        </span>
        <span className="rec-stats">
          {stats.map((s) => (
            <span key={s.label} className="col min0">
              <span className="small muted nowrap">{s.label} <span className="strong text">{s.v}</span></span>
              <Bar value={s.w} color={s.color} />
            </span>
          ))}
        </span>
        <span className="row-gap wrap">
          <WinRateChips lane={fmtPct(e.laneWinRate)} game={fmtPct(e.gameWinRate)} />
          {e.lowSample && <Chip tone="warn" title={sampleTip(e)}><Icon name="warn" />Peu fiable</Chip>}
        </span>
      </button>
      {selected && (
        <button type="button" className="lock-btn" aria-label={'Verrouiller ' + e.champion + ' en ' + role} onClick={onLock}>
          <Icon name="lock" size={16} />Verrouiller
        </button>
      )}
    </li>
  );
};

const StatLine = ({ e, barWidth }: { e: Evaluation; barWidth: number }) => (
  <>
    {scoreStats(e).map((s) => (
      <div key={s.label} className="stat-line" title={s.tip}>
        <span className="stat-label">{s.label}</span>
        <Bar value={s.w} color={s.color} width={barWidth} />
        <span className="strong text">{s.v}</span>
      </div>
    ))}
    <ScalingBars scaling={e.scaling} />
  </>
);

const DetailItem = ({ e, best, selected, onLock, role }: { e: Evaluation; best: boolean; selected: boolean; onLock: () => void; role: string }) => (
  <div className={'detail' + (selected ? ' is-selected' : '')}>
    <div className="row-gap wrap center">
      <Portrait name={e.champion} size={48} label={e.champion} />
      <div className="row-gap wrap center grow min0">
        <span className="detail-name">{e.champion}</span>
        <Chip tone={e.pool === 'out' ? 'warn' : 'plain'}>{POOL_TAG[e.pool]}</Chip>
      </div>
      <div className="row-gap baseline">
        <span className={'score-md' + (best ? ' is-best' : '')}>{e.total}</span>
        <span className="delta">Compo {fmtDelta(e.compoDelta)}</span>
      </div>
      <button type="button" className="btn btn-accent" aria-label={'Verrouiller ' + e.champion + ' en ' + role} onClick={onLock}>Verrouiller</button>
    </div>
    <div className="row-gap wrap">
      {e.reasons.slice(0, 3).map((r, i) => <ReasonChip key={i} r={r} />)}
    </div>
    <div className="row-gap wrap center gap-lg">
      <StatLine e={e} barWidth={64} />
      <WinRateChips lane={fmtPct(e.laneWinRate)} game={fmtPct(e.gameWinRate)} />
      <span className={'small ' + (e.lowSample ? 'warn-text' : 'muted')} title={sampleTip(e)}>{sampleText(e)}</span>
    </div>
  </div>
);

const lockedChips = (row: RoleResult): { sign: '+' | '-' | null; text: string }[] => {
  const l = row.locked!;
  const notes = (list: Note[]) => list.map((n) => ({ sign: n.sign, text: formatReason(n) }));
  if (l.info) {
    const matchup = l.matchup
      ? notes(l.matchup)
      : [{ sign: null, text: row.enemyPick ? 'Pas de données de matchup pour cette paire' : 'Adversaire direct inconnu' }];
    return [...matchup, ...notes(l.info)];
  }
  return [...(l.matchup ? notes(l.matchup) : []), ...l.reasons.slice(0, 3).map((r) => ({ sign: r.sign, text: formatReason(r) }))];
};

export const RoleRow = ({ row, draft, players, selected, dispatch }: Props) => {
  const { engine } = useData();
  const { role, player } = row;
  const [expanded, setExpanded] = useState(false);
  const [picker, setPicker] = useState<Side | null>(null);
  const [query, setQuery] = useState('');
  const ally = row.allyPick;
  const enemy = row.enemyPick;
  const active = !ally;

  const openPicker = (side: Side) => {
    setPicker(picker === side ? null : side);
    setQuery('');
  };

  const items = useMemo(() => {
    if (!picker) return [];
    const avail = availability(draft);
    const q = query.trim().toLowerCase();
    const current = picker === 'ally' ? ally : enemy;
    return [...engine.catalog.values()]
      .filter((c) => c.roles.includes(role) && (!q || c.name.toLowerCase().includes(q)))
      .map((c) => {
        const why = avail.blocked(c.name, picker, role);
        const isCurrent = c.name === current;
        return { name: c.name, note: isCurrent ? 'Actuel' : why ? blockedLabel(why, picker) : '', disabled: !!why, current: isCurrent };
      });
  }, [picker, query, draft, engine, role, ally, enemy]);

  const lock = (champion: string) => {
    dispatch({ type: 'lock', role, champion });
    setPicker(null);
  };

  const shown = active ? row.recommendations : [];

  return (
    <section className="card role-row" aria-label={'Rôle ' + role}>
      <div className="role-main">
        <div className="role-side">
          <div className="row-between">
            <span className="role-name">{role}</span>
            {active
              ? <span className="state state-open"><Icon name="circle" />À choisir</span>
              : <span className="state state-locked"><Icon name="lock" />Verrouillé</span>}
          </div>
          <div className="faces">
            <div className="face-col">
              <div className="face-wrap">
                <button
                  type="button"
                  className={'face ' + (ally ? 'is-ally' : 'is-empty-ally')}
                  aria-expanded={picker === 'ally'}
                  aria-label={(ally ? 'Saisie manuelle : changer le champion de ' : 'Saisie manuelle : choisir le champion de ') + player + ' en ' + role}
                  title={ally ? 'Changer à la main' : 'Choisir à la main'}
                  onClick={() => openPicker('ally')}
                >
                  {ally ? <Portrait name={ally} size={58} /> : '?'}
                </button>
                {ally && (
                  <button type="button" className="remove" aria-label={'Retirer ' + ally + ' et rouvrir les suggestions en ' + role} title={'Retirer ' + ally} onClick={() => dispatch({ type: 'unlock', role })}>
                    <Icon name="close" size={12} />
                  </button>
                )}
              </div>
              <span className="small strong center-text">{ally ?? 'À choisir'}</span>
            </div>
            <span className="vs">VS</span>
            <div className="face-col">
              <button
                type="button"
                className={'face ' + (enemy ? 'is-enemy' : 'is-waiting')}
                aria-expanded={picker === 'enemy'}
                aria-label={(enemy ? 'Saisie manuelle : changer le pick ennemi en ' : 'Saisie manuelle : pick ennemi en ') + role}
                title={enemy ? 'Changer à la main' : 'Saisir à la main'}
                onClick={() => openPicker('enemy')}
              >
                {enemy ? <Portrait name={enemy} size={58} /> : '?'}
              </button>
              <span className={'small strong center-text' + (enemy ? '' : ' muted')}>{enemy ?? 'En attente'}</span>
            </div>
          </div>
          <div className="col gap-4">
            <label htmlFor={'player-' + role} className="small muted">Joueur</label>
            <select id={'player-' + role} className="input" value={player} onChange={(e) => dispatch({ type: 'assignPlayer', role, player: e.target.value })}>
              {!players.includes(player) && <option value={player}>{player}</option>}
              {players.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {!row.hasPool && <span className="small warn-text row-gap"><Icon name="warn" />Sans pool : tous les champions</span>}
          {row.multiRole && <span className="small neg-text row-gap"><Icon name="warn" />Placé sur plusieurs rôles</span>}
        </div>

        <div className="role-center">
          {active && (
            <>
              <div className="row-between wrap">
                <span className="small soft">{row.note ? recNoteText(row.note, player, role) : ''}</span>
                <button type="button" className="btn" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
                  {expanded ? 'Réduire' : 'Plus de détails'} <Icon name="chevron" size={16} rotate={expanded} />
                </button>
              </div>
              {shown.length === 0 && <span className="empty-box">Aucun champion disponible pour ce rôle.</span>}
              <ul className="recs">
                {shown.map((e, i) => (
                  <RecCard
                    key={e.champion}
                    e={e}
                    rank={i + 1}
                    role={role}
                    selected={selected === e.champion}
                    onSelect={() => dispatch({ type: 'select', role, champion: e.champion })}
                    onLock={() => lock(e.champion)}
                  />
                ))}
              </ul>
              {expanded && (
                <ul className="details">
                  {row.inPool.map((e, i) => (
                    <li key={e.champion} className="col gap-6">
                      {i === 0 && <span className="detail-head accent-text">{row.hasPool ? 'Pool' : 'Tous les champions ' + role + ' (aucun pool)'}</span>}
                      <DetailItem e={e} best={i === 0} role={role} selected={selected === e.champion} onLock={() => lock(e.champion)} />
                    </li>
                  ))}
                  {row.outOfPool.map((e, i) => (
                    <li key={e.champion} className="col gap-6">
                      {i === 0 && <span className="detail-head warn-text">Hors pool</span>}
                      <DetailItem e={e} best={false} role={role} selected={selected === e.champion} onLock={() => lock(e.champion)} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {row.locked && (
            <>
              <div className="row-gap wrap center">
                <span className="score is-best">{row.locked.total}</span>
                <span className="delta">Compo {fmtDelta(row.locked.compoDelta)}</span>
                <Chip tone={row.locked.pool === 'out' ? 'warn' : 'plain'}>{POOL_TAG[row.locked.pool]}</Chip>
                <WinRateChips lane={fmtPct(row.locked.laneWinRate)} game={fmtPct(row.locked.gameWinRate)} />
                <span className={'small ' + (row.locked.lowSample ? 'warn-text' : 'muted')} title={sampleTip(row.locked)}>{sampleText(row.locked)}</span>
              </div>
              <div className="row-gap wrap center gap-lg">
                <StatLine e={row.locked} barWidth={80} />
              </div>
              <div className="row-gap wrap">
                {lockedChips(row).map((c, i) => (
                  <Chip key={i} tone={c.sign === '+' ? 'pos' : c.sign === '-' ? 'neg' : 'plain'}>{c.text}</Chip>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {picker && (
        <ChampionPicker
          title={picker === 'ally' ? 'Champion de ' + player + ' en ' + role : 'Pick ennemi en ' + role}
          accent={picker === 'ally' ? 'var(--ally)' : 'var(--enemy)'}
          query={query}
          onQuery={setQuery}
          items={items}
          actionLabel={(n) => (picker === 'ally' ? 'Choisir ' : 'Saisir ') + n + ' en ' + role}
          onChoose={(n) => {
            if (picker === 'ally') lock(n);
            else {
              dispatch({ type: 'setEnemy', role, champion: n });
              setPicker(null);
            }
          }}
          onClose={() => setPicker(null)}
          actions={picker === 'enemy' && enemy ? (
            <button type="button" className="btn neg-text" onClick={() => { dispatch({ type: 'clearEnemy', role }); setPicker(null); }}>Effacer</button>
          ) : null}
        />
      )}
    </section>
  );
};
