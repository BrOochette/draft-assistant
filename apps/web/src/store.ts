import { get, set } from 'idb-keyval';
import { PoolsSchema, type Pools } from '@draft/schemas';
import { seedPools } from './data';

const KEY = 'draft-assistant:pools:v1';

/** Joueurs et pools depuis IndexedDB. Au premier lancement, les pools d'exemple sont enregistrés. */
export const loadPools = async (): Promise<Pools> => {
  const stored = PoolsSchema.safeParse(await get(KEY));
  if (stored.success) return stored.data;
  const seed = seedPools();
  await set(KEY, seed);
  return seed;
};

export const savePools = (pools: Pools): Promise<void> => set(KEY, pools);
