import { useState } from 'react';
import type { ArchetypeGroup, CompScore, DraftResult, ScalingVerdict, Verdict } from '@draft/engine';
import {
  allyReadText,
  ARCHETYPE_LABEL,
  COMPO_TEXT as T,
  CRITERION_LABEL,
  CRITERION_TIP,
  enemyReadText,
  fmt1,
  phaseTitle,
  SCALING_VERDICT_LABEL,
  teamNoteText,
  VERDICT_LABEL
} from '@draft/i18n-fr';
import { Bar, Icon, useData } from '../ui';

const VERDICT_TONE: Record<Verdict, string> = { solid: 'pos', fair: 'info', fragile: 'warn', fix: 'neg' };
const SCALING_TONE: Record<ScalingVerdict, string> = { advantage: 'pos', even: 'plain', disadvantage: 'neg' };

const TeamScore = ({ side, score }: { side: 'ally' | 'enemy'; score: CompScore & { verdict: Verdict } }) => (
  <div className="col center-items gap-4 team-score" data-testid={side + '-compo'}>
    <span className={'eyebrow ' + side + '-text'}>{side === 'ally' ? T.ally : T.enemy}</span>
    <span className={'big-score tone-' + VERDICT_TONE[score.verdict]} data-testid="compo-score">{score.total}</span>
    <span className={'chip chip-' + VERDICT_TONE[score.verdict] + ' bold'} data-testid="compo-verdict">{VERDICT_LABEL[score.verdict]}</span>
  </div>
);

/** Archétypes de la compo (au moins 2 champions), factuel. */
const Archetypes = ({ groups }: { groups: ArchetypeGroup[] }) =>
  groups.length ? (
    <ul className="plain-list" title={T.archetypeTip}>
      {groups.map((g) => <li key={g.archetype} className="small text">{T.archetype(ARCHETYPE_LABEL[g.archetype], g.names)}</li>)}
    </ul>
  ) : null;

export const CompoPanel = ({ result }: { result: DraftResult }) => {
  const { snapshot, engine } = useData();
  const [help, setHelp] = useState(false);
  const { ally, enemy } = result.composition;
  return (
    <aside aria-label={T.aside} className="side">
      <section aria-label={T.scores} className="card col gap-10">
        <div className="score-pair">
          <TeamScore side="ally" score={ally} />
          <TeamScore side="enemy" score={enemy} />
        </div>
        <span className="small muted center-text">{T.outOf100}</span>
        {ally.criteria.map((c, i) => {
          const e = enemy.criteria[i]!;
          return (
            <div key={c.key} className="col gap-4" title={CRITERION_TIP[c.key]}>
              <span className="small strong">{CRITERION_LABEL[c.key]}</span>
              <div className="phase-line"><span>{T.allies}</span><Bar value={c.value} color="var(--ally)" /><span className="text right">{c.value}</span></div>
              <div className="phase-line"><span>{T.enemies}</span><Bar value={e.value} color="var(--enemy)" /><span className="text right">{e.value}</span></div>
            </div>
          );
        })}
      </section>

      <section aria-label={T.scalingSection} className="card col gap-10">
        <h2 className="h3">{T.scaling}</h2>
        {result.scaling.map((p) => (
          <div key={p.phase} className="col gap-4">
            <div className="row-between small">
              <span className="strong">{phaseTitle(p.phase)}</span>
              <span className={'chip chip-' + SCALING_TONE[p.verdict]}>{SCALING_VERDICT_LABEL[p.verdict]}</span>
            </div>
            <div className="phase-line"><span>{T.allies}</span><Bar value={(p.ally / 5) * 100} color="var(--ally)" /><span className="text right">{fmt1(p.ally)}</span></div>
            <div className="phase-line"><span>{T.enemies}</span><Bar value={(p.enemy / 5) * 100} color="var(--enemy)" /><span className="text right">{fmt1(p.enemy)}</span></div>
          </div>
        ))}
      </section>

      <section aria-label={T.reading} className="card col gap-10">
        <h2 className="h3">{T.ally}</h2>
        <ul className="plain-list">
          {result.allyRead.map((x, i) => (
            <li key={i} className={'read-item ' + (x.sign === '+' ? 'pos-text' : 'neg-text')}>
              <span className="bold sign">{x.sign}</span><span className="text">{allyReadText(x)}</span>
            </li>
          ))}
        </ul>
        <Archetypes groups={result.archetypes.ally} />
        <h2 className="h3">{T.enemy}</h2>
        <ul className="plain-list">
          {result.enemyRead.map((x, i) => <li key={i} className="small text">{enemyReadText(x)}</li>)}
        </ul>
        <Archetypes groups={result.archetypes.enemy} />
      </section>

      {result.team.length > 0 && (
        <section aria-label={T.team} className="card col gap-8 team">
          <h2 className="h3 warn-text">{T.teamTitle}</h2>
          <ul className="plain-list">
            {result.team.map((n, i) => <li key={i} className="small text">{teamNoteText(n)}</li>)}
          </ul>
        </section>
      )}

      <section aria-label={T.help} className="card col gap-10">
        <button type="button" className="help-toggle" aria-expanded={help} onClick={() => setHelp(!help)}>
          <span>{T.helpToggle}</span><Icon name="chevron" size={16} rotate={help} />
        </button>
        {help && (
          <dl className="help">
            {T.helpItems(engine.measured).map(([term, text]) => <div key={term}><dt>{term}</dt><dd>{text}</dd></div>)}
            <div>
              <dt>{T.data}</dt>
              <dd>{snapshot.source === 'sample' ? T.dataSample(snapshot.patch, snapshot.rank) : T.dataMeasured(snapshot.patch, snapshot.rank, snapshot.region)}</dd>
            </div>
          </dl>
        )}
      </section>
    </aside>
  );
};
