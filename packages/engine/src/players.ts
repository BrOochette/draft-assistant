import { normalizeRiotId } from '@draft/schemas';

// Reconnaissance des joueurs de l'appli dans la sélection du client, par pseudo, avec une marge d'erreur.

/** Joueur de l'appli : son nom, et son Riot ID « Nom#TAG » s'il est renseigné. */
export interface PlayerIdentity {
  name: string;
  riotId?: string | undefined;
}

/** Ressemblance minimale (0 à 1) pour reconnaître un joueur. 0,75 : environ une faute pour 4 caractères. */
export const PLAYER_MATCH_MIN = 0.75;
/** Écart minimal avec le deuxième joueur le plus proche : en dessous, la case est ambiguë et reste sans joueur. */
const AMBIGUITY_GAP = 0.05;
/** En dessous de cette longueur, seul un pseudo identique compte. */
const MIN_FUZZY_LENGTH = 3;
/** Un nom contenu dans le pseudo (« Broochette » dans « Ptite BrOochette ») compte s'il fait au moins 4 caractères. */
const MIN_CONTAINED_LENGTH = 4;

// Lettres grecques et cyrilliques utilisées pour décorer les pseudos (« KWΛNGYA ») : ramenées à la lettre latine.
const LOOKALIKE: Record<string, string> = {
  λ: 'a', α: 'a', β: 'b', ε: 'e', η: 'n', ι: 'i', κ: 'k', μ: 'm', ν: 'v', ο: 'o', ρ: 'p', σ: 'o', τ: 't', υ: 'u', χ: 'x', ω: 'w',
  а: 'a', в: 'b', е: 'e', ё: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't', у: 'y', х: 'x', і: 'i'
};

/** Pseudo comparable : minuscules, sans accents ni espaces ni symboles, lettres décoratives ramenées au latin. */
export const normalizeName = (s: string): string =>
  [...s.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '')]
    .map((ch) => LOOKALIKE[ch] ?? ch)
    .join('')
    .replace(/[^\p{L}\p{N}]/gu, '');

/** Nombre de fautes entre deux pseudos : lettre en trop, en moins, remplacée, ou deux lettres voisines inversées. */
const typos = (a: string, b: string): number => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const row = d[i]!;
      row[j] = Math.min(d[i - 1]![j]! + 1, row[j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j]!, d[i - 2]![j - 2]! + 1);
    }
  }
  return d[a.length]![b.length]!;
};

/** Ressemblance de deux pseudos, de 0 à 1 : identiques 0,98, l'un contient l'autre 0,9, sinon selon les fautes. */
export const nameSimilarity = (a: string, b: string): number => {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return 0;
  if (x === y) return 0.98;
  if (Math.min(x.length, y.length) < MIN_FUZZY_LENGTH) return 0;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length >= MIN_CONTAINED_LENGTH && long.includes(short)) return 0.9;
  return 1 - typos(x, y) / long.length;
};

const gameName = (riotId: string) => riotId.split('#')[0] ?? riotId;

/** Ressemblance entre un Riot ID lu dans le client et un joueur : Riot ID identique 1, sinon le meilleur des pseudos. */
const playerScore = (riotId: string, p: PlayerIdentity): number => {
  const id = p.riotId?.trim();
  if (id && normalizeRiotId(id) === normalizeRiotId(riotId)) return 1;
  const name = gameName(riotId);
  return Math.max(nameSimilarity(name, p.name), id ? nameSimilarity(name, gameName(id)) : 0);
};

/**
 * Joueur reconnu pour chaque case (null si aucun) : les meilleures ressemblances d'abord, un joueur par case au plus.
 * Une case dont les deux joueurs les plus proches se valent reste sans joueur.
 */
export const matchPlayers = (riotIds: readonly (string | null)[], players: readonly PlayerIdentity[]): (string | null)[] => {
  const scores = riotIds.map((id) => players.map((p) => (id ? playerScore(id, p) : 0)));
  const pairs = scores
    .flatMap((row, cell) => row.map((score, player) => ({ cell, player, score })))
    .filter((x) => x.score >= PLAYER_MATCH_MIN)
    .sort((a, b) => b.score - a.score);
  const out: (string | null)[] = riotIds.map(() => null);
  const used = new Set<number>();
  const done = new Set<number>();
  for (const { cell, player, score } of pairs) {
    if (done.has(cell) || used.has(player)) continue;
    const rival = Math.max(0, ...scores[cell]!.filter((s, i) => i !== player && !used.has(i)));
    done.add(cell);
    if (score < 1 && score - rival < AMBIGUITY_GAP) continue;
    out[cell] = players[player]!.name;
    used.add(player);
  }
  return out;
};
