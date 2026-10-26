import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type PoliteFetch = (url: string) => Promise<string>;

export const USER_AGENT = 'draft-assistant/0.1 (outil personnel, non commercial ; une collecte par patch)';

interface Options {
  /** Délai minimal entre deux requêtes réseau. */
  delayMs?: number;
  /** Dossier de cache : une page déjà récupérée n'est pas redemandée (reprise après interruption). */
  cacheDir?: string;
  retries?: number;
  referer?: string;
  log?: (msg: string) => void;
  /**
   * Attendu avant chaque requête réseau (pas pour une page en cache) : l'appli desktop y met la collecte en pause
   * pendant une sélection des champions, et y arrête une collecte annulée (en levant CrawlStopped).
   */
  beforeRequest?: () => Promise<void>;
}

/** Collecte arrêtée volontairement : remonte telle quelle, sans être prise pour l'erreur d'un champion. */
export class CrawlStopped extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Récupération polie : une requête à la fois, un délai entre chaque, un User-Agent identifiable,
 * des reprises espacées sur coupure réseau, 429 et 5xx, et un arrêt net sur 401 ou 403.
 */
export const politeFetch = ({ delayMs = 1200, cacheDir, retries = 3, referer, log = () => {}, beforeRequest }: Options = {}): PoliteFetch => {
  let last = 0;
  return async (url) => {
    const cacheFile = cacheDir ? join(cacheDir, createHash('sha1').update(url).digest('hex') + '.txt') : null;
    if (cacheFile) {
      const cached = await readFile(cacheFile, 'utf8').catch(() => null);
      if (cached != null) return cached;
    }
    for (let attempt = 0; ; attempt++) {
      if (beforeRequest) await beforeRequest();
      const wait = last + delayMs - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
      let res: Response;
      try {
        res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, ...(referer && { Referer: referer }) } });
      } catch (e) {
        // Coupure réseau (pas de réponse HTTP) : nouvel essai espacé.
        if (attempt >= retries) throw e;
        const backoff = delayMs * 5 * 2 ** attempt;
        log(`Erreur réseau, nouvel essai dans ${Math.round(backoff / 1000)} s : ${url}`);
        await sleep(backoff);
        continue;
      }
      if (res.ok) {
        const text = await res.text();
        if (cacheFile) {
          await mkdir(cacheDir!, { recursive: true });
          await writeFile(cacheFile, text, 'utf8');
        }
        return text;
      }
      if (res.status === 401 || res.status === 403) throw new Error(`Accès refusé (${res.status}) : ${url}. Collecte arrêtée.`);
      if (attempt >= retries || !(res.status === 429 || res.status >= 500)) throw new Error(`HTTP ${res.status} : ${url}`);
      const backoff = Number(res.headers.get('retry-after')) * 1000 || delayMs * 5 * 2 ** attempt;
      log(`HTTP ${res.status}, nouvel essai dans ${Math.round(backoff / 1000)} s : ${url}`);
      await sleep(backoff);
    }
  };
};
