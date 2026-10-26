import { describe, expect, it } from 'vitest';
import type { Candidate, DraftState, Role, StatsSnapshot, Trait } from '@draft/schemas';
import { computeDraft, createEngineData, FIT_BONUS, POINTS_PER_WR, teamVerdictOf, pointsOfWr, REDUNDANCY_POINTS, roleAverage } from '../src';

// Stats au format Lolalytics avec des traits : quatre porteurs de frontline et d'engage, un mage sans trait.
const tank = (name: string, role: Role) => ({ name, damage: 'TANK' as const, provides: ['Frontline', 'Engage'] as Trait[], scaling: [3, 3, 3] as [3, 3, 3], roles: [role], ddragonId: name });
const cand = (name: string, extra: Partial<Candidate> = {}): Candidate => ({
  name,
  games: 10000,
  synergyBase: 55,
  laneWinRate: null,
  gameWinRate: 50,
  scaling: [3, 3, 3],
  provides: ['Frontline', 'Engage'],
  damage: 'TANK',
  notes: [],
  ...extra
});

const snapshot: StatsSnapshot = {
  version: 1,
  source: 'lolalytics',
  patch: '16.21',
  rank: 'Emerald+',
  ddragonVersion: '16.21.1',
  champions: [
    tank('Malphite', 'Top'),
    tank('Sejuani', 'Jungle'),
    tank('Galio', 'Mid'),
    { name: 'Ahri', damage: 'AP', provides: [], scaling: [3, 3, 3], roles: ['Mid'], ddragonId: 'Ahri' },
    // Spécialiste à dégâts soutenus, corrigé à la main.
    { name: 'Azir', damage: 'AP', provides: [], scaling: [3, 3, 3], roles: ['Mid'], ddragonId: 'Azir', classes: ['Specialist'], sustained: true },
    tank('Leona', 'Support'),
    ...(['Darius', 'Lee Sin', 'Jinx'] as const).map((name, i) => ({ name, damage: 'AD' as const, provides: ['Physique'] as Trait[], scaling: [3, 3, 3] as [3, 3, 3], roles: [(['Top', 'Jungle', 'ADC'] as const)[i]!], ddragonId: name, ...(name === 'Jinx' && { classes: ['Marksman'] }) }))
  ],
  candidates: {
    Top: [cand('Malphite'), cand('Darius', { provides: ['Physique'], damage: 'AD' })],
    Jungle: [cand('Sejuani'), cand('Lee Sin', { provides: ['Physique'], damage: 'AD' })],
    ADC: [cand('Jinx', { provides: ['Physique'], damage: 'AD' })],
    Mid: [cand('Galio'), cand('Ahri', { gameWinRate: 52, provides: [], damage: 'AP' }), cand('Azir', { provides: [], damage: 'AP' })],
    Support: [cand('Leona')]
  },
  matchupNotes: { matchups: {}, fixedInfo: {} },
  banSuggestions: []
};
const data = createEngineData(snapshot);
const empty: DraftState = {
  assign: { Top: null, Jungle: null, Mid: null, ADC: null, Support: null },
  ally: { Top: null, Jungle: null, Mid: null, ADC: null, Support: null },
  enemy: { Top: null, Jungle: null, Mid: null, ADC: null, Support: null },
  allyBans: [],
  enemyBans: []
};
const withAlly = (picks: Partial<DraftState['ally']>): DraftState => ({ ...empty, ally: { ...empty.ally, ...picks } });
const evalOf = (state: DraftState, role: Role, name: string) => {
  const r = computeDraft(state, {}, data).roles.find((x) => x.role === role)!;
  return r.locked?.champion === name ? r.locked : [...r.inPool, ...r.outOfPool].find((e) => e.champion === name)!;
};

describe('redondance des traits', () => {
  it('premier porteur : bonus de trait', () => {
    const e = evalOf(empty, 'Top', 'Malphite');
    expect(e.points.parts!.fit).toBe(FIT_BONUS.Frontline + FIT_BONUS.Engage);
    expect(e.reasons.filter((r) => r.code === 'PROVIDES')).toHaveLength(2);
  });

  it('deux tanks ou deux engages ne sont pas un malus', () => {
    const e = evalOf(withAlly({ Top: 'Malphite' }), 'Jungle', 'Sejuani');
    expect(e.points.parts!.fit).toBe(0);
    expect(e.reasons.some((r) => r.code === 'REDUNDANT' || r.code === 'PROVIDES')).toBe(false);
  });

  it('le 3e porteur prend un malus par trait, avec les porteurs déjà là', () => {
    const e = evalOf(withAlly({ Top: 'Malphite', Jungle: 'Sejuani' }), 'Mid', 'Galio');
    expect(e.points.parts!.fit).toBe(-2 * REDUNDANCY_POINTS);
    expect(e.reasons).toContainEqual({ sign: '-', code: 'REDUNDANT', trait: 'Frontline', n: 3, by: ['Malphite', 'Sejuani'] });
  });

  it('le malus croît avec le rang : le 4e porteur prend le double', () => {
    const e = evalOf(withAlly({ Top: 'Malphite', Jungle: 'Sejuani', Mid: 'Galio' }), 'Support', 'Leona');
    expect(e.points.parts!.fit).toBe(-4 * REDUNDANCY_POINTS);
    expect(e.reasons.find((r) => r.code === 'REDUNDANT')).toMatchObject({ n: 4 });
  });

  it('plusieurs sources de dégâts physiques ne coûtent rien (une compo à un seul AP est courante)', () => {
    const e = evalOf(withAlly({ Top: 'Darius', Jungle: 'Lee Sin' }), 'ADC', 'Jinx');
    expect(e.points.parts!.fit).toBe(0);
    expect(e.reasons.some((r) => r.code === 'REDUNDANT')).toBe(false);
  });
});

describe('dégâts soutenus face à la frontline', () => {
  const state: DraftState = { ...withAlly({ Top: 'Darius', Jungle: 'Lee Sin', Mid: 'Ahri' }), enemy: { ...empty.enemy, Top: 'Malphite' } };

  it('bonus au pick qui en apporte quand ta compo n’en a pas', () => {
    const e = evalOf(state, 'ADC', 'Jinx');
    expect(e.reasons).toContainEqual({ sign: '+', code: 'SUSTAINED', against: ['Malphite'] });
  });

  it('malus aux derniers picks qui n’en apportent pas, rien avant', () => {
    expect(evalOf(state, 'Support', 'Leona').reasons).toContainEqual({ sign: '-', code: 'NO_SUSTAINED', against: ['Malphite'] });
    const early = { ...state, ally: { ...empty.ally, Top: 'Darius' } };
    expect(evalOf(early, 'Support', 'Leona').reasons.some((r) => r.code === 'NO_SUSTAINED')).toBe(false);
  });

  it('une correction manuelle compte comme dégâts soutenus, quelle que soit la classe', () => {
    const s = { ...state, ally: { ...state.ally, Mid: null } };
    expect(evalOf(s, 'Mid', 'Azir').reasons).toContainEqual({ sign: '+', code: 'SUSTAINED', against: ['Malphite'] });
  });

  it('rien sans frontline ennemie, ou quand ta compo en a déjà', () => {
    expect(evalOf(withAlly({ Top: 'Darius', Jungle: 'Lee Sin', Mid: 'Ahri' }), 'Support', 'Leona').reasons.some((r) => r.code === 'NO_SUSTAINED')).toBe(false);
    const withJinx = { ...state, ally: { ...state.ally, ADC: 'Jinx' } };
    expect(evalOf(withJinx, 'Support', 'Leona').reasons.some((r) => r.code === 'NO_SUSTAINED')).toBe(false);
  });

  it('la lecture de ta compo le signale dès 3 picks', () => {
    expect(computeDraft(state, {}, data).allyRead).toContainEqual({ sign: '-', code: 'NO_SUSTAINED', against: ['Malphite'] });
  });
});

describe('note sur 20', () => {
  it('10 à 50 %, 2 points par point de win rate, plus l’apport à la compo', () => {
    const e = evalOf(empty, 'Mid', 'Ahri');
    const p = e.points.parts!;
    expect(p.base).toBeCloseTo(10 + (e.expected!.base - 50) * POINTS_PER_WR);
    expect(p.fit).toBe(0);
    expect(e.points.value).toBeCloseTo(p.base + p.matchups + p.duos + p.mastery + p.fit);
  });

  it('notes d’équipe sur 100 : cumul des picks connus, 0 sans pick', () => {
    const r = computeDraft(empty, {}, data);
    expect(r.composition.ally.total).toBe(0);
    expect(r.composition.enemy.total).toBe(0);
  });

  it('un pick verrouillé compte avec sa note ; le verdict juge la projection avec la moyenne des autres rôles', () => {
    const r = computeDraft(withAlly({ Mid: 'Ahri', Top: 'Malphite' }), {}, data);
    const picks = r.roles[0]!.locked!.points.value + r.roles[2]!.locked!.points.value;
    expect(r.composition.ally.total).toBe(Math.round(picks));
    const others = (['Jungle', 'ADC', 'Support'] as const).reduce((s, role) => s + pointsOfWr(roleAverage(data, role) ?? 50), 0);
    expect(r.composition.ally.verdict).toBe(teamVerdictOf(picks + others));
  });
});

