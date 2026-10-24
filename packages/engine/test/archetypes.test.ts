import { describe, expect, it } from 'vitest';
import type { Champion } from '@draft/schemas';
import { archetypes } from '../src/read';

const champ = (name: string, cls: string): Champion => ({ name, damage: 'AD', provides: [], scaling: [3, 3, 3], roles: ['Top'], ddragonId: name, classes: [cls] });
const catalog = new Map(
  [champ('Camille', 'Diver'), champ('Lee Sin', 'Diver'), champ('Akali', 'Assassin'), champ('Lux', 'Burst'), champ('Jinx', 'Marksman'), champ('Thresh', 'Catcher')].map((c) => [c.name, c])
);

describe('archétypes de compo', () => {
  it('regroupe par classe principale, à partir de 2 champions', () => {
    expect(archetypes(['Camille', 'Lee Sin', 'Akali', 'Lux', 'Jinx', 'Thresh'], catalog)).toEqual([
      { archetype: 'dive', names: ['Camille', 'Lee Sin', 'Akali'] },
      { archetype: 'pick', names: ['Lux', 'Thresh'] }
    ]);
  });

  it("n'affiche rien sans classe connue ni pour un champion seul", () => {
    expect(archetypes(['Camille', 'Jinx', 'Inconnu'], catalog)).toEqual([]);
  });
});
