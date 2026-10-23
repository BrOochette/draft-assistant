import { createEngineData, type EngineData } from '@draft/engine';
import {
  fromSampleDraftState,
  PoolsSchema,
  SampleDraftStateSchema,
  StatsSnapshotSchema,
  type DraftState,
  type Pools,
  type StatsSnapshot
} from '@draft/schemas';
import samplePools from '../../../data/sample/pools.json';
import sampleState from '../../../data/sample/initial-draft-state.json';

export interface AppData {
  snapshot: StatsSnapshot;
  engine: EngineData;
}

/** Charge le snapshot de stats une seule fois au démarrage. Aucun appel réseau ensuite. */
export const loadAppData = async (): Promise<AppData> => {
  const res = await fetch(import.meta.env.BASE_URL + 'data/snapshot.json');
  if (!res.ok) throw new Error('Snapshot introuvable (' + res.status + '). Lancer « npm run ingest -- sample ».');
  const snapshot = StatsSnapshotSchema.parse(await res.json());
  return { snapshot, engine: createEngineData(snapshot) };
};

export const appDataFrom = (snapshot: StatsSnapshot): AppData => ({ snapshot, engine: createEngineData(snapshot) });

export const seedPools = (): Pools => PoolsSchema.parse(samplePools);
export const initialDraft = (): DraftState => fromSampleDraftState(SampleDraftStateSchema.parse(sampleState));
