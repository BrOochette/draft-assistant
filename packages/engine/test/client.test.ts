import { describe, expect, it } from 'vitest';
import { emptySlots, type Candidate, type ClientDraft, type DraftState, type Role, type StatsSnapshot } from '@draft/schemas';
import { applyClientDraft, createEngineData, createSession, draftReducer } from '../src';

// Catalogue minimal avec les identifiants Riot : le client ne donne que des numéros.
const CHAMPS: [string, number, Role][] = [
  ['Aatrox', 266, 'Top'],
  ['Darius', 122, 'Top'],
  ['Lee Sin', 64, 'Jungle'],
  ['Vi', 254, 'Jungle'],
  ['Ahri', 103, 'Mid'],
  ['Orianna', 61, 'Mid'],
  ['Jinx', 222, 'ADC'],
  ['Caitlyn', 51, 'ADC'],
  ['Thresh', 412, 'Support'],
  ['Leona', 89, 'Support'],
  ['Lux', 99, 'Support']
];
const KEY = Object.fromEntries(CHAMPS.map(([n, k]) => [n, k])) as Record<string, number>;

const cand = (name: string, laneShare: number): Candidate => ({
  name, games: 10000, synergyBase: 55, laneWinRate: null, gameWinRate: 50, scaling: [3, 3, 3], provides: [], damage: 'AD', notes: [], laneShare
});

const snapshot: StatsSnapshot = {
  version: 1,
  source: 'lolalytics',
  patch: '16.21',
  rank: 'Emerald+',
  ddragonVersion: '16.21.1',
  champions: CHAMPS.map(([name, key, role]) => ({ name, key, damage: 'AD', provides: [], scaling: [3, 3, 3], roles: [role], ddragonId: name })),
  candidates: {
    Top: [cand('Aatrox', 90), cand('Darius', 95)],
    Jungle: [cand('Lee Sin', 95), cand('Vi', 98)],
    // Lux se joue surtout Support, puis Mid.
    Mid: [cand('Ahri', 95), cand('Orianna', 97), cand('Lux', 35)],
    ADC: [cand('Jinx', 98), cand('Caitlyn', 97)],
    Support: [cand('Thresh', 99), cand('Leona', 99), cand('Lux', 60)]
  },
  matchupNotes: { matchups: {}, fixedInfo: {} },
  banSuggestions: []
};
const data = createEngineData(snapshot);

const empty = (): DraftState => ({
  assign: { Top: null, Jungle: null, Mid: null, ADC: null, Support: null },
  ally: emptySlots(),
  enemy: emptySlots(),
  allyBans: [],
  enemyBans: []
});

type AllyCell = ClientDraft['ally'][number];
const ally = (cell: number, position: Role | null, champion?: string, extra: Partial<AllyCell> = {}): AllyCell => ({
  cell, position, champion: champion ? KEY[champion]! : null, picking: false, hover: null, riotId: null, local: false, ...extra
});
const foe = (cell: number, champion?: string, picking = false) => ({ cell: cell + 5, position: null, champion: champion ? KEY[champion]! : null, picking });
const client = (over: Partial<ClientDraft>): ClientDraft => ({ gameId: 1, phase: 'banPick', bansPending: false, side: null, ally: [], enemy: [], allyBans: [], enemyBans: [], ...over });

describe('lecture du client', () => {
  it('place les picks alliés sur le rôle attribué par le client et convertit les bans', () => {
    const { draft } = applyClientDraft(
      empty(),
      client({ ally: [ally(0, 'Top', 'Aatrox'), ally(1, 'Support', 'Lux')], allyBans: [KEY.Jinx!], enemyBans: [KEY.Thresh!, KEY.Thresh!] }),
      data, [], true
    );
    expect(draft.ally).toMatchObject({ Top: 'Aatrox', Support: 'Lux', Mid: null });
    expect(draft.allyBans).toEqual(['Jinx']);
    expect(draft.enemyBans).toEqual(['Thresh']);
  });

  it('place un ennemi sur son rôle le plus joué encore libre, et garde une correction à la main', () => {
    let { draft } = applyClientDraft(empty(), client({ enemy: [foe(0, 'Leona'), foe(1, 'Lux')] }), data, [], true);
    // Leona prend Support, Lux va sur son rôle suivant.
    expect(draft.enemy).toMatchObject({ Support: 'Leona', Mid: 'Lux' });
    // Correction à la main : Lux en Support, Leona retirée. Au message suivant, Lux reste en Support et Leona revient.
    draft = { ...draft, enemy: { ...emptySlots(), Support: 'Lux' } };
    ({ draft } = applyClientDraft(draft, client({ enemy: [foe(0, 'Leona'), foe(1, 'Lux')] }), data, [], false));
    // Leona ne joue que Support : elle prend le premier rôle libre.
    expect(draft.enemy).toMatchObject({ Support: 'Lux', Top: 'Leona' });
    expect(Object.values(draft.enemy).filter(Boolean).sort()).toEqual(['Leona', 'Lux']);
  });

  it('garde une saisie à la main sur un rôle sans pick du client, sauf si le champion est banni ou pris', () => {
    const start = { ...empty(), ally: { ...emptySlots(), Mid: 'Ahri', Jungle: 'Vi' } };
    const { draft } = applyClientDraft(start, client({ ally: [ally(0, 'Top', 'Aatrox')], enemy: [foe(0, 'Vi')] }), data, [], false);
    expect(draft.ally).toMatchObject({ Top: 'Aatrox', Mid: 'Ahri', Jungle: null });
  });

  it('repart de zéro sur une nouvelle sélection, placement des joueurs compris', () => {
    const start = { ...empty(), assign: { ...empty().assign, Mid: 'Alex' }, ally: { ...emptySlots(), Mid: 'Ahri' }, allyBans: ['Zed'] };
    const { draft } = applyClientDraft(start, client({}), data, [], true);
    expect(draft.ally.Mid).toBeNull();
    expect(draft.allyBans).toEqual([]);
    expect(draft.assign.Mid).toBe('Alex');
  });

  it('affiche les survols alliés sans les compter comme des picks', () => {
    const { draft, hover } = applyClientDraft(
      empty(),
      client({ ally: [ally(0, 'Mid', undefined, { hover: KEY.Orianna! }), ally(1, 'ADC', 'Jinx', { hover: KEY.Caitlyn! })], enemyBans: [KEY.Ahri!] }),
      data, [], true
    );
    expect(draft.ally.Mid).toBeNull();
    expect(hover).toEqual({ Mid: 'Orianna' });
  });

  it('place les joueurs reconnus par leur Riot ID, sans tenir compte de la casse', () => {
    const start = { ...empty(), assign: { ...empty().assign, Top: 'Alex', Mid: 'Sam' } };
    const { draft } = applyClientDraft(
      start,
      client({ ally: [ally(0, 'Mid', undefined, { riotId: 'alex#EUW', local: true }), ally(1, 'Top', undefined, { riotId: null })] }),
      data, [{ name: 'Alex', riotId: 'Alex#euw ' }, { name: 'Sam', riotId: 'Sam#EUW' }], false
    );
    expect(draft.assign).toMatchObject({ Mid: 'Alex', Top: null });
  });

  it('donne le rôle du joueur connecté au client, null sans case locale', () => {
    const local = applyClientDraft(empty(), client({ ally: [ally(0, 'Top'), ally(1, 'Mid', undefined, { local: true })] }), data, [], false);
    expect(local.localRole).toBe('Mid');
    expect(applyClientDraft(empty(), client({ ally: [ally(0, 'Top')] }), data, [], false).localRole).toBeNull();
  });

  it("donne l'ordre des cases du client, avec les rôles déduits des picks", () => {
    const { order } = applyClientDraft(
      empty(),
      client({
        ally: [ally(0, 'Support'), ally(1, 'Mid'), ally(2, 'Top'), ally(3, 'ADC'), ally(4, 'Jungle')],
        // Ennemis : Jinx (ADC) en première case, Leona (Support) en troisième, les autres inconnus.
        enemy: [foe(0, 'Jinx'), foe(1), foe(2, 'Leona'), foe(3), foe(4)]
      }),
      data, [], true
    );
    expect(order.ally).toEqual(['Support', 'Mid', 'Top', 'ADC', 'Jungle']);
    expect(order.enemy).toEqual(['ADC', 'Top', 'Support', 'Jungle', 'Mid']);
  });

  it('donne les rôles en train de choisir et le side', () => {
    const { picking, side } = applyClientDraft(
      empty(),
      client({
        side: 'red',
        ally: [ally(0, 'Support'), ally(1, 'Mid', undefined, { picking: true }), ally(2, 'Top'), ally(3, 'ADC'), ally(4, 'Jungle')],
        enemy: [foe(0, 'Jinx'), foe(1, undefined, true), foe(2), foe(3), foe(4)]
      }),
      data, [], true
    );
    expect(picking).toEqual({ ally: ['Mid'], enemy: ['Top'] });
    expect(side).toBe('red');
  });

  it('suit un échange de rôles et un échange d’ordre de pick pendant la draft', () => {
    const players = [{ name: 'Alex', riotId: 'Alex#EUW' }, { name: 'Sam', riotId: 'Sam#EUW' }];
    // Départ : Alex en Top (Aatrox verrouillé) dans la première case, Sam en Mid dans la deuxième.
    let sync = applyClientDraft(
      empty(),
      client({ ally: [ally(0, 'Top', 'Aatrox', { riotId: 'Alex#EUW' }), ally(1, 'Mid', undefined, { riotId: 'Sam#EUW' })] }),
      data, players, true
    );
    expect(sync.draft.ally.Top).toBe('Aatrox');
    expect(sync.draft.assign).toMatchObject({ Top: 'Alex', Mid: 'Sam' });
    // Échange de rôles : le client attribue Mid à Alex et Top à Sam ; son champion suit.
    sync = applyClientDraft(
      sync.draft,
      client({ ally: [ally(0, 'Mid', 'Aatrox', { riotId: 'Alex#EUW' }), ally(1, 'Top', undefined, { riotId: 'Sam#EUW' })] }),
      data, players, false
    );
    expect(sync.draft.ally).toMatchObject({ Mid: 'Aatrox', Top: null });
    expect(sync.draft.assign).toMatchObject({ Mid: 'Alex', Top: 'Sam' });
    expect(sync.order.ally.slice(0, 2)).toEqual(['Mid', 'Top']);
    // Échange d'ordre de pick : les deux joueurs changent de case, l'ordre affiché suit les cases.
    sync = applyClientDraft(
      sync.draft,
      client({ ally: [ally(0, 'Top', undefined, { riotId: 'Sam#EUW' }), ally(1, 'Mid', 'Aatrox', { riotId: 'Alex#EUW' })] }),
      data, players, false
    );
    expect(sync.order.ally.slice(0, 2)).toEqual(['Top', 'Mid']);
    expect(sync.draft.assign).toMatchObject({ Top: 'Sam', Mid: 'Alex' });
    expect(sync.draft.ally).toMatchObject({ Mid: 'Aatrox', Top: null });
  });

  it('le réducteur remplace la draft et retire les présélections des rôles verrouillés', () => {
    let s = createSession(empty());
    s = draftReducer(s, { type: 'select', role: 'Top', champion: 'Darius' });
    s = draftReducer(s, { type: 'select', role: 'Mid', champion: 'Ahri' });
    const sync = applyClientDraft(s.draft, client({ ally: [ally(0, 'Top', 'Aatrox')] }), data, [], true);
    s = draftReducer(s, { type: 'syncClient', ...sync });
    expect(s.draft.ally.Top).toBe('Aatrox');
    expect(s.selected).toEqual({ Mid: 'Ahri' });
    expect(s.history).toEqual([]);
  });
});
