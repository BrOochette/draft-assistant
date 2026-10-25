import { z } from 'zod';
import type { ClientDraft, Role } from '@draft/schemas';

// Session de sélection des champions du client (GET /lol-champ-select/v1/session). API locale non documentée par Riot :
// lecture tolérante, seuls les champs utiles sont gardés, avec des valeurs par défaut.
const CellSchema = z.object({
  cellId: z.number(),
  championId: z.number().default(0),
  championPickIntent: z.number().default(0),
  assignedPosition: z.string().default(''),
  /** 1 : side bleu, 2 : side rouge. */
  team: z.number().optional(),
  gameName: z.string().optional(),
  tagLine: z.string().optional(),
  nameVisibilityType: z.string().optional()
});
const ActionSchema = z.object({
  actorCellId: z.number(),
  championId: z.number().default(0),
  type: z.string(),
  completed: z.boolean().default(false),
  isInProgress: z.boolean().default(false),
  isAllyAction: z.boolean().optional()
});
export const LcuSessionSchema = z.object({
  gameId: z.number().default(0),
  localPlayerCellId: z.number().default(-1),
  myTeam: z.array(CellSchema).default([]),
  theirTeam: z.array(CellSchema).default([]),
  actions: z.array(z.array(ActionSchema)).default([]),
  bans: z.object({ myTeamBans: z.array(z.number()).default([]), theirTeamBans: z.array(z.number()).default([]) }).optional(),
  timer: z.object({ phase: z.string().default('') }).optional()
});
export type LcuSession = z.infer<typeof LcuSessionSchema>;

const POSITION: Record<string, Role> = { top: 'Top', jungle: 'Jungle', middle: 'Mid', bottom: 'ADC', utility: 'Support' };
const PHASE: Record<string, ClientDraft['phase']> = { PLANNING: 'planning', BAN_PICK: 'banPick', FINALIZATION: 'finalization', GAME_STARTING: 'starting' };

const champ = (id: number | undefined) => (id != null && id > 0 ? id : null);

/** Riot ID d'une case, si le client ne le masque pas. */
const riotIdOf = (c: z.infer<typeof CellSchema>) =>
  c.gameName && c.tagLine && c.nameVisibilityType !== 'HIDDEN' ? c.gameName + '#' + c.tagLine : null;

/**
 * Convertit la session du client. Un pick compte quand son action est terminée ; avant, le champion choisi est un
 * survol. Après un échange de champions entre alliés, la case porte le nouveau champion.
 * `localRiotId` : Riot ID du joueur local, que la session ne donne pas toujours.
 */
export const toClientDraft = (raw: unknown, localRiotId: string | null): ClientDraft => {
  const s = LcuSessionSchema.parse(raw);
  const actions = s.actions.flat();
  const mine = new Set(s.myTeam.map((c) => c.cellId));
  const pick = (cell: number, done: boolean) =>
    actions.find((a) => a.type === 'pick' && a.actorCellId === cell && (done ? a.completed : a.isInProgress && !a.completed) && a.championId > 0);
  // Sans aucune action (mode sans phase de pick), le champion de la case compte comme verrouillé.
  const locked = (c: z.infer<typeof CellSchema>) => (actions.length === 0 || pick(c.cellId, true) ? champ(c.championId) ?? champ(pick(c.cellId, true)?.championId) : null);

  const picking = (cell: number) => actions.some((a) => a.type === 'pick' && a.actorCellId === cell && a.isInProgress && !a.completed);
  // Side : champ « team » des cases, sinon numéros de case (0 à 4 côté bleu, 5 à 9 côté rouge).
  const team = s.myTeam.find((c) => c.team === 1 || c.team === 2)?.team;
  const side = team ? (team === 1 ? 'blue' : 'red') : s.myTeam.length ? (Math.min(...s.myTeam.map((c) => c.cellId)) >= 5 ? 'red' : 'blue') : null;

  const banned = (ally: boolean) => [
    ...new Set([
      ...actions.filter((a) => a.type === 'ban' && a.completed && (a.isAllyAction ?? mine.has(a.actorCellId)) === ally).map((a) => a.championId),
      ...((ally ? s.bans?.myTeamBans : s.bans?.theirTeamBans) ?? [])
    ])
  ].filter((id) => id > 0);

  return {
    gameId: s.gameId,
    phase: PHASE[s.timer?.phase ?? ''] ?? 'banPick',
    bansPending: actions.some((a) => a.type === 'ban' && !a.completed),
    side,
    ally: s.myTeam.map((c) => {
      const champion = locked(c);
      const local = c.cellId === s.localPlayerCellId;
      return {
        cell: c.cellId,
        position: POSITION[c.assignedPosition] ?? null,
        champion,
        picking: picking(c.cellId),
        hover: champion ? null : champ(pick(c.cellId, false)?.championId) ?? champ(c.championPickIntent) ?? champ(c.championId),
        riotId: riotIdOf(c) ?? (local ? localRiotId : null),
        local
      };
    }),
    // Les survols ennemis ne sont pas visibles : seuls les picks verrouillés comptent.
    enemy: s.theirTeam.map((c) => ({ cell: c.cellId, position: POSITION[c.assignedPosition] ?? null, champion: locked(c), picking: picking(c.cellId) })),
    allyBans: banned(true),
    enemyBans: banned(false)
  };
};

/** Riot ID du joueur local (GET /lol-summoner/v1/current-summoner). */
export const riotIdOfSummoner = (raw: unknown): string | null => {
  const r = z.object({ gameName: z.string().optional(), tagLine: z.string().optional() }).safeParse(raw);
  return r.success && r.data.gameName && r.data.tagLine ? r.data.gameName + '#' + r.data.tagLine : null;
};
