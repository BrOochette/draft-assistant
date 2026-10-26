import { z } from 'zod';

export const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'] as const;
export const RoleSchema = z.enum(ROLES);
export type Role = z.infer<typeof RoleSchema>;

export const DamageSchema = z.enum(['AP', 'AD', 'TANK']);
export type Damage = z.infer<typeof DamageSchema>;

/** « Physique » est l'apport implicite d'un champion AD (dégâts physiques). */
export const TRAITS = ['Frontline', 'Engage', 'Peel', 'Physique'] as const;
export const TraitSchema = z.enum(TRAITS);
export type Trait = z.infer<typeof TraitSchema>;

const level = z.number().multipleOf(0.5).min(1).max(5);
export const ScalingSchema = z.tuple([level, level, level]);
/** Puissance au début, au milieu et en fin de partie, de 1 à 5 par demi-point (10 niveaux, affichés sur 10). */
export type Scaling = z.infer<typeof ScalingSchema>;

export const NoteSchema = z.object({ sign: z.enum(['+', '-']), text: z.string().min(1) });
export type Note = z.infer<typeof NoteSchema>;

export const ChampionSchema = z.object({
  name: z.string().min(1),
  damage: DamageSchema,
  provides: z.array(TraitSchema),
  scaling: ScalingSchema,
  roles: z.array(RoleSchema).min(1),
  ddragonId: z.string().min(1),
  /** Identifiant numérique Riot (aussi utilisé par Lolalytics). Absent des données d'exemple. */
  key: z.number().int().positive().optional(),
  /** Classes Riot (Diver, Vanguard…), la première est la classe principale. Absentes des données d'exemple. */
  classes: z.array(z.string()).optional(),
  /** Dégâts soutenus fixés à la main (corrections) ; absent : déduits de la classe principale. */
  sustained: z.boolean().optional()
});
export type Champion = z.infer<typeof ChampionSchema>;

/**
 * Attributs maison d'un champion (`data/champions.json`), amorcés depuis le wiki puis corrigeables à la main.
 * Le scaling n'y figure pas : il est mesuré par patch. `provides` ne contient pas l'apport implicite « Physique ».
 */
export const ChampionAttributesSchema = ChampionSchema.omit({ scaling: true }).extend({
  key: z.number().int().positive(),
  /** Classes Riot d'après le wiki (Vanguard, Enchanter…), pour référence. */
  classes: z.array(z.string())
});
export type ChampionAttributes = z.infer<typeof ChampionAttributesSchema>;

/** Corrections manuelles par nom de champion (`data/champions-overrides.json`). */
export const ChampionOverridesSchema = z.record(
  z.string(),
  z
    .object({ damage: DamageSchema.optional(), provides: z.array(TraitSchema).optional(), roles: z.array(RoleSchema).min(1).optional(), sustained: z.boolean().optional() })
    .strict()
);
export type ChampionOverrides = z.infer<typeof ChampionOverridesSchema>;

/** [win rate en %, nombre de parties]. */
const rateSample = z.tuple([z.number().min(0).max(100), z.number().int().nonnegative()]);
/** [écart de win rate en points, nombre de parties]. */
const deltaSample = z.tuple([z.number(), z.number().int().nonnegative()]);

/**
 * Stats d'un champion sur un rôle. Les attributs (apports, scaling, dégâts) sont ceux du candidat
 * et priment sur le catalogue. L'ordre de `provides` est conservé : il fixe l'ordre des raisons.
 */
export const CandidateSchema = z.object({
  name: z.string().min(1),
  games: z.number().int().nonnegative(),
  synergyBase: z.number(),
  /** null : win rate de lane indisponible (source sans données de lane). */
  laneWinRate: z.number().min(0).max(100).nullable(),
  gameWinRate: z.number().min(0).max(100),
  scaling: ScalingSchema,
  provides: z.array(TraitSchema),
  damage: DamageSchema,
  notes: z.array(NoteSchema),
  /** Win rate de partie de ce champion contre chaque adversaire de la même lane. */
  matchups: z.record(z.string(), rateSample).optional(),
  /** Écart de win rate en duo avec chaque allié, par rôle de l'allié. */
  duos: z.record(RoleSchema, z.record(z.string(), deltaSample)).optional(),
  /** Part des parties du champion jouées sur ce rôle, en %. Absente : rôle principal supposé. */
  laneShare: z.number().min(0).max(100).optional(),
  /** Rôle de l'ennemi (autre lane), puis ennemi vers [win rate de ce champion, parties]. */
  crossMatchups: z.record(RoleSchema, z.record(z.string(), rateSample)).optional()
});
export type Candidate = z.infer<typeof CandidateSchema>;

export const CandidatesSchema = z.record(RoleSchema, z.array(CandidateSchema));
export type Candidates = Partial<Record<Role, Candidate[]>>;

export const PoolEntrySchema = z.object({
  champion: z.string().min(1),
  mastery: z.number().int().min(1).max(10)
});
export type PoolEntry = z.infer<typeof PoolEntrySchema>;

export const PlayerPoolsSchema = z.record(RoleSchema, z.array(PoolEntrySchema));
export type PlayerPools = Partial<Record<Role, PoolEntry[]>>;

/** Joueur vers pools par rôle. L'ordre des clés est l'ordre d'affichage des joueurs. */
export const PoolsSchema = z.record(z.string().min(1), PlayerPoolsSchema);
export type Pools = Record<string, PlayerPools>;

export const BanSuggestionSchema = z.object({
  champion: z.string().min(1),
  role: RoleSchema,
  threat: z.number(),
  /** Raison rédigée (données d'exemple). Sinon l'interface affiche le win rate. */
  reason: z.string().optional(),
  winRate: z.number().optional()
});
export type BanSuggestion = z.infer<typeof BanSuggestionSchema>;

export const MatchupNotesSchema = z.object({
  /** Clé « Allié|Ennemi ». */
  matchups: z.record(z.string(), z.array(NoteSchema)),
  /** Lecture d'un pick pour la compo, par champion. */
  fixedInfo: z.record(z.string(), z.array(NoteSchema))
});
export type MatchupNotes = z.infer<typeof MatchupNotesSchema>;

const slot = z.string().min(1).nullable();
const roleSlots = z.object({ Top: slot, Jungle: slot, Mid: slot, ADC: slot, Support: slot });
export type RoleSlots = Record<Role, string | null>;

export const DraftStateSchema = z.object({
  /** Joueur placé sur chaque rôle, null si aucun (tous les champions du rôle sont alors classés, sans maîtrise). */
  assign: z.object({ Top: z.string().nullable(), Jungle: z.string().nullable(), Mid: z.string().nullable(), ADC: z.string().nullable(), Support: z.string().nullable() }),
  ally: roleSlots,
  enemy: roleSlots,
  allyBans: z.array(z.string()).max(5),
  enemyBans: z.array(z.string()).max(5)
});
export type DraftState = z.infer<typeof DraftStateSchema>;

/** Format de `data/sample/initial-draft-state.json` (picks ouverts et picks fixes séparés). */
export const SampleDraftStateSchema = z.object({
  assign: DraftStateSchema.shape.assign,
  picks: z.record(RoleSchema, slot),
  fixedPicks: z.record(RoleSchema, slot),
  enemy: roleSlots,
  allyBans: z.array(z.string()),
  enemyBans: z.array(z.string())
});
export type SampleDraftState = z.infer<typeof SampleDraftStateSchema>;

/**
 * Moyennes par paire « rôle|classe|rôle de l'autre|classe de l'autre » : [écart en points, parties].
 * Duo : écart de win rate en duo. Matchup : win rate contre l'ennemi moins win rate du champion.
 */
export const ClassPriorsSchema = z.object({
  duo: z.record(z.string(), deltaSample),
  matchup: z.record(z.string(), deltaSample)
});
export type ClassPriors = z.infer<typeof ClassPriorsSchema>;

export const StatsSnapshotSchema = z.object({
  version: z.literal(1),
  /** Origine des stats : données d'exemple de la maquette ou collecte Lolalytics. */
  source: z.enum(['sample', 'lolalytics']),
  patch: z.string(),
  rank: z.string(),
  /** Région des stats (« EUW »…), absente : toutes régions. */
  region: z.string().optional(),
  /** Région des matchups et des duos si elle diffère (« all » : toutes régions). */
  pairRegion: z.string().optional(),
  ddragonVersion: z.string(),
  champions: z.array(ChampionSchema),
  candidates: CandidatesSchema,
  matchupNotes: MatchupNotesSchema,
  banSuggestions: z.array(BanSuggestionSchema),
  /** Parties fictives à 50 % ajoutées au win rate de chaque candidat pour le counter (0 ou absent : pas de lissage). */
  winRatePriorGames: z.number().int().nonnegative().optional(),
  /** Moyennes par paire de classes principales, vers lesquelles un matchup ou un duo peu joué est lissé. */
  classPriors: ClassPriorsSchema.optional()
});
export type StatsSnapshot = z.infer<typeof StatsSnapshotSchema>;

/** Assemble un snapshot à partir des fichiers bruts de `data/sample/`, validés au passage. */
export const assembleSampleSnapshot = (raw: {
  champions: unknown;
  candidates: unknown;
  matchupNotes: unknown;
  banSuggestions: unknown;
}): StatsSnapshot =>
  StatsSnapshotSchema.parse({
    version: 1,
    source: 'sample',
    patch: '26.21',
    rank: 'Emerald+',
    ddragonVersion: '16.21.1',
    champions: raw.champions,
    candidates: raw.candidates,
    matchupNotes: raw.matchupNotes,
    banSuggestions: raw.banSuggestions
  });

export const emptySlots = (): RoleSlots => ({ Top: null, Jungle: null, Mid: null, ADC: null, Support: null });

/** Un champion AD apporte implicitement « Physique », ajouté en fin de liste comme dans la maquette. */
export const normalizeChampion = (c: Champion): Champion =>
  c.damage === 'AD' && !c.provides.includes('Physique') ? { ...c, provides: [...c.provides, 'Physique'] } : c;

/** Convertit l'état d'exemple de la maquette : picks fixes et picks ouverts deviennent les picks alliés. */
export const fromSampleDraftState = (s: SampleDraftState): DraftState => {
  const ally = emptySlots();
  for (const role of ROLES) ally[role] = s.fixedPicks[role] ?? s.picks[role] ?? null;
  return {
    assign: { ...s.assign },
    ally,
    enemy: { ...s.enemy },
    allyBans: [...s.allyBans],
    enemyBans: [...s.enemyBans]
  };
};

/**
 * Sélection des champions lue dans le client LoL par le pont local (`apps/bridge`), déjà simplifiée.
 * Les champions sont des identifiants numériques Riot (`key` du catalogue).
 */
const clientCell = z.object({
  cell: z.number().int(),
  /** Rôle attribué par le client, null s'il n'y en a pas (blind pick, partie personnalisée, ennemis). */
  position: RoleSchema.nullable(),
  /** Champion verrouillé, null sinon. */
  champion: z.number().int().positive().nullable(),
  /** Ce joueur est en train de choisir son champion. */
  picking: z.boolean().default(false)
});
export const ClientDraftSchema = z.object({
  /** Change à chaque nouvelle sélection des champions. */
  gameId: z.number().int(),
  phase: z.enum(['planning', 'banPick', 'finalization', 'starting']),
  /** Bans encore attendus : le client ne distingue pas la phase de bans de celle des picks (BAN_PICK pour les deux). */
  bansPending: z.boolean().default(false),
  /** Side de ton équipe (bleu ou rouge), null s'il est inconnu. */
  side: z.enum(['blue', 'red']).nullable().default(null),
  ally: z.array(
    clientCell.extend({
      /** Champion survolé sans être verrouillé. */
      hover: z.number().int().positive().nullable(),
      /** Riot ID « Nom#TAG », null s'il est masqué par le client. */
      riotId: z.string().nullable(),
      local: z.boolean()
    })
  ),
  enemy: z.array(clientCell),
  allyBans: z.array(z.number().int().positive()),
  enemyBans: z.array(z.number().int().positive())
});
export type ClientDraft = z.infer<typeof ClientDraftSchema>;

/** Messages du pont local vers l'appli. */
export const BridgeMessageSchema = z.discriminatedUnion('type', [
  /** Client LoL ouvert ou fermé. */
  /** Client LoL ouvert ou fermé ; `version` : version du protocole du pont (absente : pont antérieur). */
  z.object({ type: z.literal('client'), connected: z.boolean(), version: z.number().int().optional() }),
  /** Sélection des champions en cours, null en dehors. */
  z.object({ type: z.literal('champSelect'), draft: ClientDraftSchema.nullable() })
]);
export type BridgeMessage = z.infer<typeof BridgeMessageSchema>;

/** Port local du pont, côté appli et côté pont. */
export const BRIDGE_PORT = 52147;

/**
 * Version du protocole du pont, à augmenter quand le pont transmet une nouvelle information. L'appli signale un pont
 * d'une autre version (lancé avant une mise à jour) : il faut le relancer.
 * 2 : phase de bans, side et joueurs en train de choisir.
 */
export const BRIDGE_VERSION = 2;

/** Joueur vers Riot ID « Nom#TAG », pour le placer sur son rôle pendant une draft en direct. */
export const RiotIdsSchema = z.record(z.string().min(1), z.string());
export type RiotIds = Record<string, string>;

/** Riot ID comparable : sans espaces autour, sans casse. */
export const normalizeRiotId = (id: string): string => id.trim().toLowerCase();

/**
 * Fichier de partage de la liste des joueurs (export et import, écran Joueurs) : chaque joueur avec son Riot ID et ses
 * pools par rôle, dans l'ordre d'affichage.
 */
export const PLAYERS_FILE_KIND = 'draft-assistant/joueurs';
export const PlayersFileSchema = z.object({
  kind: z.literal(PLAYERS_FILE_KIND),
  version: z.literal(1),
  exportedAt: z.string(),
  players: z.array(
    z.object({
      name: z.string().trim().min(1),
      riotId: z.string().optional(),
      pools: PlayerPoolsSchema
    })
  )
});
export type PlayersFile = z.infer<typeof PlayersFileSchema>;
