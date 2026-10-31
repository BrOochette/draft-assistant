import { BUILD_TEXT as B, CHAMPIONS_TEXT as CH } from '@draft/i18n-fr';
import type { BuildProposal } from '@draft/engine';
import { BuildBoard, POPULAR_MAX } from '../champions/BuildBoard';
import { championHash } from '../champions/route';
import { desktopBuilds } from '../desktop';
import { ChampionLink, Portrait, useData } from '../ui';
import type { BuildTarget } from './Build';
import { Splash } from './Cards';

// Onglet Build de la draft : le build de la fiche du champion, adapté aux deux compos, sous un en-tête qui situe le pick.

export const BuildPanel = ({ build, opponent, side }: { build: BuildProposal; opponent: string | null; side: BuildTarget['side'] }) => {
  const { engine } = useData();
  const stats = engine.stats.getRoleStats(build.champion, build.role);
  // Matchup direct : seulement si le matchup est collecté (la fiche n'ouvre pas de build contre un adversaire sans).
  const direct = opponent && desktopBuilds() && stats.matchups?.[opponent] ? opponent : null;
  return (
    <section aria-label={B.region(build.champion)} className="card fit-focus build-panel champ-view">
      <div className="build-title">
        <Splash name={build.champion} />
        <ChampionLink name={build.champion} role={build.role}><Portrait name={build.champion} size={40} /></ChampionLink>
        <span className="col min0">
          <span className="h3">{B.title(build.champion)}</span>
          <span className="small muted">{build.role}{side === 'enemy' ? ' · ' + B.enemy : ''}{opponent ? ' · ' + B.vs(opponent) : ''}</span>
        </span>
        {/* Matchup direct : build contre le vis-à-vis, chargé à la demande (appli desktop). */}
        {direct && (
          <a className="btn btn-sm direct" href={championHash(build.champion, build.role, 'build', direct)} title={CH.directTip}>
            <Portrait name={direct} size={22} />
            <span><span className="muted small">{CH.direct}</span> <span className="strong">{direct}</span></span>
          </a>
        )}
      </div>
      <BuildBoard
        build={build}
        popular={stats.build?.items.slice(0, POPULAR_MAX) ?? []}
        skills={stats.build?.skills}
        ddragonId={engine.catalog.get(build.champion)?.ddragonId ?? ''}
        runes={{}}
      />
    </section>
  );
};
