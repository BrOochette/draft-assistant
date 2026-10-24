import { ROLES, type Champion, type DraftState, type Pools, type Trait } from '@draft/schemas';
import { rowMeta } from './context';
import { avgScal } from './math';
import { PHASES, type AllyReadItem, type Archetype, type ArchetypeGroup, type CompMember, type EnemyReadItem, type PhaseResult, type TeamNote } from './types';

export const scalingPhases = (ally: readonly CompMember[], enemies: readonly CompMember[]): PhaseResult[] => {
  const a = avgScal(ally);
  const e = avgScal(enemies);
  return PHASES.map((phase) => {
    const d = a[phase] - e[phase];
    return { phase, ally: a[phase], enemy: e[phase], verdict: d >= 0.5 ? 'advantage' : d <= -0.5 ? 'disadvantage' : 'even' };
  });
};

const NEEDS: Trait[] = ['Frontline', 'Engage', 'Physique', 'Peel'];

/** Lecture factuelle de la compo alliée : apports, mix de dégâts, puis scaling par phase. */
export const readAlly = (ally: readonly CompMember[], phases: readonly PhaseResult[]): AllyReadItem[] => {
  const met = new Map<Trait, string>();
  for (const x of ally) for (const g of x.provides) if (!met.has(g)) met.set(g, x.name);
  const out: AllyReadItem[] = NEEDS.map((trait) => {
    const by = met.get(trait);
    return by ? { sign: '+', code: 'HAS_TRAIT', trait, by } : { sign: '-', code: 'MISSING_TRAIT', trait };
  });
  if (ally.length) {
    const ap = ally.filter((x) => x.damage === 'AP').length;
    out.push(ap / ally.length >= 0.75
      ? { sign: '-', code: 'MAGIC_HEAVY', ap, total: ally.length }
      : { sign: '+', code: 'MIXED_DAMAGE', ap, total: ally.length });
  }
  for (const p of phases) {
    if (p.verdict === 'advantage') out.push({ sign: '+', code: 'SCALING_ADVANTAGE', phase: p.phase });
    else if (p.verdict === 'disadvantage') out.push({ sign: '-', code: 'SCALING_DISADVANTAGE', phase: p.phase });
  }
  return out;
};

export const readEnemy = (state: DraftState, enemies: readonly CompMember[]): EnemyReadItem[] => {
  const out: EnemyReadItem[] = [];
  const names = (f: (x: CompMember) => boolean) => enemies.filter(f).map((x) => x.name);
  const front = names((x) => x.provides.includes('Frontline'));
  const engage = names((x) => x.provides.includes('Engage'));
  const magic = names((x) => x.damage === 'AP');
  const physical = names((x) => x.damage === 'AD');
  if (front.length) out.push({ code: 'ENEMY_FRONTLINE', names: front });
  if (engage.length) out.push({ code: 'ENEMY_ENGAGE', names: engage });
  if (magic.length) out.push({ code: 'ENEMY_MAGIC', names: magic });
  if (physical.length) out.push({ code: 'ENEMY_PHYSICAL', names: physical });
  const e = avgScal(enemies);
  if (enemies.length && e[2] >= 4) out.push({ code: 'ENEMY_LATE' });
  if (enemies.length && e[0] >= 3.5) out.push({ code: 'ENEMY_EARLY' });
  const unknown = ROLES.filter((r) => !state.enemy[r]);
  if (unknown.length) out.push({ code: 'ENEMY_UNKNOWN', roles: unknown });
  return out;
};

export const teamNotes = (state: DraftState, pools: Pools): TeamNote[] => {
  const out: TeamNote[] = [];
  for (const role of ROLES) {
    const m = rowMeta(state, pools, role);
    if (!m.hasPool && m.player) out.push({ code: 'NO_POOL', player: m.player, role });
  }
  const players = [...new Set(ROLES.map((r) => state.assign[r]).filter((p): p is string => !!p))];
  for (const player of players) {
    const roles = ROLES.filter((r) => state.assign[r] === player);
    if (roles.length > 1) out.push({ code: 'MULTI_ROLE', player, roles });
  }
  return out;
};

/**
 * Archétype de compo par classe principale Riot (provisoire). Marksman n'en a pas : un tireur va dans toutes les compos.
 */
export const ARCHETYPE_OF_CLASS: Readonly<Record<string, Archetype>> = {
  Diver: 'dive',
  Assassin: 'dive',
  Vanguard: 'engage',
  Artillery: 'poke',
  Enchanter: 'protect',
  Warden: 'protect',
  Catcher: 'pick',
  Burst: 'pick',
  Battlemage: 'teamfight',
  Juggernaut: 'split',
  Skirmisher: 'split',
  Specialist: 'split'
};

/** Archétypes partagés par au moins 2 champions de la compo, du plus fourni au moins fourni. */
export const archetypes = (names: readonly string[], catalog: ReadonlyMap<string, Champion>): ArchetypeGroup[] => {
  const groups = new Map<Archetype, string[]>();
  for (const name of names) {
    const a = ARCHETYPE_OF_CLASS[catalog.get(name)?.classes?.[0] ?? ''];
    if (a) groups.set(a, [...(groups.get(a) ?? []), name]);
  }
  return [...groups]
    .filter(([, list]) => list.length >= 2)
    .map(([archetype, list]) => ({ archetype, names: list }))
    .sort((x, y) => y.names.length - x.names.length);
};
