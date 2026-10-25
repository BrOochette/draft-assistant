import { describe, expect, it } from 'vitest';
import { parseCommandLine, parseLockfile } from '../src/credentials';
import { riotIdOfSummoner, toClientDraft } from '../src/lcu';
import { isAllowedOrigin } from '../src/origin';

describe('accès au client', () => {
  it('lit le lockfile', () => {
    expect(parseLockfile('LeagueClient:1234:61234:abc-DEF_1:https\n')).toEqual({ port: 61234, password: 'abc-DEF_1' });
    expect(parseLockfile('')).toBeNull();
  });

  it('lit la ligne de commande de League sans confondre les options du client Riot', () => {
    const cmd = '"D:/Riot Games/League of Legends/LeagueClientUx.exe" "--riotclient-auth-token=RIOT" "--riotclient-app-port=50961" "--app-port=61234" "--remoting-auth-token=LEAGUE_tok-1"';
    expect(parseCommandLine(cmd)).toEqual({ port: 61234, password: 'LEAGUE_tok-1' });
    expect(parseCommandLine('"--riotclient-app-port=50961" "--riotclient-auth-token=RIOT"')).toBeNull();
  });

  it("n'accepte que l'appli", () => {
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
    expect(isAllowedOrigin('https://draft-assistant.thomas.workers.dev')).toBe(true);
    expect(isAllowedOrigin('https://evil.example.com')).toBe(false);
    expect(isAllowedOrigin('https://draft-assistant.thomas.workers.dev.evil.com')).toBe(false);
    expect(isAllowedOrigin(undefined)).toBe(false);
  });
});

// Extrait d'une session de draft classée : moi Mid (cellule 2), un allié Top verrouillé, un ennemi verrouillé.
const session = {
  gameId: 7001,
  localPlayerCellId: 2,
  timer: { phase: 'BAN_PICK' },
  myTeam: [
    { cellId: 0, championId: 266, championPickIntent: 0, assignedPosition: 'top', gameName: '', tagLine: '', nameVisibilityType: 'HIDDEN' },
    { cellId: 1, championId: 0, championPickIntent: 64, assignedPosition: 'jungle', nameVisibilityType: 'HIDDEN' },
    { cellId: 2, championId: 103, championPickIntent: 0, assignedPosition: 'middle', gameName: '', tagLine: '' },
    { cellId: 3, championId: 0, championPickIntent: 0, assignedPosition: 'bottom', gameName: 'Duo', tagLine: 'EUW', nameVisibilityType: 'VISIBLE' },
    { cellId: 4, championId: 0, championPickIntent: 0, assignedPosition: 'utility' }
  ],
  theirTeam: [
    { cellId: 5, championId: 122, assignedPosition: '' },
    { cellId: 6, championId: 0, assignedPosition: '' }
  ],
  actions: [
    [
      { actorCellId: 0, championId: 238, type: 'ban', completed: true, isAllyAction: true },
      { actorCellId: 5, championId: 222, type: 'ban', completed: true, isAllyAction: false },
      { actorCellId: 6, championId: 0, type: 'ban', completed: true, isAllyAction: false }
    ],
    [{ actorCellId: 0, championId: 266, type: 'pick', completed: true, isInProgress: false, isAllyAction: true }],
    [{ actorCellId: 5, championId: 122, type: 'pick', completed: true, isInProgress: false, isAllyAction: false }],
    // Mon tour : Ahri survolée, pas encore verrouillée.
    [{ actorCellId: 2, championId: 103, type: 'pick', completed: false, isInProgress: true, isAllyAction: true }]
  ],
  bans: { myTeamBans: [238], theirTeamBans: [222] },
  unknownField: { ignored: true }
};

describe('session du client', () => {
  it('distingue picks verrouillés et survols, et lit rôles, bans et Riot ID', () => {
    const d = toClientDraft(session, 'Moi#EUW');
    expect(d.gameId).toBe(7001);
    expect(d.phase).toBe('banPick');
    expect(d.bansPending).toBe(false);
    // Cases 0 à 4 : side bleu. Mon pick (Ahri) est en cours.
    expect(d.side).toBe('blue');
    expect(d.ally.map((c) => c.picking)).toEqual([false, false, true, false, false]);
    expect(d.enemy.map((c) => c.picking)).toEqual([false, false]);
    expect(d.ally.map((c) => [c.position, c.champion, c.hover])).toEqual([
      ['Top', 266, null],
      ['Jungle', null, 64],
      ['Mid', null, 103],
      ['ADC', null, null],
      ['Support', null, null]
    ]);
    expect(d.ally.map((c) => c.riotId)).toEqual([null, null, 'Moi#EUW', 'Duo#EUW', null]);
    expect(d.ally[2]!.local).toBe(true);
    expect(d.enemy.map((c) => c.champion)).toEqual([122, null]);
    expect(d.allyBans).toEqual([238]);
    expect(d.enemyBans).toEqual([222]);
  });

  it('lit le side rouge (champ team, sinon numéros de case 5 à 9)', () => {
    const red = { ...session, myTeam: session.myTeam.map((c) => ({ ...c, cellId: c.cellId + 5 })), localPlayerCellId: 7 };
    expect(toClientDraft(red, null).side).toBe('red');
    const withTeam = { ...session, myTeam: session.myTeam.map((c) => ({ ...c, team: 2 })) };
    expect(toClientDraft(withTeam, null).side).toBe('red');
  });

  it('signale les bans encore attendus', () => {
    const banning = { ...session, actions: [[{ actorCellId: 2, championId: 0, type: 'ban', completed: false, isInProgress: true, isAllyAction: true }]] };
    expect(toClientDraft(banning, null).bansPending).toBe(true);
  });

  it('prend le champion de la case après un échange entre alliés', () => {
    const traded = { ...session, myTeam: session.myTeam.map((c) => (c.cellId === 0 ? { ...c, championId: 99 } : c)) };
    expect(toClientDraft(traded, null).ally[0]!.champion).toBe(99);
  });

  it('lit le Riot ID du joueur local', () => {
    expect(riotIdOfSummoner({ gameName: 'Moi', tagLine: 'EUW', puuid: 'x' })).toBe('Moi#EUW');
    expect(riotIdOfSummoner(null)).toBeNull();
  });
});
