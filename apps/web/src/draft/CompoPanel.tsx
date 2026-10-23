import { useState } from 'react';
import type { CompScore, DraftResult, ScalingVerdict, Verdict } from '@draft/engine';
import {
  allyReadText,
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
    <span className={'eyebrow ' + side + '-text'}>{side === 'ally' ? 'Ta compo' : 'Compo ennemie'}</span>
    <span className={'big-score tone-' + VERDICT_TONE[score.verdict]} data-testid="compo-score">{score.total}</span>
    <span className={'chip chip-' + VERDICT_TONE[score.verdict] + ' bold'} data-testid="compo-verdict">{VERDICT_LABEL[score.verdict]}</span>
  </div>
);

export const CompoPanel = ({ result }: { result: DraftResult }) => {
  const { snapshot } = useData();
  const [help, setHelp] = useState(false);
  const { ally, enemy } = result.composition;
  return (
    <aside aria-label="Analyse de la composition" className="side">
      <section aria-label="Notes des compositions" className="card col gap-10">
        <div className="score-pair">
          <TeamScore side="ally" score={ally} />
          <TeamScore side="enemy" score={enemy} />
        </div>
        <span className="small muted center-text">Notes sur 100</span>
        {ally.criteria.map((c, i) => {
          const e = enemy.criteria[i]!;
          return (
            <div key={c.key} className="col gap-4" title={CRITERION_TIP[c.key]}>
              <span className="small strong">{CRITERION_LABEL[c.key]}</span>
              <div className="phase-line"><span>Alliés</span><Bar value={c.value} color="var(--ally)" /><span className="text right">{c.value}</span></div>
              <div className="phase-line"><span>Ennemis</span><Bar value={e.value} color="var(--enemy)" /><span className="text right">{e.value}</span></div>
            </div>
          );
        })}
      </section>

      <section aria-label="Scaling des deux équipes" className="card col gap-10">
        <h2 className="h3">Scaling</h2>
        {result.scaling.map((p) => (
          <div key={p.phase} className="col gap-4">
            <div className="row-between small">
              <span className="strong">{phaseTitle(p.phase)}</span>
              <span className={'chip chip-' + SCALING_TONE[p.verdict]}>{SCALING_VERDICT_LABEL[p.verdict]}</span>
            </div>
            <div className="phase-line"><span>Alliés</span><Bar value={(p.ally / 5) * 100} color="var(--ally)" /><span className="text right">{fmt1(p.ally)}</span></div>
            <div className="phase-line"><span>Ennemis</span><Bar value={(p.enemy / 5) * 100} color="var(--enemy)" /><span className="text right">{fmt1(p.enemy)}</span></div>
          </div>
        ))}
      </section>

      <section aria-label="Lecture des compositions" className="card col gap-10">
        <h2 className="h3">Ta compo</h2>
        <ul className="plain-list">
          {result.allyRead.map((x, i) => (
            <li key={i} className={'read-item ' + (x.sign === '+' ? 'pos-text' : 'neg-text')}>
              <span className="bold sign">{x.sign}</span><span className="text">{allyReadText(x)}</span>
            </li>
          ))}
        </ul>
        <h2 className="h3">Compo ennemie</h2>
        <ul className="plain-list">
          {result.enemyRead.map((x, i) => <li key={i} className="small text">{enemyReadText(x)}</li>)}
        </ul>
      </section>

      {result.team.length > 0 && (
        <section aria-label="Points d'attention sur l'équipe" className="card col gap-8 team">
          <h2 className="h3 warn-text">Équipe</h2>
          <ul className="plain-list">
            {result.team.map((n, i) => <li key={i} className="small text">{teamNoteText(n)}</li>)}
          </ul>
        </section>
      )}

      <section aria-label="Aide" className="card col gap-10">
        <button type="button" className="help-toggle" aria-expanded={help} onClick={() => setHelp(!help)}>
          <span>Lire les scores</span><Icon name="chevron" size={16} rotate={help} />
        </button>
        {help && (
          <dl className="help">
            <div><dt>Score sur 100</dt><dd>Combine synergie avec ta compo, counter face à l'ennemi et maîtrise du joueur. Sans pool, la maîtrise est ignorée.</dd></div>
            <div><dt>Compo +N</dt><dd>Points que ce pick ajoute à la note globale de ta compo.</dd></div>
            <div><dt>Lane et Partie</dt><dd>Win rate du champion dans ce matchup en lane, et sur la partie entière.</dd></div>
            <div><dt>Peu fiable</dt><dd>Moins de 500 parties derrière le win rate : la valeur peut changer fortement.</dd></div>
            <div><dt>Scaling D, M, F</dt><dd>Puissance au début, au milieu et en fin de partie, de 1 à 5.</dd></div>
            <div>
              <dt>Données</dt>
              <dd>
                {snapshot.source === 'sample'
                  ? `Patch ${snapshot.patch}, rang ${snapshot.rank}. Valeurs d'exemple.`
                  : `Lolalytics, patch ${snapshot.patch}, rang ${snapshot.rank}, ${snapshot.region ? 'région ' + snapshot.region : 'toutes régions'}. Win rate de lane indisponible : le counter repose sur le win rate de partie, contre l'adversaire de lane quand il est connu, lissé vers 50 % (3 000 parties fictives, 1 000 pour un matchup) pour ne pas surévaluer les picks et matchups peu joués. Sans pool, seuls les champions qui jouent ce rôle dans au moins 20 % de leurs parties sont classés. La synergie inclut les win rates de duo avec les alliés verrouillés.`}
              </dd>
            </div>
          </dl>
        )}
      </section>
    </aside>
  );
};
