import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assembleSampleSnapshot,
  fromSampleDraftState,
  PoolsSchema,
  SampleDraftStateSchema,
  type DraftState,
  type Pools
} from '@draft/schemas';
import { createEngineData, type EngineData } from '../src';

const SAMPLE = fileURLToPath(new URL('../../../data/sample/', import.meta.url));
export const readSample = (name: string): unknown => JSON.parse(readFileSync(SAMPLE + name, 'utf8'));

export const sampleSnapshot = () =>
  assembleSampleSnapshot({
    champions: readSample('champions.json'),
    candidates: readSample('candidates.json'),
    matchupNotes: readSample('matchup-notes.json'),
    banSuggestions: readSample('ban-suggestions.json')
  });

export const sampleData = (): EngineData => createEngineData(sampleSnapshot());
export const samplePools = (): Pools => PoolsSchema.parse(readSample('pools.json'));
export const sampleState = (): DraftState => fromSampleDraftState(SampleDraftStateSchema.parse(readSample('initial-draft-state.json')));
