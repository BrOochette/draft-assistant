import { describe, expect, it } from 'vitest';
import type { DraftState } from '@draft/schemas';
import {
  CRITERION_LABEL,
  fmt1,
  fmtDelta,
  formatReason,
  phaseTitle,
  POOL_TAG,
  recNoteText,
  SCALING_VERDICT_LABEL,
  VERDICT_LABEL
} from '@draft/i18n-fr';
import { computeDraft, type DraftResult, type Evaluation } from '../src';
import { readSample, sampleData, samplePools, sampleState } from './fixtures';

const golden = readSample('golden-scenarios.json') as any[];
const data = sampleData();
const pools = samplePools();

const withAlly = (s: DraftState, picks: Partial<DraftState['ally']>): DraftState => ({ ...s, ally: { ...s.ally, ...picks } });

const states: DraftState[] = [
  sampleState(),
  withAlly(sampleState(), { Jungle: 'Sejuani' }),
  withAlly(sampleState(), { Jungle: 'Sejuani', Mid: 'Orianna', ADC: 'Ashe' }),
  { ...sampleState(), assign: { ...sampleState().assign, Mid: 'Max' } }
];

const mastery = (e: Evaluation) => (e.mastery == null ? 'n/a' : e.mastery);

/** Met le résultat du moteur au format de golden-scenarios.json (textes de la maquette). */
const toGolden = (r: DraftResult) => ({
  composition: {
    ally: r.composition.ally.total,
    verdict: VERDICT_LABEL[r.composition.ally.verdict],
    criteria: r.composition.ally.criteria.map((c) => ({ label: CRITERION_LABEL[c.key], value: c.value })),
    enemy: r.composition.enemy.total,
    enemyVerdict: VERDICT_LABEL[r.composition.enemy.verdict]
  },
  roles: r.roles.map((role) => ({
    role: role.role,
    player: role.player,
    locked: role.locked ? { champion: role.locked.champion, score: role.locked.total, compoDelta: fmtDelta(role.locked.compoDelta) } : null,
    recommendations: role.recommendations.map((e, i) => ({
      rank: i + 1,
      champion: e.champion,
      score: e.total,
      compoDelta: fmtDelta(e.compoDelta),
      synergy: e.synergy,
      counter: e.counter,
      mastery: mastery(e),
      lowSample: e.lowSample
    })),
    details: [...role.inPool, ...role.outOfPool].map((e) => ({
      champion: e.champion,
      tag: POOL_TAG[e.pool],
      score: e.total,
      reasons: e.reasons.slice(0, 3).map(formatReason)
    }))
  })),
  scaling: r.scaling.map((p) => ({
    phase: phaseTitle(p.phase),
    ally: fmt1(p.ally),
    enemy: fmt1(p.enemy),
    verdict: SCALING_VERDICT_LABEL[p.verdict]
  }))
});

describe('scénarios de référence de la maquette', () => {
  for (let i = 0; i < 3; i++) {
    it(golden[i].scenario, () => {
      const { scenario: _, ...expected } = golden[i];
      expect(toGolden(computeDraft(states[i]!, pools, data))).toEqual(expected);
    });
  }

  it(golden[3].scenario, () => {
    const expected = golden[3].roles[0];
    const mid = computeDraft(states[3]!, pools, data).roles.find((r) => r.role === 'Mid')!;
    expect(recNoteText(mid.note!, mid.player!, mid.role)).toBe(expected.note);
    expect(mid.recommendations.map((e) => ({ champion: e.champion, score: e.total, mastery: mastery(e) }))).toEqual(expected.recommendations);
  });
});
