import { ROLES, type Role } from '@draft/schemas';

// Adresses de l'écran Champions : #/champions (liste), #/champions/<champion>/<rôle>/<onglet>, et pour un build contre
// un adversaire #/champions/<champion>/<rôle>/build/<adversaire>.

export type ChampionTab = 'build' | 'matchups' | 'duos';
export const CHAMPION_TABS: readonly ChampionTab[] = ['build', 'matchups', 'duos'];

export interface ChampionRoute {
  champion: string;
  /** null : rôle principal du champion. */
  role: Role | null;
  tab: ChampionTab;
  opponent: string | null;
}

export const LIST_HASH = '#/champions';

export const isChampionsHash = (hash: string) => hash === LIST_HASH || hash.startsWith(LIST_HASH + '/');

/** Segment d'adresse décodé, null s'il est mal formé (« %E0 » tapé ou tronqué). */
const decode = (p: string) => {
  try {
    return decodeURIComponent(p);
  } catch {
    return null;
  }
};

/** Fiche affichée, null sur la liste (adresse mal formée comprise). */
export const parseChampionHash = (hash: string): ChampionRoute | null => {
  if (!hash.startsWith(LIST_HASH + '/')) return null;
  const parts = hash.slice(LIST_HASH.length + 1).split('/').map(decode);
  if (parts.some((p) => p === null)) return null;
  const [champion, role, tab, opponent] = parts as string[];
  if (!champion) return null;
  return {
    champion,
    role: (ROLES as readonly string[]).includes(role ?? '') ? (role as Role) : null,
    tab: (CHAMPION_TABS as readonly string[]).includes(tab ?? '') ? (tab as ChampionTab) : 'build',
    opponent: tab === 'build' && opponent ? opponent : null
  };
};

export const championHash = (champion: string, role?: Role | null, tab: ChampionTab = 'build', opponent?: string | null) =>
  LIST_HASH + '/' + [champion, role ?? '-', tab, ...(opponent && tab === 'build' ? [opponent] : [])].map(encodeURIComponent).join('/');

// Retour d'une fiche : vers la page d'où l'on y est arrivé (draft, liste, fiche d'un autre champion, joueurs), noté à
// chaque changement d'adresse. Un passage d'un onglet à l'autre de la même fiche ne le change pas.
const origins = new Map<string, string>();
let returning = false;

export const noteNavigation = (from: string, to: string) => {
  const target = parseChampionHash(to);
  if (target && !returning && parseChampionHash(from)?.champion !== target.champion) origins.set(target.champion, from || '#/');
  returning = false;
};

/** Page de retour de la fiche d'un champion : la liste si elle n'est pas connue (adresse ouverte directement). */
export const originOf = (champion: string) => origins.get(champion) ?? LIST_HASH;

/** Revient à la page d'origine sans la noter comme nouvelle origine (pas d'aller-retour sans fin entre deux fiches). */
export const goBack = (champion: string) => {
  returning = true;
  location.hash = originOf(champion);
};
