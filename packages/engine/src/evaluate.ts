import { ROLES, type Role, type Trait } from '@draft/schemas';
import { compScore } from './composition';
import { avgScal, clamp, wrScore } from './math';
import type { AllyEffect, CompMember, EnemyEffect, Entry, Evaluation, Expected, Phase, Points, Reason, ScoringOptions, SuggestionMode } from './types';

export const SYNERGY_BONUS: Record<Trait, number> = { Frontline: 12, Engage: 10, Physique: 10, Peel: 6 };
/** Points sur 20 d'un trait que la compo n'a pas encore. */
export const FIT_BONUS: Record<Trait, number> = { Frontline: 0.5, Engage: 0.5, Physique: 0.5, Peel: 0.25 };
/**
 * Porteurs d'un même trait sans malus : deux tanks, deux engages ou deux sources de dégâts magiques restent sains. Les
 * dégâts physiques n'ont pas de malus : une compo à un seul AP (quatre AD) est courante.
 */
export const REDUNDANCY_FREE = 2;
/** Malus d'un porteur au-delà de REDUNDANCY_FREE, multiplié par le rang (3e : 1 fois, 4e : 2 fois…), en points sur 20. */
export const REDUNDANCY_POINTS = 0.5;
/** Même malus en points de synergie de la maquette (données d'exemple). */
const REDUNDANCY_SYN = 3;
/** Points sur 20 par frontline ennemie (2 au plus) quand ta compo n'a pas encore de dégâts soutenus. */
export const SUSTAINED_POINTS = 0.5;
/** Picks alliés déjà là à partir desquels un pick sans dégâts soutenus prend le malus (il reste peu de rôles pour en apporter). */
export const SUSTAINED_LATE = 3;

/** Points sur 20 par point de win rate attendu : 50 % vaut 10, 60 % vaut 20, sans plafond atteint en pratique. */
export const POINTS_PER_WR = 1;
export const LOW_SAMPLE_GAMES = 500;
/** Parties « fictives » à la moyenne de la paire de classes, pour lisser un duo peu joué. */
const DUO_PRIOR_GAMES = 200;
/** Parties « fictives » à la moyenne de la paire de classes, pour lisser un matchup peu joué. */
const MATCHUP_PRIOR_GAMES = 1000;
/** Points de synergie par point d'écart moyen de win rate en duo (score sur 100 de la maquette). */
export const DUO_WEIGHT = 4;
/** Écart de duo (lissé) à partir duquel une raison est affichée. */
const DUO_REASON_MIN = 1;
/** Points de win rate attendu par point de maîtrise au-dessus de 5 (note 10 : +2, note 1 : −1,6, hors pool : −2). */
export const MASTERY_POINT = 0.4;

/** Mode de suggestion d'un rôle. */
export const modeOf = (role: Role, { mode = 'mix', modeByRole }: ScoringOptions): SuggestionMode => modeByRole?.[role] ?? mode;

/** Score sur 100 de la maquette (données d'exemple). La maîtrise compte pour 25 % avec un pool ; le reste dépend du mode. */
export const totalScore = (syn: number, ctr: number, mastery: number | null, role: Role, options: ScoringOptions): number => {
  const mode = modeOf(role, options);
  const withMastery = (v: number) => (mastery == null ? Math.round(v) : Math.round(v * 0.75 + mastery * 0.25));
  if (mode === 'synergy') return withMastery(syn);
  if (mode === 'counter') return withMastery(ctr);
  return mastery == null ? Math.round(syn * 0.55 + ctr * 0.45) : Math.round(syn * 0.4 + ctr * 0.35 + mastery * 0.25);
};

const isBotPair = (a: Role, b: Role) => (a === 'ADC' && b === 'Support') || (a === 'Support' && b === 'ADC');

/**
 * Poids d'un ennemi d'une autre lane par rapport au vis-à-vis (1) : un quart, sauf en botlane où l'ADC
 * et le support ennemis jouent la même lane à deux (trois quarts).
 */
export const otherEnemyWeight = (role: Role, enemyRole: Role): number => (isBotPair(role, enemyRole) ? 0.75 : 0.25);

/** Poids d'un duo allié : entier entre ADC et support, la moitié sinon (provisoire). */
export const allyWeight = (role: Role, allyRole: Role): number => (isBotPair(role, allyRole) ? 1 : 0.5);

const smooth = (value: number, games: number, prior: number, priorGames: number) => (value * games + prior * priorGames) / (games + priorGames);

/**
 * Effets des ennemis connus, vis-à-vis en tête : écart entre le win rate de ce champion contre eux et son win
 * rate, lissé vers la moyenne de la paire de classes. Sans aucune donnée (données d'exemple), pas de ligne.
 */
const enemyEffects = (c: Entry, foes: Partial<Record<Role, string | null>>): EnemyEffect[] => {
  const out: EnemyEffect[] = [];
  for (const role of [c.role, ...ROLES.filter((r) => r !== c.role)]) {
    const name = foes[role];
    const effect = name ? matchupEffect(c, role, name) : null;
    if (effect) out.push(effect);
  }
  return out;
};

/**
 * Effet d'un ennemi `name` joué en `role` sur le champion `c` : écart lissé vers la moyenne de la paire de classes.
 * null sans aucune donnée avec les données d'exemple.
 */
export const matchupEffect = (c: Entry, role: Role, name: string): EnemyEffect | null => {
  const lane = role === c.role;
  const m = lane ? c.matchups?.[name] : c.crossMatchups?.[role]?.[name];
  const prior = c.classPrior('matchup', role, name);
  if (!m && !prior && !c.measured) return null;
  const games = m?.[1] ?? 0;
  const delta = smooth(m ? m[0] - c.gameWinRate : 0, games, prior?.delta ?? 0, MATCHUP_PRIOR_GAMES);
  return { opponent: name, role, lane, weight: lane ? 1 : otherEnemyWeight(c.role, role), winRate: m?.[0] ?? null, games, prior, delta };
};

/** Effets des alliés verrouillés : écart de win rate en duo, lissé vers la moyenne de la paire de classes. */
const allyEffects = (c: Entry, ctx: readonly Entry[]): AllyEffect[] => {
  const out: AllyEffect[] = [];
  for (const x of ctx) {
    const d = c.duos?.[x.role]?.[x.name];
    const prior = c.classPrior('duo', x.role, x.name);
    if (!d && !prior && !c.measured) continue;
    const games = d?.[1] ?? 0;
    const delta = smooth(d?.[0] ?? 0, games, prior?.delta ?? 0, DUO_PRIOR_GAMES);
    out.push({ ally: x.name, role: x.role, weight: allyWeight(c.role, x.role), raw: d?.[0] ?? null, games, prior, delta });
  }
  return out;
};

/** Note bornée à 0..20. */
export const boundPoints = (raw: number): number => Math.max(0, Math.min(20, raw));

/** Note sur 20 d'un win rate seul (repère d'un rôle sans pick connu). */
export const pointsOfWr = (wr: number): number => boundPoints(10 + (wr - 50) * POINTS_PER_WR);

const weighted = (rows: readonly { weight: number; delta: number }[]) => rows.reduce((s, r) => s + r.weight * r.delta, 0);

/**
 * Évalue un candidat face au contexte allié `ctx` (les autres picks) et aux ennemis connus.
 * Avec des stats mesurées, le classement suit le win rate attendu : win rate lissé du champion, plus les écarts
 * pondérés des matchups et des duos, plus la maîtrise. Avec les données d'exemple, c'est le portage ligne par ligne
 * de `evalChamp` (maquette Draft v2) : ordre des opérations et arrondis identiques.
 */
export const evaluate = (
  c: Entry,
  ctx: readonly Entry[],
  enemies: readonly CompMember[],
  player: string | null,
  /** Picks ennemis connus par rôle : le vis-à-vis et, avec moins de poids, les autres lanes. */
  foes: Partial<Record<Role, string | null>> = {},
  options: ScoringOptions = {}
): Evaluation => {
  const apCount = ctx.filter((x) => x.damage === 'AP').length;
  const a = avgScal(ctx);
  const e = avgScal(enemies);
  const diff = [a[0] - e[0], a[1] - e[1], a[2] - e[2]] as const;
  let wi: Phase = 0;
  for (const i of [0, 1, 2] as const) if (diff[i] < diff[wi]) wi = i;
  const needScal: Phase | null = diff[wi] <= -0.5 ? wi : null;

  let syn = c.synergyBase;
  // Apport à la compo en points sur 20 (stats mesurées).
  let fit = 0;
  const reasons: Reason[] = [];
  for (const g of c.provides) {
    const holders = ctx.filter((x) => x.provides.includes(g)).map((x) => x.name);
    if (!holders.length) {
      syn += SYNERGY_BONUS[g];
      fit += FIT_BONUS[g];
      reasons.push({ sign: '+', code: 'PROVIDES', trait: g });
    } else if (holders.length >= REDUNDANCY_FREE && g !== 'Physique') {
      const k = holders.length - REDUNDANCY_FREE + 1;
      syn -= REDUNDANCY_SYN * k;
      fit -= REDUNDANCY_POINTS * k;
      reasons.push({ sign: '-', code: 'REDUNDANT', trait: g, n: holders.length + 1, by: holders });
    }
  }
  const allyTeam = allyEffects(c, ctx);
  // Score de la maquette : moyenne des duos mesurés, en points de synergie.
  const measuredDuos = allyTeam.filter((d) => d.raw != null);
  if (measuredDuos.length) {
    syn += Math.round((DUO_WEIGHT * measuredDuos.reduce((s, d) => s + d.delta, 0)) / measuredDuos.length);
    for (const d of measuredDuos) {
      if (Math.abs(d.delta) >= DUO_REASON_MIN) reasons.push({ sign: d.delta > 0 ? '+' : '-', code: 'DUO', ally: d.ally, delta: d.delta });
    }
  }
  if (c.damage === 'AP' && apCount >= REDUNDANCY_FREE) {
    const k = apCount - REDUNDANCY_FREE + 1;
    syn -= 4 * k;
    fit -= REDUNDANCY_POINTS * k;
    reasons.push({ sign: '-', code: 'EXTRA_AP', n: apCount + 1 });
  }
  if (needScal !== null) {
    const v = c.scaling[needScal];
    syn += (v - 3) * 4;
    fit += (v - 3) * 0.2;
    if (v >= 4) reasons.push({ sign: '+', code: 'SCALING_STRONG', phase: needScal });
    else if (v <= 2) reasons.push({ sign: '-', code: 'SCALING_WEAK', phase: needScal });
  }
  // Dégâts soutenus face à une frontline ennemie (stats mesurées) : bonus au pick qui en apporte quand la compo n'en a
  // pas, malus aux derniers picks qui n'en apportent pas.
  const enemyFront = enemies.filter((x) => x.provides.includes('Frontline')).map((x) => x.name);
  if (c.measured && enemyFront.length && !ctx.some((x) => x.sustained)) {
    const k = Math.min(enemyFront.length, 2) * SUSTAINED_POINTS;
    if (c.sustained) {
      fit += k;
      reasons.push({ sign: '+', code: 'SUSTAINED', against: enemyFront });
    } else if (ctx.length >= SUSTAINED_LATE) {
      fit -= k;
      reasons.push({ sign: '-', code: 'NO_SUSTAINED', against: enemyFront });
    }
  }
  for (const n of c.notes) reasons.push({ sign: n.sign, code: 'NOTE', text: n.text });
  if (c.laneWinRate != null && c.laneWinRate - c.gameWinRate >= 3) reasons.push({ sign: '-', code: 'OUTSCALED' });
  if (c.laneWinRate != null && c.gameWinRate - c.laneWinRate >= 3) reasons.push({ sign: '+', code: 'BETTER_IN_GAME' });
  if (c.pool === 'in' && c.mastery != null) {
    if (c.mastery >= 80) reasons.push({ sign: '+', code: 'MASTERY_HIGH' });
    else if (c.mastery <= 50) reasons.push({ sign: '-', code: 'MASTERY_LOW' });
  }
  // « Hors pool » suppose un joueur placé : sans joueur, tous les champions sont « all ».
  if (c.pool === 'out' && player) reasons.push({ sign: '-', code: 'OUT_OF_POOL', player });
  if (c.games < LOW_SAMPLE_GAMES) reasons.push({ sign: '-', code: 'LOW_SAMPLE', games: c.games });

  syn = clamp(syn);
  // Win rate lissé vers 50 % : un pick peu joué au win rate élevé ne sature plus le classement.
  const baseWr = c.priorGames > 0 ? (c.gameWinRate * c.games + 50 * c.priorGames) / (c.games + c.priorGames) : c.gameWinRate;
  const enemyTeam = enemyEffects(c, foes);
  const matchups = weighted(enemyTeam);
  // Sans win rate de lane (Lolalytics), le counter repose sur le win rate de partie seul.
  const gameWr = baseWr + matchups;
  const ctr = c.laneWinRate == null ? wrScore(gameWr) : Math.round(wrScore(c.laneWinRate) * 0.4 + wrScore(gameWr) * 0.6);
  const total = totalScore(syn, ctr, c.mastery, c.role, options);
  const delta = compScore([...ctx, c], enemies).total - compScore(ctx, enemies).total;

  let expected: Expected | null = null;
  let points: Points = { value: total / 5, raw: total / 5, parts: null };
  if (c.measured) {
    const duos = weighted(allyTeam);
    const mastery = c.mastery == null ? 0 : (c.mastery / 10 - 5) * MASTERY_POINT;
    const mode = modeOf(c.role, options);
    const m = mode === 'synergy' ? 0 : matchups;
    const d = mode === 'counter' ? 0 : duos;
    const score = baseWr + m + d + mastery;
    expected = { base: baseWr, matchups, duos, mastery, score };
    const parts = {
      base: 10 + (baseWr - 50) * POINTS_PER_WR,
      matchups: m * POINTS_PER_WR,
      duos: d * POINTS_PER_WR,
      mastery: mastery * POINTS_PER_WR,
      // Le mode counter ne regarde que l'adversaire : l'apport à la compo ne compte pas.
      fit: mode === 'counter' ? 0 : fit
    };
    const raw = parts.base + parts.matchups + parts.duos + parts.mastery + parts.fit;
    points = { value: boundPoints(raw), raw, parts };
  }

  return {
    champion: c.name,
    pool: c.pool,
    synergy: syn,
    counter: ctr,
    mastery: c.mastery,
    total,
    compoDelta: delta,
    reasons: [...reasons.filter((r) => r.sign === '+'), ...reasons.filter((r) => r.sign === '-')],
    games: c.games,
    lowSample: c.games < LOW_SAMPLE_GAMES,
    laneWinRate: c.laneWinRate,
    gameWinRate: c.gameWinRate,
    matchup: enemyTeam[0]?.lane ? enemyTeam[0] : null,
    enemyTeam,
    allyTeam,
    expected,
    points,
    laneShare: c.laneShare,
    scaling: c.scaling
  };
};
