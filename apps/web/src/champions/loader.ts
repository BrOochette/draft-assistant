import { useSyncExternalStore } from 'react';
import type { Role } from '@draft/schemas';
import { desktopBuilds, type BuildLoadError, type BuildResult } from '../desktop';

// Builds de l'écran Champions chargés au clic par l'appli desktop : état de chaque chargement, gardé le temps de la
// session (le processus principal garde les builds sur disque).

export type LoadState = { status: 'loading' } | { status: 'error'; error: BuildLoadError } | ({ status: 'ok' } & Extract<BuildResult, { ok: true }>);

export interface LoadKey {
  patch: string;
  champion: string;
  role: Role;
  opponent?: string;
  keystone?: number;
  /** Identifiants d'URL Lolalytics du snapshot. */
  slug?: string;
  opponentSlug?: string;
}

const states = new Map<string, LoadState>();
const listeners = new Set<() => void>();
let version = 0;

const keyOf = (k: LoadKey) => [k.patch, k.champion, k.role, k.opponent ?? '', k.keystone ?? ''].join('|');
const set = (key: string, s: LoadState) => {
  states.set(key, s);
  version++;
  for (const l of listeners) l();
};

/** Lance le chargement s'il n'est ni en cours ni réussi (un échec se relance). Sans appli desktop, rien. */
export const loadBuild = (k: LoadKey) => {
  const api = desktopBuilds();
  const key = keyOf(k);
  const s = states.get(key);
  if (!api || s?.status === 'loading' || s?.status === 'ok') return;
  set(key, { status: 'loading' });
  api.load(k).then(
    (r) => set(key, r.ok ? { status: 'ok', ...r } : { status: 'error', error: r.error }),
    () => set(key, { status: 'error', error: 'DOWN' })
  );
};

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

/** État des chargements, relu à chaque changement. */
export const useLoads = (): ((k: LoadKey) => LoadState | undefined) => {
  useSyncExternalStore(subscribe, () => version);
  return (k) => states.get(keyOf(k));
};
