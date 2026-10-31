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

/** Fiche affichée, null sur la liste. */
export const parseChampionHash = (hash: string): ChampionRoute | null => {
  if (!hash.startsWith(LIST_HASH + '/')) return null;
  const [champion, role, tab, opponent] = hash.slice(LIST_HASH.length + 1).split('/').map((p) => decodeURIComponent(p));
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
