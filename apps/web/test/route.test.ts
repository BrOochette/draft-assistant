import { describe, expect, it } from 'vitest';
import { championHash, goBack, LIST_HASH, noteNavigation, originOf, parseChampionHash } from '../src/champions/route';

describe('adresses de l’écran Champions', () => {
  it('fiche : champion, rôle, onglet et adversaire relus à l’identique', () => {
    expect(parseChampionHash(championHash('Nunu & Willump', 'Jungle', 'build', "Kai'Sa"))).toEqual({
      champion: 'Nunu & Willump',
      role: 'Jungle',
      tab: 'build',
      opponent: "Kai'Sa"
    });
    expect(parseChampionHash(championHash('Aatrox'))).toEqual({ champion: 'Aatrox', role: null, tab: 'build', opponent: null });
    expect(parseChampionHash('#/champions')).toBeNull();
  });

  it('adresse mal formée : liste, sans erreur', () => {
    expect(parseChampionHash('#/champions/%E0/Top')).toBeNull();
  });

  it('retour d’une fiche : page d’origine, inchangée par les onglets et par le retour lui-même', () => {
    const go = (to: string) => {
      noteNavigation(location.hash, to);
      location.hash = to;
    };
    location.hash = '#/';
    expect(originOf('Garen')).toBe(LIST_HASH);
    go(championHash('Garen', 'Top'));
    go(championHash('Garen', 'Top', 'matchups'));
    go(championHash('Darius', 'Top'));
    expect(originOf('Darius')).toBe(championHash('Garen', 'Top', 'matchups'));
    goBack('Darius');
    noteNavigation(championHash('Darius', 'Top'), location.hash);
    expect(location.hash).toBe(championHash('Garen', 'Top', 'matchups'));
    expect(originOf('Garen')).toBe('#/');
  });
});
