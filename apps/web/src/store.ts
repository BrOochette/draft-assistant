import { get, set } from 'idb-keyval';
import { PoolsSchema, RiotIdsSchema, type Pools, type RiotIds } from '@draft/schemas';
import { seedPools } from './data';

const KEY = 'draft-assistant:pools:v1';
const RIOT_IDS_KEY = 'draft-assistant:riot-ids:v1';
const ME_KEY = 'draft-assistant:me:v1';

/** Joueurs et pools depuis IndexedDB. Au premier lancement, les pools d'exemple sont enregistrés. */
export const loadPools = async (): Promise<Pools> => {
  const stored = PoolsSchema.safeParse(await get(KEY));
  if (stored.success) return stored.data;
  const seed = seedPools();
  await set(KEY, seed);
  return seed;
};

export const savePools = (pools: Pools): Promise<void> => set(KEY, pools);

/** Riot ID de chaque joueur, pour le placer sur son rôle pendant une draft lue dans le client. */
export const loadRiotIds = async (): Promise<RiotIds> => {
  const stored = RiotIdsSchema.safeParse(await get(RIOT_IDS_KEY));
  return stored.success ? stored.data : {};
};

export const saveRiotIds = (ids: RiotIds): Promise<void> => set(RIOT_IDS_KEY, ids);

/** Joueur marqué « Moi » : build proposé pour son pick hors draft en direct. */
export const loadMe = async (): Promise<string | null> => {
  const stored: unknown = await get(ME_KEY);
  return typeof stored === 'string' && stored ? stored : null;
};

export const saveMe = (me: string | null): Promise<void> => set(ME_KEY, me);
