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

  it('remet la draft à zéro et garde le placement des joueurs', () => {
    const s = run(start(), { type: 'assignPlayer', role: 'Mid', player: 'Max' }, { type: 'reset' });
    expect(Object.values(s.draft.ally).every((v) => v === null)).toBe(true);
    expect(s.draft.allyBans).toEqual([]);
    expect(s.draft.assign.Mid).toBe('Max');
    expect(draftReducer(s, { type: 'undo' }).draft.ally.Top).toBe('Aurora');
  });
});
