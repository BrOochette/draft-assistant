import type { Role, Trait } from '@draft/schemas';
import { compScore } from './composition';
import { avgScal, clamp, wrScore } from './math';
import type { AllyDuo, CompMember, EnemyNoData, EnemyTeamMatchup, Entry, Evaluation, Phase, Reason, ScoringOptions } from './types';

export const SYNERGY_BONUS: Record<Trait, number> = { Frontline: 12, Engage: 10, Physique: 10, Peel: 6 };
export const LOW_SAMPLE_GAMES = 500;
/** Parties « fictives » à écart nul, pour lisser un duo peu joué. */
const DUO_PRIOR_GAMES = 200;
/** Parties « fictives » au win rate lissé du champion, pour lisser un matchup peu joué. */
const MATCHUP_PRIOR_GAMES = 1000;
/** Un matchup de moins de parties est ignoré : le counter utilise alors le win rate lissé du champion. */
export const MATCHUP_MIN_GAMES = 500;
/** Points de synergie par point d'écart moyen de win rate en duo. */
export const DUO_WEIGHT = 4;
/** Écart de duo (lissé) à partir duquel une raison est affichée. */
const DUO_REASON_MIN = 1;

/**
 * Part du counter dans le score « mix » quand l'adversaire de lane est connu : le matchup pèse plus en top
 * qu'en jungle (choix du porteur du projet : top > mid = support > ADC > jungle).
 */
export const LANE_COUNTER_WEIGHT: Record<Role, number> = { Top: 0.65, Mid: 0.55, Support: 0.55, ADC: 0.45, Jungle: 0.35 };

/** Score total. La maîtrise compte pour 25 % quand le joueur a un pool ; le reste dépend du mode. */
export const totalScore = (
  syn: number,
  ctr: number,
  mastery: number | null,
  role: Role,
  laneOpponentKnown: boolean,
  { mode: globalMode = 'mix', modeByRole, laneCounterWeight }: ScoringOptions
): number => {
  const mode = modeByRole?.[role] ?? globalMode;
  const withMastery = (v: number) => (mastery == null ? Math.round(v) : Math.round(v * 0.75 + mastery * 0.25));
  if (mode === 'synergy') return withMastery(syn);
  if (mode === 'counter') return withMastery(ctr);
  const k = laneOpponentKnown ? laneCounterWeight?.[role] : undefined;
  if (k != null) return withMastery(syn * (1 - k) + ctr * k);
  // Poids de la maquette (scénarios de référence).
  return mastery == null ? Math.round(syn * 0.55 + ctr * 0.45) : Math.round(syn * 0.4 + ctr * 0.35 + mastery * 0.25);
};

/**
 * Poids d'un ennemi d'une autre lane par rapport au vis-à-vis (1) : un quart, sauf en botlane où l'ADC
 * et le support ennemis jouent la même lane à deux (trois quarts).
 */
export const otherEnemyWeight = (role: Role, enemyRole: Role): number =>
  (role === 'ADC' && enemyRole === 'Support') || (role === 'Support' && enemyRole === 'ADC') ? 0.75 : 0.25;

const smooth = (value: number, games: number, prior: number, priorGames: number) => (value * games + prior * priorGames) / (games + priorGames);

/**
 * Évalue un candidat face au contexte allié `ctx` (les autres picks) et aux ennemis connus.
 * Portage ligne par ligne de `evalChamp` (maquette Draft v2) : ordre des opérations et arrondis identiques.
 * Avec des stats réelles, la synergie ajoute les duos mesurés et le counter utilise le matchup de lane.
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
  const laneOpponent = foes[c.role] ?? null;
  const met = new Map<Trait, string>();
  for (const x of ctx) for (const g of x.provides) if (!met.has(g)) met.set(g, x.name);
  const apCount = ctx.filter((x) => x.damage === 'AP').length;
  const a = avgScal(ctx);
  const e = avgScal(enemies);
  const diff = [a[0] - e[0], a[1] - e[1], a[2] - e[2]] as const;
  let wi: Phase = 0;
  for (const i of [0, 1, 2] as const) if (diff[i] < diff[wi]) wi = i;
  const needScal: Phase | null = diff[wi] <= -0.5 ? wi : null;

  let syn = c.synergyBase;
  const reasons: Reason[] = [];
  for (const g of c.provides) {
    const by = met.get(g);
    if (by) {
      syn -= 3;
      reasons.push({ sign: '-', code: 'COVERED', trait: g, by });
    } else {
      syn += SYNERGY_BONUS[g];
      reasons.push({ sign: '+', code: 'PROVIDES', trait: g });
    }
  }
  const allyTeam: AllyDuo[] = [];
  let duoBonus = 0;
  if (c.duos) {
    for (const x of ctx) {
      const d = c.duos[x.role]?.[x.name];
      if (d) allyTeam.push({ ally: x.name, role: x.role, delta: d[0], games: d[1], smoothed: smooth(d[0], d[1], 0, DUO_PRIOR_GAMES) });
    }
    if (allyTeam.length) {
      duoBonus = Math.round((DUO_WEIGHT * allyTeam.reduce((s, d) => s + d.smoothed, 0)) / allyTeam.length);
      syn += duoBonus;
      for (const d of allyTeam) {
        if (Math.abs(d.smoothed) >= DUO_REASON_MIN) reasons.push({ sign: d.smoothed > 0 ? '+' : '-', code: 'DUO', ally: d.ally, delta: d.smoothed });
      }
    }
  }
  if (c.damage === 'AP' && apCount >= 2) {
    syn -= 4;
    reasons.push({ sign: '-', code: 'EXTRA_AP', n: apCount + 1 });
  }
  if (needScal !== null) {
    const v = c.scaling[needScal];
    syn += (v - 3) * 4;
    if (v >= 4) reasons.push({ sign: '+', code: 'SCALING_STRONG', phase: needScal });
    else if (v <= 2) reasons.push({ sign: '-', code: 'SCALING_WEAK', phase: needScal });
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
  // Win rate lissé vers 50 % : un pick peu joué au win rate élevé ne sature plus le counter.
  const baseWr = c.priorGames > 0 ? (c.gameWinRate * c.games + 50 * c.priorGames) / (c.games + c.priorGames) : c.gameWinRate;
  const found = laneOpponent ? c.matchups?.[laneOpponent] : undefined;
  const m = found && found[1] >= MATCHUP_MIN_GAMES ? found : undefined;
  const laneWr = m ? smooth(m[0], m[1], baseWr, MATCHUP_PRIOR_GAMES) : baseWr;
  const matchup = m && laneOpponent ? { opponent: laneOpponent, winRate: m[0], games: m[1], delta: laneWr - baseWr } : null;
  // Ennemis des autres lanes : chacun ajoute son écart au win rate général, avec moins de poids que le vis-à-vis.
  const enemyTeam: EnemyTeamMatchup[] = [];
  const enemyNoData: EnemyNoData[] = [];
  // Seulement avec des matchups mesurés (Lolalytics) : les données d'exemple n'en ont pas du tout.
  if (laneOpponent && !m && c.matchups) enemyNoData.push({ opponent: laneOpponent, role: c.role, lane: true, games: found?.[1] ?? null });
  for (const [role, name] of Object.entries(foes) as [Role, string | null][]) {
    if (!name || role === c.role || !c.crossMatchups) continue;
    const x = c.crossMatchups?.[role]?.[name];
    if (!x || x[1] < MATCHUP_MIN_GAMES) {
      enemyNoData.push({ opponent: name, role, lane: false, games: x?.[1] ?? null });
      continue;
    }
    const delta = smooth(x[0], x[1], baseWr, MATCHUP_PRIOR_GAMES) - baseWr;
    enemyTeam.push({ opponent: name, role, winRate: x[0], games: x[1], weight: otherEnemyWeight(c.role, role), delta });
  }
  const enemyTeamDelta = enemyTeam.reduce((s, e) => s + e.weight * e.delta, 0);
  const gameWr = laneWr + enemyTeamDelta;
  // Sans win rate de lane (Lolalytics), le counter repose sur le win rate de partie seul.
  const ctr = c.laneWinRate == null ? wrScore(gameWr) : Math.round(wrScore(c.laneWinRate) * 0.4 + wrScore(gameWr) * 0.6);
  const total = totalScore(syn, ctr, c.mastery, c.role, laneOpponent != null, options);
  const delta = compScore([...ctx, c], enemies).total - compScore(ctx, enemies).total;

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
    matchup,
    enemyTeam,
    enemyTeamDelta,
    enemyNoData,
    allyTeam,
    duoBonus,
    laneShare: c.laneShare,
    scaling: c.scaling
  };
};
