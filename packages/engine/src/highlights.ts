import type { Evaluation, TeamHighlights } from './types';

/**
 * Faits marquants d'une équipe, d'après l'évaluation de ses picks connus : meilleur et pire matchup (effet pondéré d'un
 * ennemi sur un pick), meilleur et pire duo (effet pondéré d'un allié), pick le plus fort et le plus faible (note sur
 * 20). Un pire n'est donné que s'il diffère du meilleur ; le pick le plus faible, à partir de deux picks.
 */
export const teamHighlights = (picks: readonly Evaluation[]): TeamHighlights => {
  const matchups = picks.flatMap((e) => e.enemyTeam.map((m) => ({ champion: e.champion, other: m.opponent, effect: m.delta * m.weight })));
  const duos = picks.flatMap((e) => e.allyTeam.map((d) => ({ champion: e.champion, other: d.ally, effect: d.delta * d.weight })));
  const extremes = <T extends { effect: number }>(list: T[]) => {
    if (!list.length) return { best: null, worst: null };
    const sorted = [...list].sort((a, b) => b.effect - a.effect);
    const best = sorted[0]!;
    const worst = sorted[sorted.length - 1]!;
    return { best, worst: worst === best ? null : worst };
  };
  const m = extremes(matchups);
  const d = extremes(duos);
  const byPoints = [...picks].sort((a, b) => b.points.value - a.points.value);
  const strongest = byPoints[0];
  const weakest = byPoints.length >= 2 ? byPoints[byPoints.length - 1] : undefined;
  return {
    bestMatchup: m.best,
    worstMatchup: m.worst,
    bestDuo: d.best,
    worstDuo: d.worst,
    strongest: strongest ? { champion: strongest.champion, points: strongest.points.value } : null,
    weakest: weakest ? { champion: weakest.champion, points: weakest.points.value } : null
  };
};
