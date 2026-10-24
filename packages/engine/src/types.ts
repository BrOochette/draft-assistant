import type { Damage, Note, Role, Scaling, Trait } from '@draft/schemas';

export type PoolStatus = 'in' | 'out' | 'all';

/** Champion prêt à évaluer sur un rôle : attributs, stats et statut dans le pool du joueur. */
export interface Entry {
  name: string;
  /** Rôle sur lequel le champion est joué. */
  role: Role;
  damage: Damage;
  provides: Trait[];
  scaling: Scaling;
  synergyBase: number;
  laneWinRate: number | null;
  gameWinRate: number;
  games: number;
  notes: Note[];
  pool: PoolStatus;
  /** Maîtrise sur 100 (note × 10), 0 hors pool, null sans pool. */
  mastery: number | null;
  /** Adversaire de lane vers [win rate, parties]. */
  matchups?: Record<string, [number, number]>;
  /** Rôle de l'allié, puis allié vers [écart de win rate en duo, parties]. */
  duos?: Partial<Record<Role, Record<string, [number, number]>>>;
  /** Rôle de l'ennemi (autre lane), puis ennemi vers [win rate, parties]. */
  crossMatchups?: Partial<Record<Role, Record<string, [number, number]>>>;
  /** Part des parties du champion jouées sur ce rôle (%), null si inconnue. */
  laneShare: number | null;
  /** Parties fictives à 50 % pour lisser le win rate dans le counter (0 : pas de lissage). */
  priorGames: number;
  /** Stats mesurées (Lolalytics) : le classement suit le win rate attendu. */
  measured: boolean;
  /** Moyenne de la paire de classes principales avec un autre champion, null sans prior. */
  classPrior: (kind: 'duo' | 'matchup', otherRole: Role, other: string) => ClassPriorUsed | null;
}

/** Moyenne de paire de classes vers laquelle un matchup ou un duo est lissé. */
export interface ClassPriorUsed {
  /** Classe de ce champion, puis celle de l'autre. */
  classes: [string, string];
  /** Écart moyen en points de win rate. */
  delta: number;
  games: number;
}

/** Effet d'un ennemi connu sur le win rate attendu. */
export interface EnemyEffect {
  opponent: string;
  role: Role;
  /** Adversaire de lane (vis-à-vis). */
  lane: boolean;
  /** Poids par rapport au vis-à-vis (1). */
  weight: number;
  /** Win rate mesuré de ce champion contre lui, null sans partie. */
  winRate: number | null;
  games: number;
  prior: ClassPriorUsed | null;
  /** Écart en points, lissé vers la moyenne de classe, avant poids. */
  delta: number;
}

/** Effet d'un allié verrouillé (duo) sur le win rate attendu. */
export interface AllyEffect {
  ally: string;
  role: Role;
  weight: number;
  /** Écart de win rate en duo mesuré, null sans partie. */
  raw: number | null;
  games: number;
  prior: ClassPriorUsed | null;
  /** Écart en points, lissé vers la moyenne de classe, avant poids. */
  delta: number;
}

/** Win rate attendu (stats mesurées), en % et en points. */
export interface Expected {
  /** Win rate du champion sur le rôle, lissé vers 50 %. */
  base: number;
  matchups: number;
  duos: number;
  mastery: number;
  /** Total selon le mode du rôle : tout (mix), sans matchups (synergie) ou sans duos (counter). */
  score: number;
}

/** Ce qu'un pick apporte à une compo. */
export interface CompMember {
  name: string;
  damage: Damage;
  provides: Trait[];
  scaling: Scaling;
}

/** Ce qui classe les suggestions : synergie, counter, ou le mélange des deux. */
export type SuggestionMode = 'mix' | 'synergy' | 'counter';

export interface ScoringOptions {
  /** Absent : « mix » (avec les données d'exemple, poids de la maquette). */
  mode?: SuggestionMode;
  /** Mode propre à un rôle ; absent pour un rôle : `mode`. */
  modeByRole?: Partial<Record<Role, SuggestionMode>>;
}

export type Phase = 0 | 1 | 2;
export const PHASES: readonly Phase[] = [0, 1, 2];

export type Reason =
  | { sign: '+'; code: 'PROVIDES'; trait: Trait }
  | { sign: '-'; code: 'COVERED'; trait: Trait; by: string }
  | { sign: '+' | '-'; code: 'DUO'; ally: string; delta: number }
  | { sign: '-'; code: 'EXTRA_AP'; n: number }
  | { sign: '+'; code: 'SCALING_STRONG'; phase: Phase }
  | { sign: '-'; code: 'SCALING_WEAK'; phase: Phase }
  | { sign: '+' | '-'; code: 'NOTE'; text: string }
  | { sign: '-'; code: 'OUTSCALED' }
  | { sign: '+'; code: 'BETTER_IN_GAME' }
  | { sign: '+'; code: 'MASTERY_HIGH' }
  | { sign: '-'; code: 'MASTERY_LOW' }
  | { sign: '-'; code: 'OUT_OF_POOL'; player: string }
  | { sign: '-'; code: 'LOW_SAMPLE'; games: number };

export interface Evaluation {
  champion: string;
  pool: PoolStatus;
  synergy: number;
  counter: number;
  mastery: number | null;
  total: number;
  /** Note de compo avec ce pick moins la note sans lui. */
  compoDelta: number;
  /** Les + puis les -, liste complète. */
  reasons: Reason[];
  games: number;
  lowSample: boolean;
  laneWinRate: number | null;
  gameWinRate: number;
  /** Effet de l'adversaire de lane, s'il est connu (aussi en tête de `enemyTeam`). */
  matchup: EnemyEffect | null;
  /** Effets des ennemis connus : vis-à-vis en tête, puis les autres lanes. */
  enemyTeam: EnemyEffect[];
  /** Effets des alliés verrouillés (duos). */
  allyTeam: AllyEffect[];
  /** Win rate attendu, avec des stats mesurées ; null avec les données d'exemple. */
  expected: Expected | null;
  /** Part des parties du champion jouées sur ce rôle (%), null si inconnue. */
  laneShare: number | null;
  scaling: Scaling;
}

export type CriterionKey = 'frontline' | 'engage' | 'peel' | 'damageMix' | 'scaling';
export interface Criterion {
  key: CriterionKey;
  value: number;
  weight: number;
}
export type Verdict = 'solid' | 'fair' | 'fragile' | 'fix';
export interface CompScore {
  total: number;
  criteria: Criterion[];
}

export type RecNote = 'POOL' | 'NO_POOL' | 'POOL_EXHAUSTED';

export interface LockedResult extends Evaluation {
  /** Notes du matchup direct, null si la paire n'a pas de notes. */
  matchupNotes: Note[] | null;
  /** Notes de compo propres au champion, null s'il n'en a pas. */
  info: Note[] | null;
}

export interface RoleResult {
  role: Role;
  /** null : aucun joueur placé sur le rôle. */
  player: string | null;
  hasPool: boolean;
  multiRole: boolean;
  allyPick: string | null;
  enemyPick: string | null;
  locked: LockedResult | null;
  /** Les 3 meilleurs : du pool, ou hors pool si aucun champion du pool n'est disponible. */
  recommendations: Evaluation[];
  /** Liste complète : pool (ou, sans pool, les champions dont c'est un rôle principal), puis hors pool. */
  inPool: Evaluation[];
  outOfPool: Evaluation[];
  /** Sans pool : champions pour qui ce rôle est secondaire (moins de MAIN_ROLE_SHARE % de leurs parties), non classés. */
  secondaryRole: Evaluation[];
  note: RecNote | null;
}

export type ScalingVerdict = 'advantage' | 'even' | 'disadvantage';
export interface PhaseResult {
  phase: Phase;
  ally: number;
  enemy: number;
  verdict: ScalingVerdict;
}

export type AllyReadItem =
  | { sign: '+'; code: 'HAS_TRAIT'; trait: Trait; by: string }
  | { sign: '-'; code: 'MISSING_TRAIT'; trait: Trait }
  | { sign: '-'; code: 'MAGIC_HEAVY'; ap: number; total: number }
  | { sign: '+'; code: 'MIXED_DAMAGE'; ap: number; total: number }
  | { sign: '+'; code: 'SCALING_ADVANTAGE'; phase: Phase }
  | { sign: '-'; code: 'SCALING_DISADVANTAGE'; phase: Phase };

export type EnemyReadItem =
  | { code: 'ENEMY_FRONTLINE'; names: string[] }
  | { code: 'ENEMY_ENGAGE'; names: string[] }
  | { code: 'ENEMY_MAGIC'; names: string[] }
  | { code: 'ENEMY_PHYSICAL'; names: string[] }
  | { code: 'ENEMY_LATE' }
  | { code: 'ENEMY_EARLY' }
  | { code: 'ENEMY_UNKNOWN'; roles: Role[] };

export type TeamNote =
  | { code: 'NO_POOL'; player: string; role: Role }
  | { code: 'MULTI_ROLE'; player: string; roles: Role[] };

export interface BanCard {
  champion: string;
  role: Role;
  /** Score de menace sur 100 (données d'exemple), ou valeur du ban en points de win rate (stats mesurées). */
  threat: number;
  /** Raison rédigée (données d'exemple), sinon l'interface affiche le win rate. */
  reason?: string;
  winRate?: number;
  /** Stats mesurées : ce que le ban nous rapporte, en points de win rate attendu. */
  impact?: BanImpact;
}

/** Valeur d'un ban = force du champion (win rate lissé − 50) + baisse de notre meilleur pick s'il est le vis-à-vis. */
export interface BanImpact {
  value: number;
  /** Win rate lissé du champion moins 50. */
  strength: number;
  /** Baisse du meilleur win rate attendu de nos options du rôle s'il est le vis-à-vis. */
  drop: number;
  /** Notre meilleure option avant ce pick ennemi, null sans option. */
  ours: string | null;
}

/** Champions d'une compo regroupés par archétype (d'après leur classe principale). */
export interface ArchetypeGroup {
  archetype: Archetype;
  names: string[];
}
export type Archetype = 'dive' | 'engage' | 'poke' | 'protect' | 'pick' | 'teamfight' | 'split';

export interface DraftResult {
  roles: RoleResult[];
  composition: {
    ally: CompScore & { verdict: Verdict };
    enemy: CompScore & { verdict: Verdict };
  };
  scaling: PhaseResult[];
  allyRead: AllyReadItem[];
  enemyRead: EnemyReadItem[];
  team: TeamNote[];
  bans: { suggestions: BanCard[]; allyFull: boolean };
  /** Archétypes de chaque compo (au moins 2 champions du même archétype), avec des classes connues. */
  archetypes: { ally: ArchetypeGroup[]; enemy: ArchetypeGroup[] };
}
