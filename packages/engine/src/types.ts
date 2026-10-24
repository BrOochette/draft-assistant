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
}

/** Matchup contre un ennemi d'une autre lane, et son poids dans le counter. */
export interface EnemyTeamMatchup extends MatchupStat {
  role: Role;
  weight: number;
  /** Écart, en points, entre le win rate lissé contre lui et le win rate général lissé du champion. */
  delta: number;
}

/** Win rate mesuré contre l'adversaire de lane connu. */
export interface MatchupStat {
  opponent: string;
  winRate: number;
  games: number;
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
  /** Absent : « mix » avec les poids de la maquette. */
  mode?: SuggestionMode;
  /**
   * En « mix », part du counter dans (synergie + counter) quand l'adversaire de lane est connu, par rôle.
   * Absente pour un rôle : poids de la maquette.
   */
  laneCounterWeight?: Partial<Record<Role, number>>;
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
  /** Matchup contre l'adversaire de lane, s'il est connu et mesuré. */
  matchup: MatchupStat | null;
  /** Matchups pris en compte contre les ennemis des autres lanes. */
  enemyTeam: EnemyTeamMatchup[];
  /** Effet total de ces matchups sur le win rate du counter, en points (pondéré). */
  enemyTeamDelta: number;
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
  threat: number;
  /** Raison rédigée (données d'exemple), sinon l'interface affiche le win rate. */
  reason?: string;
  winRate?: number;
}

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
}
