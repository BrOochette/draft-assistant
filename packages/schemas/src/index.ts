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

const level = z.number().int().min(1).max(5);
export const ScalingSchema = z.tuple([level, level, level]);
/** Puissance au début, au milieu et en fin de partie, de 1 à 5. */
export type Scaling = z.infer<typeof ScalingSchema>;

export const NoteSchema = z.object({ sign: z.enum(['+', '-']), text: z.string().min(1) });
export type Note = z.infer<typeof NoteSchema>;

export const ChampionSchema = z.object({
  name: z.string().min(1),
  damage: DamageSchema,
  provides: z.array(TraitSchema),
  scaling: ScalingSchema,
  roles: z.array(RoleSchema).min(1),
  ddragonId: z.string().min(1)
});
export type Champion = z.infer<typeof ChampionSchema>;

/**
 * Stats d'un champion sur un rôle. Les attributs (apports, scaling, dégâts) sont ceux du candidat
 * et priment sur le catalogue. L'ordre de `provides` est conservé : il fixe l'ordre des raisons.
 */
export const CandidateSchema = z.object({
  name: z.string().min(1),
  games: z.number().int().nonnegative(),
  synergyBase: z.number(),
  laneWinRate: z.number().min(0).max(100),
  gameWinRate: z.number().min(0).max(100),
  scaling: ScalingSchema,
  provides: z.array(TraitSchema),
  damage: DamageSchema,
  notes: z.array(NoteSchema)
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
  reason: z.string()
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
  assign: z.object({ Top: z.string(), Jungle: z.string(), Mid: z.string(), ADC: z.string(), Support: z.string() }),
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

export const StatsSnapshotSchema = z.object({
  version: z.literal(1),
  patch: z.string(),
  rank: z.string(),
  ddragonVersion: z.string(),
  champions: z.array(ChampionSchema),
  candidates: CandidatesSchema,
  matchupNotes: MatchupNotesSchema,
  banSuggestions: z.array(BanSuggestionSchema)
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
    patch: '26.21',
    rank: 'Emerald+',
    ddragonVersion: '16.21.1',
    champions: raw.champions,
    candidates: raw.candidates,
    matchupNotes: raw.matchupNotes,
    banSuggestions: raw.banSuggestions
  });

export const emptySlots =(): RoleSlots => ({ Top: null, Jungle: null, Mid: null, ADC: null, Support: null });

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
