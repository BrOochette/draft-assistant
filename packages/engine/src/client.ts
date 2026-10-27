import { emptySlots, ROLES, type ClientDraft, type DraftState, type Role, type RoleSlots } from '@draft/schemas';
import { MAX_BANS } from './bans';
import { rolesByPlay } from './context';
import { matchPlayers, type PlayerIdentity } from './players';
import type { EngineData } from './stats-provider';

/** Draft mise à jour depuis le client, et champions survolés par les alliés (affichés, hors calcul). */
export interface ClientSync {
  draft: DraftState;
  hover: Partial<Record<Role, string>>;
  /** Rôles dans l'ordre des cases du client (ordre de pick), pour chaque équipe. */
  order: ClientOrder;
  /** Rôles dont le joueur est en train de choisir, pour chaque équipe. */
  picking: ClientOrder;
  /** Side de ton équipe, null s'il est inconnu. */
  side: ClientDraft['side'];
  /** Rôle du joueur connecté au client (sa case), null s'il est inconnu. */
  localRole: Role | null;
}

export interface ClientOrder {
  ally: Role[];
  enemy: Role[];
}

/**
 * Rôle de chaque case, dans l'ordre du client ; une case sans rôle connu prend le premier rôle restant.
 * Toujours les 5 rôles, une fois chacun.
 */
const cellOrder = (known: readonly (Role | null)[]): Role[] => {
  const seen = new Set<Role>();
  const slots = known.map((r) => (r && !seen.has(r) ? (seen.add(r), r) : null));
  const rest = ROLES.filter((r) => !seen.has(r));
  const out = slots.map((r) => r ?? rest.shift() ?? null).filter((r): r is Role => r != null);
  return [...out, ...rest];
};

const nameByKey = (data: EngineData): Map<number, string> => {
  const out = new Map<number, string>();
  for (const c of data.catalog.values()) if (c.key != null) out.set(c.key, c.name);
  return out;
};

const roleOf = (slots: RoleSlots, name: string): Role | null => ROLES.find((r) => slots[r] === name) ?? null;

/**
 * Place les champions verrouillés d'un camp. Le rôle vient du client s'il en donne un ; sinon un champion déjà placé
 * garde son rôle (une correction à la main reste), et un nouveau va sur son rôle le plus joué encore libre.
 */
const placeTeam = (
  cells: readonly { position: Role | null; name: string }[],
  previous: RoleSlots,
  data: EngineData
): Partial<Record<Role, string>> => {
  const placed: Partial<Record<Role, string>> = {};
  const put = (role: Role | null | undefined, name: string) => {
    if (!role || placed[role] || Object.values(placed).includes(name)) return false;
    placed[role] = name;
    return true;
  };
  const rest = cells.filter((c) => !put(c.position, c.name));
  const fresh = rest.filter((c) => !put(roleOf(previous, c.name), c.name));
  for (const c of fresh) put(rolesByPlay(data, c.name).find((r) => !placed[r]) ?? ROLES.find((r) => !placed[r]), c.name);
  return placed;
};

/**
 * Applique la sélection lue dans le client à la draft. Le client prime : bans, picks verrouillés et rôles attribués.
 * Sur un rôle où le client n'a pas de pick, la saisie à la main reste, sauf si ce champion est banni ou pris ailleurs.
 * `fresh` : nouvelle sélection, la draft repart de zéro (le placement des joueurs reste).
 * Les joueurs reconnus par leur pseudo (Riot ID ou nom, à quelques fautes près) sont placés sur leur rôle.
 */
export const applyClientDraft = (current: DraftState, client: ClientDraft, data: EngineData, players: readonly PlayerIdentity[], fresh: boolean): ClientSync => {
  const base: DraftState = fresh ? { ...current, ally: emptySlots(), enemy: emptySlots(), allyBans: [], enemyBans: [] } : current;
  const names = nameByKey(data);
  const known = <T extends { champion: number | null }>(cells: readonly T[]) =>
    cells.flatMap((c) => {
      const name = c.champion != null ? names.get(c.champion) : undefined;
      return name ? [{ ...c, name }] : [];
    });
  const bans = (keys: readonly number[]) => [...new Set(keys.flatMap((k) => names.get(k) ?? []))].slice(0, MAX_BANS);

  const allyBans = bans(client.allyBans);
  const enemyBans = bans(client.enemyBans);
  const allyLocked = placeTeam(known(client.ally), base.ally, data);
  const enemyLocked = placeTeam(known(client.enemy), base.enemy, data);

  const taken = new Set([...allyBans, ...enemyBans, ...Object.values(allyLocked), ...Object.values(enemyLocked)]);
  const merge = (previous: RoleSlots, locked: Partial<Record<Role, string>>): RoleSlots => {
    const out = emptySlots();
    for (const r of ROLES) {
      const kept = previous[r];
      out[r] = locked[r] ?? (kept && !taken.has(kept) ? kept : null);
    }
    return out;
  };
  const ally = merge(base.ally, allyLocked);
  const enemy = merge(base.enemy, enemyLocked);

  // Survols : sur le rôle attribué, sinon le rôle le plus joué encore libre ; seulement là où aucun pick n'est saisi.
  const hover: Partial<Record<Role, string>> = {};
  for (const c of client.ally) {
    if (c.champion != null || c.hover == null) continue;
    const name = names.get(c.hover);
    if (!name || taken.has(name)) continue;
    const role = c.position ?? rolesByPlay(data, name).find((r) => !ally[r] && !hover[r]);
    if (role && !ally[role] && !hover[role]) hover[role] = name;
  }

  // Joueurs reconnus par leur pseudo : placés sur le rôle de leur case, retirés des autres rôles.
  const matched = matchPlayers(client.ally.map((c) => c.riotId), players);
  const assign = { ...base.assign };
  for (const [i, c] of client.ally.entries()) {
    const player = matched[i];
    const name = c.champion != null ? names.get(c.champion) : undefined;
    const role = c.position ?? (name ? roleOf(ally, name) : null);
    if (!player || !role) continue;
    for (const r of ROLES) if (assign[r] === player) assign[r] = null;
    assign[role] = player;
  }

  // Ordre des cases : rôle attribué, sinon rôle où son champion (verrouillé ou survolé) a été placé.
  const order: ClientOrder = {
    ally: cellOrder(client.ally.map((c) => {
      const locked = c.champion != null ? names.get(c.champion) : undefined;
      const hovered = c.hover != null ? names.get(c.hover) : undefined;
      return c.position ?? (locked ? roleOf(ally, locked) : null) ?? (ROLES.find((r) => hovered && hover[r] === hovered) ?? null);
    })),
    enemy: cellOrder(client.enemy.map((c) => {
      const name = c.champion != null ? names.get(c.champion) : undefined;
      return c.position ?? (name ? roleOf(enemy, name) : null);
    }))
  };

  // Cases en train de choisir : leur rôle dans l'ordre des cases (même index que la case).
  const picking: ClientOrder = {
    ally: client.ally.flatMap((c, i) => (c.picking && order.ally[i] ? [order.ally[i]!] : [])),
    enemy: client.enemy.flatMap((c, i) => (c.picking && order.enemy[i] ? [order.enemy[i]!] : []))
  };

  const local = client.ally.findIndex((c) => c.local);
  const localRole = local >= 0 ? order.ally[local] ?? null : null;
  return { draft: { assign, ally, enemy, allyBans, enemyBans }, hover, order, picking, side: client.side, localRole };
};
