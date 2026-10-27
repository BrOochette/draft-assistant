import { describe, expect, it } from 'vitest';
import { teamHighlights, type Evaluation } from '../src';

// Évaluations réduites aux champs lus : effets des ennemis et des alliés, note sur 20.
const pick = (champion: string, points: number, enemies: [string, number, number][], allies: [string, number, number][]) =>
  ({
    champion,
    points: { value: points, raw: points, parts: null },
    enemyTeam: enemies.map(([opponent, delta, weight]) => ({ opponent, delta, weight })),
    allyTeam: allies.map(([ally, delta, weight]) => ({ ally, delta, weight }))
  }) as unknown as Evaluation;

describe('faits marquants d’une équipe', () => {
  it('meilleur et pire matchup et duo (effet pondéré), pick le plus fort et le plus faible', () => {
    const h = teamHighlights([
      pick('Talon', 16.7, [['Galio', 4, 1], ['Nilah', 2, 0.25]], [['Sivir', 1.2, 0.5]]),
      pick('Malphite', 15.4, [['Cassiopeia', -1.5, 1]], [['Sejuani', 3, 0.5]]),
      pick('Sivir', 19.6, [['Nilah', 1, 1]], [['Thresh', 3.8, 1]])
    ]);
    expect(h.bestMatchup).toEqual({ champion: 'Talon', other: 'Galio', effect: 4 });
    expect(h.worstMatchup).toEqual({ champion: 'Malphite', other: 'Cassiopeia', effect: -1.5 });
    expect(h.bestDuo).toEqual({ champion: 'Sivir', other: 'Thresh', effect: 3.8 });
    expect(h.worstDuo).toEqual({ champion: 'Talon', other: 'Sivir', effect: 0.6 });
    expect(h.strongest).toEqual({ champion: 'Sivir', points: 19.6 });
    expect(h.weakest).toEqual({ champion: 'Malphite', points: 15.4 });
  });

  it('un seul pick : pas de pire ni de plus faible ; aucun pick : rien', () => {
    const one = teamHighlights([pick('Talon', 16, [['Galio', 4, 1]], [])]);
    expect([one.worstMatchup, one.bestDuo, one.weakest]).toEqual([null, null, null]);
    expect(teamHighlights([]).strongest).toBeNull();
  });
});
