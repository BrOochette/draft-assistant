import { PLAYERS_FILE_KIND, PlayersFileSchema, ROLES, type PlayerPools, type Pools, type PlayersFile, type RiotIds } from '@draft/schemas';

/** Fichier de partage de la liste des joueurs : pools et Riot ID, dans l'ordre d'affichage. */
export const toPlayersFile = (pools: Pools, riotIds: RiotIds, now = new Date()): PlayersFile => ({
  kind: PLAYERS_FILE_KIND,
  version: 1,
  exportedAt: now.toISOString(),
  players: Object.entries(pools).map(([name, p]) => ({
    name,
    ...(riotIds[name]?.trim() && { riotId: riotIds[name]!.trim() }),
    pools: p
  }))
});

/** Nom du fichier exporté : « draft-assistant-joueurs-2026-10-26.json », ou « draft-assistant-joueur-Alex-2026-10-26.json » pour un seul joueur. */
export const playersFileName = (now = new Date(), player?: string): string =>
  'draft-assistant-' + (player ? 'joueur-' + player.replace(/[\\/:*?"<>|\s]+/g, '_') : 'joueurs') + '-' + now.toISOString().slice(0, 10) + '.json';

/** Pools d'un seul joueur, au format de la liste (même import). */
export const onePlayer = (pools: Pools, player: string): Pools => (pools[player] ? { [player]: pools[player] } : {});

export interface ImportPreview {
  pools: Pools;
  riotIds: RiotIds;
  /** Joueurs du fichier, dans son ordre ; `replaced` : un joueur du même nom existe déjà. */
  players: { name: string; replaced: boolean }[];
  /** Champions inconnus du catalogue, ignorés. */
  unknown: string[];
}

export type ImportError = 'NOT_JSON' | 'BAD_FORMAT' | 'EMPTY';

/**
 * Lit un fichier de partage et prépare la fusion avec la liste actuelle : les joueurs du fichier remplacent ceux du même
 * nom (pools et Riot ID), les nouveaux sont ajoutés à la fin, les autres restent tels quels. Les champions inconnus du
 * catalogue sont retirés des pools ; un même champion en double dans un rôle n'est gardé qu'une fois.
 */
export const readPlayersFile = (
  text: string,
  current: { pools: Pools; riotIds: RiotIds },
  known: (champion: string) => boolean
): ImportPreview | { error: ImportError } => {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: 'NOT_JSON' };
  }
  const parsed = PlayersFileSchema.safeParse(raw);
  if (!parsed.success) return { error: 'BAD_FORMAT' };
  if (!parsed.data.players.length) return { error: 'EMPTY' };

  const pools: Pools = { ...current.pools };
  const riotIds: RiotIds = { ...current.riotIds };
  const unknown = new Set<string>();
  const players: ImportPreview['players'] = [];
  for (const p of parsed.data.players) {
    const name = p.name.trim();
    const clean: PlayerPools = {};
    for (const role of ROLES) {
      const list = p.pools[role];
      if (!list) continue;
      const seen = new Set<string>();
      clean[role] = list.filter((e) => {
        if (!known(e.champion)) {
          unknown.add(e.champion);
          return false;
        }
        if (seen.has(e.champion)) return false;
        seen.add(e.champion);
        return true;
      });
    }
    if (!players.some((x) => x.name === name)) players.push({ name, replaced: name in current.pools });
    pools[name] = clean;
    if (p.riotId?.trim()) riotIds[name] = p.riotId.trim();
    else delete riotIds[name];
  }
  return { pools, riotIds, players, unknown: [...unknown] };
};
