import { createEngineData, type EngineData } from '@draft/engine';
import { APP_TEXT } from '@draft/i18n-fr';
import {
  BuildCatalogSchema,
  fromSampleDraftState,
  PoolsSchema,
  SampleDraftStateSchema,
  StatsSnapshotSchema,
  type BuildCatalog,
  type DraftState,
  type Pools,
  type StatsSnapshot
} from '@draft/schemas';
import samplePools from '../../../data/sample/pools.json';
import sampleState from '../../../data/sample/initial-draft-state.json';

export interface AppData {
  snapshot: StatsSnapshot;
  engine: EngineData;
  /** Objets, runes et sorts des builds ; null s'il manque (le build n'est pas affiché). */
  buildCatalog: BuildCatalog | null;
}

/** Charge le snapshot de stats une seule fois au démarrage. Aucun appel réseau ensuite. */
export const loadAppData = async (): Promise<AppData> => {
  const res = await fetch(import.meta.env.BASE_URL + 'data/snapshot.json');
  if (!res.ok) throw new Error(APP_TEXT.snapshotMissing(res.status));
  const snapshot = StatsSnapshotSchema.parse(await res.json());
  const catalog = await fetch(import.meta.env.BASE_URL + 'data/build-catalog.json').then(
    async (r) => (r.ok ? BuildCatalogSchema.safeParse(await r.json()) : null),
    () => null
  );
  return { snapshot, engine: createEngineData(snapshot), buildCatalog: catalog?.success ? catalog.data : null };
};

export const appDataFrom = (snapshot: StatsSnapshot, buildCatalog: BuildCatalog | null = null): AppData => ({ snapshot, engine: createEngineData(snapshot), buildCatalog });

export const seedPools = (): Pools => PoolsSchema.parse(samplePools);
export const initialDraft = (): DraftState => fromSampleDraftState(SampleDraftStateSchema.parse(sampleState));
