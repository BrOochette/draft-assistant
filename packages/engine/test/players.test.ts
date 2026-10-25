import { describe, expect, it } from 'vitest';
import { matchPlayers, nameSimilarity, normalizeName, PLAYER_MATCH_MIN } from '../src';

describe('reconnaissance des joueurs par pseudo', () => {
  it('ignore casse, accents, espaces, symboles et lettres décoratives', () => {
    expect(normalizeName('KWΛNGYA CORP')).toBe('kwangyacorp');
    expect(normalizeName('Ptite BrOochette')).toBe('ptitebroochette');
    expect(normalizeName('Démonix 09')).toBe('demonix09');
    expect(normalizeName('Ronflex120pv')).toBe('ronflex120pv');
  });

  it('tolère quelques fautes et un nom contenu dans le pseudo', () => {
    expect(nameSimilarity('Pistache094', 'pistache 094')).toBeGreaterThanOrEqual(PLAYER_MATCH_MIN);
    expect(nameSimilarity('idraxus', 'idraxsu')).toBeGreaterThanOrEqual(PLAYER_MATCH_MIN);
    expect(nameSimilarity('Ptite BrOochette', 'Broochette')).toBeGreaterThanOrEqual(PLAYER_MATCH_MIN);
    expect(nameSimilarity('Rhygord', 'Ronflex120pv')).toBeLessThan(PLAYER_MATCH_MIN);
    // Pseudo trop court : seul un pseudo identique compte.
    expect(nameSimilarity('Al', 'Ali')).toBe(0);
  });

  it('place chaque joueur sur une seule case, les meilleures ressemblances d’abord', () => {
    const players = [{ name: 'Broochette' }, { name: 'Kwangya' }, { name: 'Max', riotId: 'Rhygord#EUW' }];
    const cells = ['KWΛNGYA CORP#EUW', 'Ptite BrOochette#EUW', null, 'Rhygord#EUW', 'aelyo#EUW'];
    expect(matchPlayers(cells, players)).toEqual(['Kwangya', 'Broochette', null, 'Max', null]);
  });

  it('laisse sans joueur une case ambiguë', () => {
    // « Alexo » est à une faute de « Alexa » comme de « Alexi » : aucun des deux n'est choisi.
    expect(matchPlayers(['Alexo#EUW'], [{ name: 'Alexa' }, { name: 'Alexi' }])).toEqual([null]);
    // Contenu dans « Alexis », « Alexi » en est plus proche que de « Alexa » (une faute).
    expect(matchPlayers(['Alexi#EUW'], [{ name: 'Alexa' }, { name: 'Alexis' }])).toEqual(['Alexis']);
  });

  it('un Riot ID identique prime sur un pseudo proche', () => {
    expect(matchPlayers(['Sam#EUW'], [{ name: 'Sam' }, { name: 'Lou', riotId: 'sam#euw' }])).toEqual(['Lou']);
  });
});
