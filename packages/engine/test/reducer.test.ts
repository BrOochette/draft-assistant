import { describe, expect, it } from 'vitest';
import { computeDraft, createSession, draftReducer, type DraftAction, type DraftSession } from '../src';
import { sampleData, samplePools, sampleState } from './fixtures';

const run = (s: DraftSession, ...actions: DraftAction[]) => actions.reduce(draftReducer, s);
const start = () => createSession(sampleState());

describe('draftReducer', () => {
  it('verrouille un pick, puis annule', () => {
    const s = run(start(), { type: 'select', role: 'Jungle', champion: 'Sejuani' }, { type: 'lock', role: 'Jungle', champion: 'Sejuani' });
    expect(s.draft.ally.Jungle).toBe('Sejuani');
    expect(s.selected.Jungle).toBeUndefined();
    expect(s.toast).toEqual({ code: 'LOCKED', champion: 'Sejuani', role: 'Jungle' });
    expect(computeDraft(s.draft, samplePools(), sampleData()).composition.ally.total).toBe(68);

    const u = draftReducer(s, { type: 'undo' });
    expect(u.draft.ally.Jungle).toBeNull();
    expect(u.toast).toBeNull();
    expect(computeDraft(u.draft, samplePools(), sampleData()).composition.ally.total).toBe(29);
  });

  it('déplace un pick vers un autre rôle : seul le champion change, les joueurs restent, annulable', () => {
    // État d'exemple : Aurora alliée en Top (joueur Alex), Jungle vide (joueur Sam).
    const s0 = start();
    const s = run(s0, { type: 'movePick', from: { side: 'ally', role: 'Top' }, to: { side: 'ally', role: 'Jungle' } });
    expect([s.draft.ally.Top, s.draft.ally.Jungle]).toEqual([null, 'Aurora']);
    expect(s.draft.assign).toEqual(s0.draft.assign);
    expect(s.toast).toEqual({ code: 'MOVED', champion: 'Aurora', side: 'ally', role: 'Jungle' });
    expect(run(s, { type: 'undo' }).draft).toEqual(s0.draft);
  });

  it('déplace un pick allié chez l’ennemi : les deux champions s’échangent, les joueurs restent', () => {
    const s0 = start();
    const s = run(s0, { type: 'movePick', from: { side: 'ally', role: 'Top' }, to: { side: 'enemy', role: 'Top' } });
    expect([s.draft.ally.Top, s.draft.enemy.Top]).toEqual(['Ornn', 'Aurora']);
    expect(s.draft.assign).toEqual(s0.draft.assign);
    // Case vide ou même case : rien ne change.
    expect(run(s0, { type: 'movePick', from: { side: 'ally', role: 'ADC' }, to: { side: 'ally', role: 'Mid' } })).toBe(s0);
    expect(run(s0, { type: 'movePick', from: { side: 'ally', role: 'Top' }, to: { side: 'ally', role: 'Top' } })).toBe(s0);
  });

  it('inverse les picks allié et ennemi d’un rôle, annulable', () => {
    // État d'exemple : Aurora alliée et Ornn ennemi en Top.
    const s = run(start(), { type: 'swapRole', role: 'Top' });
    expect([s.draft.ally.Top, s.draft.enemy.Top]).toEqual(['Ornn', 'Aurora']);
    expect(s.toast).toEqual({ code: 'SWAPPED', role: 'Top' });
    const back = run(s, { type: 'undo' });
    expect([back.draft.ally.Top, back.draft.enemy.Top]).toEqual(['Aurora', 'Ornn']);
    // Rien à échanger : état inchangé.
    const empty = run(start(), { type: 'swapRole', role: 'ADC' });
    expect(empty).toEqual(start());
  });

  it('retirer un pick rouvre le rôle', () => {
    const s = run(start(), { type: 'unlock', role: 'Top' });
    expect(s.draft.ally.Top).toBeNull();
    expect(s.toast).toEqual({ code: 'UNLOCKED', champion: 'Aurora', role: 'Top' });
    const top = computeDraft(s.draft, samplePools(), sampleData()).roles[0]!;
    expect(top.locked).toBeNull();
    expect(top.recommendations.map((e) => e.champion)).toEqual(['Aurora']);
  });

  it('refuse un 6e ban et un ban en double', () => {
    let s = run(start(), { type: 'addBan', side: 'ally', champion: 'Kayn' }, { type: 'addBan', side: 'ally', champion: 'Caitlyn' });
    expect(s.draft.allyBans).toHaveLength(5);
    expect(draftReducer(s, { type: 'addBan', side: 'ally', champion: 'Leona' })).toBe(s);
    expect(draftReducer(s, { type: 'addBan', side: 'enemy', champion: 'Kayn' })).toBe(s);
    s = draftReducer(s, { type: 'removeBan', side: 'ally', champion: 'Kayn' });
    expect(s.draft.allyBans).not.toContain('Kayn');
  });

  it('refuse un pick indisponible', () => {
    const s = start();
    expect(draftReducer(s, { type: 'lock', role: 'Mid', champion: 'Syndra' })).toBe(s);
    expect(draftReducer(s, { type: 'lock', role: 'Mid', champion: 'Ahri' })).toBe(s);
    expect(draftReducer(s, { type: 'setEnemy', role: 'Jungle', champion: 'Brand' })).toBe(s);
  });

  it('un ban retire le champion des recommandations', () => {
    const s = run(start(), { type: 'addBan', side: 'enemy', champion: 'Sejuani' });
    const jungle = computeDraft(s.draft, samplePools(), sampleData()).roles[1]!;
    expect(jungle.recommendations.map((e) => e.champion)).toEqual(['Fiddlesticks', 'Viego', 'Lee Sin']);
  });

  it('un rôle sans joueur classe tous les champions, sans maîtrise', () => {
    const s = run(start(), { type: 'assignPlayer', role: 'Jungle', player: null });
    const jungle = computeDraft(s.draft, samplePools(), sampleData()).roles[1]!;
    expect(jungle.player).toBeNull();
    expect(jungle.hasPool).toBe(false);
    expect(jungle.note).toBe('NO_POOL');
    expect(jungle.outOfPool).toEqual([]);
    expect(jungle.inPool.every((e) => e.pool === 'all' && e.mastery == null)).toBe(true);
    expect(computeDraft(s.draft, samplePools(), sampleData()).team).not.toContainEqual(expect.objectContaining({ role: 'Jungle' }));
  });

  it('remet la draft à zéro et garde le placement des joueurs', () => {
    const s = run(start(), { type: 'assignPlayer', role: 'Mid', player: 'Max' }, { type: 'reset' });
    expect(Object.values(s.draft.ally).every((v) => v === null)).toBe(true);
    expect(s.draft.allyBans).toEqual([]);
    expect(s.draft.assign.Mid).toBe('Max');
    expect(draftReducer(s, { type: 'undo' }).draft.ally.Top).toBe('Aurora');
  });
});
