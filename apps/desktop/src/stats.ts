import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ChampionAttributesSchema, ChampionOverridesSchema, type ChampionAttributes } from '@draft/schemas';
import { CrawlStopped, politeFetch } from '@draft/ingest/http';
import { crawlLolalytics } from '@draft/ingest/lolalytics';
import { downloadIllustrations, downloadPortraits, latestDdragonVersion } from '@draft/ingest/portraits';
import { assembleLolalyticsSnapshot } from '@draft/ingest/snapshot';
import { applyOverrides, importWikiAttributes } from '@draft/ingest/wiki';

// Mise à jour des stats depuis l'appli desktop : nouveaux champions (wiki, portraits et illustrations Data Dragon), la
// collecte Lolalytics de `npm run ingest -- lolalytics`, puis l'assemblage du snapshot, écrits dans le dossier de
// l'utilisateur. L'appli les charge à la place de ceux de l'installeur. Une fois par semaine au plus (rythme des
// patchs), en pause pendant une sélection des champions.

/** Délai minimal entre deux collectes réussies. */
export const STATS_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
/** Délai entre deux requêtes, comme la collecte en ligne de commande. */
const DELAY_MS = 1500;
const PAUSE_POLL_MS = 2000;

export interface StatsProgress {
  done: number;
  total: number;
  champion: string;
  /** En pause : une sélection des champions est en cours. */
  paused: boolean;
}

export interface StatsStatus {
  running: boolean;
  progress: StatsProgress | null;
  /** Fin de la dernière collecte réussie (ISO), null si aucune. */
  lastUpdate: string | null;
  /** Patch des stats collectées, null si aucune. */
  patch: string | null;
  /** Date (ISO) à partir de laquelle une nouvelle collecte est possible, null : tout de suite. */
  nextAllowed: string | null;
  /** Code de la dernière erreur, null si la dernière collecte a réussi ou n'a pas eu lieu. */
  error: StatsError | null;
}

export type StatsError = 'TOO_SOON' | 'IN_CHAMP_SELECT' | 'RUNNING' | 'ACCESS_DENIED' | 'NETWORK' | 'CANCELLED' | 'NO_DATA';

export interface StatsPaths {
  /** Dossier de l'utilisateur pour les stats (snapshot, collecte brute, cache, état). */
  dir: string;
  /** Dossier des attributs embarqués : champions.json, champions-overrides.json, ddragon-version.txt. */
  data: string;
  /** Appli web embarquée : ses portraits et illustrations (champions/, champions/centered/). */
  web: string;
  /** Portraits et illustrations téléchargés pour les nouveaux champions (même arborescence que champions/). */
  images: string;
}

interface State {
  lastUpdate: string | null;
  patch: string | null;
}

/** Snapshot collecté dans l'appli, servi à la place de celui de l'installeur. */
export const localSnapshot = (paths: StatsPaths) => join(paths.dir, 'snapshot.json');
const stateFile = (paths: StatsPaths) => join(paths.dir, 'state.json');
const readJson = async (file: string): Promise<unknown> => JSON.parse(await readFile(file, 'utf8'));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Champions du wiki absents des attributs embarqués (sortis après l'installeur), ajoutés à la liste. Wiki inaccessible :
 * la liste embarquée seule.
 */
export const withNewChampions = async (bundled: ChampionAttributes[], fetchWiki: () => Promise<ChampionAttributes[]>): Promise<{ list: ChampionAttributes[]; added: ChampionAttributes[] }> => {
  let wiki: ChampionAttributes[] = [];
  try {
    wiki = await fetchWiki();
  } catch (e) {
    if (e instanceof CrawlStopped) throw e;
  }
  const known = new Set(bundled.map((c) => c.name));
  const added = wiki.filter((c) => !known.has(c.name));
  return { list: [...bundled, ...added], added };
};

export const createStatsUpdater = (paths: StatsPaths, inChampSelect: () => boolean, emit: (s: StatsStatus) => void) => {
  let running = false;
  let cancelled = false;
  let progress: StatsProgress | null = null;
  let error: StatsError | null = null;

  const readState = async (): Promise<State> => {
    try {
      return { lastUpdate: null, patch: null, ...((await readJson(stateFile(paths))) as Partial<State>) };
    } catch {
      return { lastUpdate: null, patch: null };
    }
  };
  const status = async (): Promise<StatsStatus> => {
    const st = await readState();
    const next = st.lastUpdate ? new Date(new Date(st.lastUpdate).getTime() + STATS_INTERVAL_MS) : null;
    return { running, progress, lastUpdate: st.lastUpdate, patch: st.patch, nextAllowed: next && next.getTime() > Date.now() ? next.toISOString() : null, error };
  };
  const push = async () => emit(await status());

  /** Avant chaque requête : arrêt si annulée, attente tant qu'une sélection des champions est en cours. */
  const gate = async () => {
    for (;;) {
      if (cancelled) throw new CrawlStopped('Collecte annulée');
      if (!inChampSelect()) break;
      if (progress && !progress.paused) {
        progress = { ...progress, paused: true };
        void push();
      }
      await sleep(PAUSE_POLL_MS);
    }
    if (progress?.paused) {
      progress = { ...progress, paused: false };
      void push();
    }
  };

  const start = async (): Promise<StatsStatus> => {
    const before = await status();
    if (running) return { ...before, error: 'RUNNING' };
    if (before.nextAllowed) return { ...before, error: 'TOO_SOON' };
    if (inChampSelect()) return { ...before, error: 'IN_CHAMP_SELECT' };
    running = true;
    cancelled = false;
    error = null;
    progress = { done: 0, total: 0, champion: '', paused: false };
    void push();
    void (async () => {
      try {
        const bundled = ChampionAttributesSchema.array().parse(await readJson(join(paths.data, 'champions.json')));
        const overrides = ChampionOverridesSchema.parse(await readJson(join(paths.data, 'champions-overrides.json')).catch(() => ({})));
        let version = (await readFile(join(paths.data, 'ddragon-version.txt'), 'utf8').catch(() => '16.21.1')).trim();
        // Cache du jour : une collecte interrompue (annulée, appli fermée) reprend là où elle s'est arrêtée.
        const cacheDir = join(paths.dir, 'cache', new Date().toISOString().slice(0, 10));
        const options = { delayMs: DELAY_MS, cacheDir, beforeRequest: gate };

        // Nouveaux champions : attributs du wiki, portrait et illustration (ceux de l'installeur sont déjà là).
        const { list: attributes, added } = await withNewChampions(bundled, async () => (await importWikiAttributes(politeFetch(options))).champions);
        const missing = (file: (id: string) => string) => attributes.map((c) => c.ddragonId).filter((id) => !existsSync(join(paths.web, file(id))) && !existsSync(join(paths.images, file(id))));
        const portraits = missing((id) => join('champions', id + '.png'));
        const illustrations = missing((id) => join('champions', 'centered', id + '.jpg'));
        if (portraits.length || illustrations.length) {
          await gate();
          version = await latestDdragonVersion().catch(() => version);
          await downloadPortraits(portraits, join(paths.images, 'champions'), version);
          await gate();
          await downloadIllustrations(illustrations, join(paths.images, 'champions', 'centered'));
        }
        if (added.length) await writeFile(join(paths.dir, 'new-champions.json'), JSON.stringify(added.map((c) => c.name)), 'utf8').catch(() => {});
        const { dump } = await crawlLolalytics(
          attributes,
          politeFetch(options),
          politeFetch({ ...options, referer: 'https://lolalytics.com/' }),
          undefined,
          undefined,
          undefined,
          (done, total, champion) => {
            progress = { done, total, champion, paused: false };
            void push();
          }
        );
        if (!Object.keys(dump.champions).length) throw new Error('NO_DATA');
        const snapshot = assembleLolalyticsSnapshot(applyOverrides(attributes, overrides), overrides, dump, version);
        await mkdir(paths.dir, { recursive: true });
        await writeFile(join(paths.dir, `lolalytics-${dump.patch}.json`), JSON.stringify(dump) + '\n', 'utf8');
        await writeFile(localSnapshot(paths), JSON.stringify(snapshot), 'utf8');
        await writeFile(stateFile(paths), JSON.stringify({ lastUpdate: new Date().toISOString(), patch: snapshot.patch } satisfies State), 'utf8');
      } catch (e) {
        const msg = (e as Error).message;
        error = e instanceof CrawlStopped ? 'CANCELLED' : /Accès refusé/.test(msg) ? 'ACCESS_DENIED' : msg === 'NO_DATA' ? 'NO_DATA' : 'NETWORK';
      } finally {
        running = false;
        progress = null;
        await push();
      }
    })();
    return status();
  };

  return {
    status,
    start,
    cancel: () => {
      cancelled = true;
    }
  };
};
