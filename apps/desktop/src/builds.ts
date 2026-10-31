import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BuildSchema, ROLES, type Build } from '@draft/schemas';
import { USER_AGENT } from '@draft/ingest/http';
import { onDemandBuildUrl, PageFormatError, parseOnDemandBuild } from '@draft/ingest/lolalytics';
import { z } from 'zod';

// Écran Champions de l'appli desktop : build d'un champion contre un adversaire, ou page de runes d'une rune principale,
// chargés sur Lolalytics au clic (environ 1 s), puis gardés dans le dossier de l'utilisateur. Rétention : les champions
// des pools restent, les autres partent 14 jours après leur dernière ouverture, tout part au changement de patch.

/** Délai au-delà duquel Lolalytics est considéré comme ne répondant pas. */
export const TIMEOUT_MS = 10_000;
/** Délai minimal entre deux requêtes, par politesse. */
const DELAY_MS = 1000;
/** Build gardé ce délai après sa dernière ouverture, hors champions des pools. */
export const RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

export type BuildLoadError = 'OFFLINE' | 'DOWN' | 'FORMAT';

/** Demande de la page : validée ici, elle vient d'un autre processus. */
export const BuildRequestSchema = z.object({
  patch: z.string().regex(/^[\d.]{1,12}$/),
  champion: z.string().min(1).max(40),
  role: z.enum(ROLES),
  opponent: z.string().min(1).max(40).optional(),
  keystone: z.number().int().positive().optional()
}).refine((r) => (r.opponent == null) !== (r.keystone == null), 'Un adversaire ou une rune principale');
export type BuildRequest = z.infer<typeof BuildRequestSchema>;

export type BuildResult =
  | { ok: true; build: Build; games: number; winRate: number; fetchedAt: string }
  | { ok: false; error: BuildLoadError };

const CachedSchema = z.object({ champion: z.string(), build: BuildSchema, games: z.number(), winRate: z.number(), fetchedAt: z.string() });

export type FetchPage = (url: string) => Promise<Response>;
const defaultFetch: FetchPage = (url) => fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * `dir` : dossier du cache (un sous-dossier par patch). `isOnline` : connexion présente (vérifiée avant chaque
 * requête, échec immédiat sans attendre le délai).
 */
export const createBuildLoader = (
  dir: string,
  isOnline: () => boolean,
  { fetchPage = defaultFetch, now = () => Date.now(), delayMs = DELAY_MS }: { fetchPage?: FetchPage; now?: () => number; delayMs?: number } = {}
) => {
  const fileOf = (r: BuildRequest) =>
    join(dir, r.patch, createHash('sha1').update(JSON.stringify([r.champion, r.role, r.opponent ?? null, r.keystone ?? null])).digest('hex') + '.json');
  /** Requêtes l'une après l'autre ; une même demande en cours n'est pas relancée. */
  let queue: Promise<unknown> = Promise.resolve();
  let last = 0;
  const pending = new Map<string, Promise<BuildResult>>();

  const download = async (r: BuildRequest): Promise<BuildResult> => {
    if (!isOnline()) return { ok: false, error: 'OFFLINE' };
    const wait = last + delayMs - now();
    if (wait > 0) await sleep(wait);
    last = now();
    let html: string;
    try {
      const res = await fetchPage(onDemandBuildUrl(r.champion, r.role, r.opponent != null ? { opponent: r.opponent } : { keystone: r.keystone! }));
      // 404 : adresse de page inconnue du site, comme un format changé.
      if (res.status === 404) return { ok: false, error: 'FORMAT' };
      if (!res.ok) return { ok: false, error: 'DOWN' };
      html = await res.text();
    } catch {
      // Délai dépassé ou coupure : la connexion a pu tomber entre-temps.
      return { ok: false, error: isOnline() ? 'DOWN' : 'OFFLINE' };
    }
    try {
      const page = parseOnDemandBuild(html, r.opponent != null);
      const result = { ok: true as const, ...page, fetchedAt: new Date(now()).toISOString() };
      const file = fileOf(r);
      await mkdir(join(file, '..'), { recursive: true });
      await writeFile(file, JSON.stringify({ champion: r.champion, build: page.build, games: page.games, winRate: page.winRate, fetchedAt: result.fetchedAt }), 'utf8');
      return result;
    } catch (e) {
      if (e instanceof PageFormatError) return { ok: false, error: 'FORMAT' };
      throw e;
    }
  };

  const load = async (r: BuildRequest): Promise<BuildResult> => {
    const file = fileOf(r);
    const cached = await readFile(file, 'utf8').then((t) => CachedSchema.safeParse(JSON.parse(t)), () => null);
    if (cached?.success) {
      // Dernière ouverture : date du fichier, lue par la rétention.
      const t = new Date(now());
      await utimes(file, t, t).catch(() => {});
      return { ok: true, build: cached.data.build, games: cached.data.games, winRate: cached.data.winRate, fetchedAt: cached.data.fetchedAt };
    }
    const key = file;
    const running = pending.get(key);
    if (running) return running;
    const p = queue.then(() => download(r));
    queue = p.catch(() => {});
    pending.set(key, p);
    try {
      return await p;
    } finally {
      pending.delete(key);
    }
  };

  /** Rétention : supprime les autres patchs, puis les champions hors `keep` ouverts il y a plus de RETENTION_MS. */
  const prune = async (patch: string, keep: readonly string[]) => {
    const kept = new Set(keep);
    for (const p of await readdir(dir).catch(() => [] as string[])) {
      if (p !== patch) {
        await rm(join(dir, p), { recursive: true, force: true });
        continue;
      }
      for (const f of await readdir(join(dir, p)).catch(() => [] as string[])) {
        const file = join(dir, p, f);
        const info = await stat(file).catch(() => null);
        if (!info || now() - info.mtimeMs <= RETENTION_MS) continue;
        const champion = await readFile(file, 'utf8').then((t) => (JSON.parse(t) as { champion?: string }).champion, () => undefined);
        if (!champion || !kept.has(champion)) await rm(file, { force: true });
      }
    }
  };

  return { load, prune };
};

