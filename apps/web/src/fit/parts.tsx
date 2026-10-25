import { useMemo, useState, type Dispatch, type ReactNode } from 'react';
import { availability, MAX_BANS, type DraftAction, type DraftResult, type Evaluation, type Side } from '@draft/engine';
import {
  BAN_BLOCKED_LABEL,
  BANS_TEXT as B,
  blockedLabel,
  CARD_TEXT as C,
  COMPO_TEXT as CT,
  CRITERION_LABEL,
  CRITERION_TIP,
  DRAFT_TEXT as D,
  fmtSigned,
  PHASE_SHORT,
  phaseTitle,
  SCALING_VERDICT_LABEL,
  VIEW_TEXT as T,
  VERDICT_LABEL,
  allyReadText
} from '@draft/i18n-fr';
import type { DraftState, Role } from '@draft/schemas';
import { Icon, Portrait, useData } from '../ui';
import { ChampionPicker, filterChampions, RoleFilter, type RoleFilterValue } from '../draft/ChampionPicker';

// Briques compactes communes aux mises en page de la page test.

type Target = { kind: 'pick'; side: Side; role: Role } | { kind: 'ban'; side: Side };

/** Sélecteur manuel (pick d'un rôle ou ban), dans la fenêtre modale existante. */
export const usePicker = (draft: DraftState, dispatch: Dispatch<DraftAction>) => {
  const { engine } = useData();
  const [target, setTarget] = useState<Target | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RoleFilterValue>('Tous');

  const open = (t: Target) => {
    setTarget(t);
    setQuery('');
    setFilter(t.kind === 'pick' ? t.role : 'Tous');
  };

  const items = useMemo(() => {
    if (!target) return [];
    const avail = availability(draft);
    return filterChampions(engine.catalog, filter, query).map((c) => {
      if (target.kind === 'ban') {
        const why = avail.banBlocked(c.name);
        const full = (target.side === 'ally' ? draft.allyBans : draft.enemyBans).length >= MAX_BANS;
        return { name: c.name, note: why ? BAN_BLOCKED_LABEL[why] : c.roles[0]!, disabled: !!why || full };
      }
      const why = avail.blocked(c.name, target.side, target.role);
      return { name: c.name, note: why ? blockedLabel(why, target.side) : c.roles.includes(target.role) ? '' : c.roles[0]!, disabled: !!why };
    });
  }, [target, draft, query, filter, engine]);

  const element = target && (
    <ChampionPicker
      title={target.kind === 'ban' ? (target.side === 'ally' ? B.pickerAlly : B.pickerEnemy) : target.side === 'ally' ? D.pickerAlly(draft.assign[target.role], target.role) : D.pickerEnemy(target.role)}
      accent={target.side === 'ally' ? 'var(--ally)' : 'var(--enemy)'}
      query={query}
      onQuery={setQuery}
      items={items}
      actionLabel={(n) => (target.kind === 'ban' ? B.banChampion(n) : target.side === 'ally' ? D.chooseIn(n, target.role) : D.enterIn(n, target.role))}
      onChoose={(n) => {
        if (target.kind === 'ban') dispatch({ type: 'addBan', side: target.side, champion: n });
        else dispatch(target.side === 'ally' ? { type: 'lock', role: target.role, champion: n } : { type: 'setEnemy', role: target.role, champion: n });
        setTarget(null);
      }}
      onClose={() => setTarget(null)}
      filters={<RoleFilter value={filter} onChange={setFilter} />}
    />
  );
  return { open, element };
};

/** Bans d'un camp : portrait barré (un clic retire), « + » pour ajouter. */
export const BanStrip = ({ draft, side, size, dispatch, onAdd }: { draft: DraftState; side: Side; size: number; dispatch: Dispatch<DraftAction>; onAdd: () => void }) => {
  const list = side === 'ally' ? draft.allyBans : draft.enemyBans;
  return (
    <div role="group" aria-label={side === 'ally' ? B.allyGroup : B.enemyGroup} className="fit-bans">
      {Array.from({ length: MAX_BANS }, (_, i) => {
        const n = list[i];
        return n ? (
          <button key={n} type="button" className={'ban-slot fit-ban is-' + side} style={{ width: size, height: size }} aria-label={B.remove(n)} title={B.remove(n)} onClick={() => dispatch({ type: 'removeBan', side, champion: n })}>
            <Portrait name={n} size={size - 2} />
            <svg aria-hidden="true" className="strike" viewBox="0 0 48 48"><line x1="6" y1="42" x2="42" y2="6" /></svg>
          </button>
        ) : (
          <button key={i} type="button" className="ban-slot fit-ban is-empty" style={{ width: size, height: size }} aria-label={side === 'ally' ? B.addAlly : B.addEnemy} onClick={onAdd}>+</button>
        );
      })}
    </div>
  );
};

/** Emplacement d'un pick : portrait (survol estompé), « ? » sinon ; un clic ouvre le sélecteur, la croix retire. */
export const Face = ({ side, role, name, hover, size, onOpen, onRemove }: {
  side: Side; role: Role; name: string | null; hover?: string | null; size: number; onOpen: () => void; onRemove: () => void;
}) => {
  const shown = name ?? hover ?? null;
  return (
    <span className="face-wrap">
      <button
        type="button"
        className={'face fit-face ' + (name ? 'is-' + side : side === 'ally' ? 'is-empty-ally' : 'is-waiting')}
        style={{ width: size, height: size }}
        aria-label={side === 'ally' ? D.allyFace(!!name, null, role) : D.enemyFace(!!name, role)}
        title={!name && hover ? D.hoverTip(hover) : name ?? undefined}
        onClick={onOpen}
      >
        {shown ? <span className={'face-img' + (!name ? ' is-hover' : '')}><Portrait name={shown} size={size - 4} /></span> : '?'}
      </button>
      {name && (
        <button type="button" className="remove" aria-label={side === 'ally' ? D.removeAlly(name, role) : D.removeEnemy(name, role)} title={D.removeTip(name)} onClick={onRemove}>
          <Icon name="close" size={12} />
        </button>
      )}
    </span>
  );
};

/** Contributions en texte court : ennemis, alliés, maîtrise (« — » : rien à mesurer). */
const contribRows = (e: Evaluation) => {
  const x = e.expected;
  if (!x) return [{ label: C.synergy, text: String(e.synergy), tone: '' }, { label: C.counter, text: String(e.counter), tone: '' }];
  const row = (label: string, v: number | null) => {
    const r = v == null ? 0 : Math.round(v * 10);
    return { label, text: v == null ? T.noData : fmtSigned(v), tone: v == null || r === 0 ? 'muted' : r > 0 ? 'pos-text' : 'neg-text' };
  };
  return [
    row(C.enemies, e.enemyTeam.length ? x.matchups : null),
    row(C.allies, e.allyTeam.length ? x.duos : null),
    row(C.mastery, e.mastery == null ? null : x.mastery)
  ];
};

export const Contribs = ({ e }: { e: Evaluation }) => (
  <span className="fit-contribs">
    {contribRows(e).map((r) => (
      <span key={r.label} className="nowrap"><span className="muted">{r.label}</span> <span className={'strong ' + r.tone}>{r.text}</span></span>
    ))}
  </span>
);

const TONE: Record<string, string> = { solid: 'pos', fair: 'info', fragile: 'warn', fix: 'neg', advantage: 'pos', even: 'plain', disadvantage: 'neg' };

/** Deux barres fines, alliée et ennemie, sur 100. */
const Pair = ({ a, b }: { a: number; b: number }) => (
  <span className="fit-pair" aria-hidden="true">
    <span className="fit-bar"><span style={{ width: a + '%', background: 'var(--ally)' }} /></span>
    <span className="fit-bar"><span style={{ width: b + '%', background: 'var(--enemy)' }} /></span>
  </span>
);

/** Analyse de compo resserrée : notes, 5 critères, scaling par phase, lecture de ta compo. */
export const CompoCompact = ({ result, horizontal = false }: { result: DraftResult; horizontal?: boolean }) => {
  const { ally, enemy } = result.composition;
  const score = (label: string, cls: string, s: typeof ally) => (
    <span className="fit-team">
      <span className={'eyebrow ' + cls}>{label}</span>
      <span className={'fit-big tone-' + TONE[s.verdict]}>{s.total}</span>
      <span className={'chip chip-' + TONE[s.verdict]}>{VERDICT_LABEL[s.verdict]}</span>
    </span>
  );
  const block = (children: ReactNode, label: string) => <section aria-label={label} className="fit-block">{children}</section>;
  return (
    <div className={'fit-compo' + (horizontal ? ' is-horizontal' : '')}>
      {block(<div className="fit-scores">{score(CT.ally, 'ally-text', ally)}{score(CT.enemy, 'enemy-text', enemy)}</div>, CT.scores)}
      {block(
        ally.criteria.map((c, i) => {
          const e = enemy.criteria[i]!;
          return (
            <div key={c.key} className="fit-crit" title={CRITERION_TIP[c.key] + ' · ' + CT.allies + ' ' + c.value + ', ' + CT.enemies + ' ' + e.value}>
              <span className="small">{CRITERION_LABEL[c.key]}</span>
              <Pair a={c.value} b={e.value} />
            </div>
          );
        }),
        CT.scores
      )}
      {block(
        <>
          <span className="small strong">{CT.scaling}</span>
          <div className="fit-phases">
            {result.scaling.map((p) => (
              <span key={p.phase} className={'chip chip-' + TONE[p.verdict]} title={phaseTitle(p.phase) + ' · ' + SCALING_VERDICT_LABEL[p.verdict]}>
                {PHASE_SHORT[p.phase]} {SCALING_VERDICT_LABEL[p.verdict]}
              </span>
            ))}
          </div>
        </>,
        CT.scalingSection
      )}
      {result.allyRead.length > 0 && block(
        <ul className="plain-list fit-read">
          {result.allyRead.map((x, i) => (
            <li key={i} className={'small ' + (x.sign === '+' ? 'pos-text' : 'neg-text')}><span className="bold">{x.sign}</span> {allyReadText(x)}</li>
          ))}
        </ul>,
        CT.reading
      )}
    </div>
  );
};
