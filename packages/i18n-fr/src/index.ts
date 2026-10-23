// Textes français de l'interface. Le moteur renvoie des codes, tout le texte affiché vient d'ici.
import type {
  ActionMessage,
  AllyReadItem,
  BanBlocked,
  Blocked,
  CriterionKey,
  EnemyReadItem,
  GoneReason,
  Phase,
  PoolStatus,
  Reason,
  RecNote,
  ScalingVerdict,
  Side,
  TeamNote,
  Verdict
} from '@draft/engine';
import type { Role, Trait } from '@draft/schemas';

export const fmt1 = (n: number): string => n.toFixed(1).replace('.', ',');
export const fmtPct = (n: number): string => fmt1(n) + ' %';
/** 14200 devient « 14 200 ». */
export const fmtInt = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export const fmtDelta = (n: number): string => (n >= 0 ? '+' : '') + n;

export const TRAIT_LABEL: Record<Trait, string> = {
  Frontline: 'Frontline',
  Engage: 'Engage de teamfight',
  Physique: 'Dégâts physiques',
  Peel: 'Peel'
};

/** Phase dans une phrase : « Faible en fin de partie ». */
export const PHASE_IN: Record<Phase, string> = { 0: 'en début de partie', 1: 'en milieu de partie', 2: 'en fin de partie' };
export const PHASE_LABEL: Record<Phase, string> = { 0: 'Début de partie', 1: 'Milieu de partie', 2: 'Fin de partie' };
export const PHASE_RANGE: Record<Phase, string> = { 0: '0 à 15 min', 1: '15 à 25 min', 2: '25 min et plus' };
export const PHASE_SHORT: Record<Phase, string> = { 0: 'D', 1: 'M', 2: 'F' };
export const phaseTitle = (p: Phase): string => PHASE_LABEL[p] + ' (' + PHASE_RANGE[p] + ')';

export const reasonText = (r: Reason): string => {
  switch (r.code) {
    case 'PROVIDES': return TRAIT_LABEL[r.trait];
    case 'COVERED': return TRAIT_LABEL[r.trait] + ' déjà couvert par ' + r.by;
    case 'EXTRA_AP': return r.n + 'e source de dégâts magiques';
    case 'SCALING_STRONG': return 'Scaling ' + PHASE_IN[r.phase];
    case 'SCALING_WEAK': return 'Faible ' + PHASE_IN[r.phase];
    case 'NOTE': return r.text;
    case 'OUTSCALED': return 'Fort en lane mais se fait outscale';
    case 'BETTER_IN_GAME': return "Meilleur en partie qu'en lane (scaling)";
    case 'MASTERY_HIGH': return 'Maîtrise élevée';
    case 'MASTERY_LOW': return 'Maîtrise faible';
    case 'OUT_OF_POOL': return 'Hors du pool de ' + r.player;
    case 'LOW_SAMPLE': return 'Échantillon faible : ' + fmtInt(r.games) + ' parties';
  }
};

/** Raison précédée de son signe : « + Frontline ». */
export const formatReason = (r: Reason | { sign: '+' | '-'; text: string }): string =>
  r.sign + ' ' + ('code' in r ? reasonText(r) : r.text);

export const POOL_TAG: Record<PoolStatus, string> = { in: 'Pool', out: 'Hors pool', all: 'Tous les champions' };

export const VERDICT_LABEL: Record<Verdict, string> = { solid: 'Solide', fair: 'Correcte', fragile: 'Fragile', fix: 'À corriger' };
export const SCALING_VERDICT_LABEL: Record<ScalingVerdict, string> = {
  advantage: 'Avantage',
  even: 'Équilibre',
  disadvantage: 'Désavantage'
};

export const CRITERION_LABEL: Record<CriterionKey, string> = {
  frontline: 'Frontline',
  engage: 'Engage',
  peel: 'Peel',
  damageMix: 'Mix de dégâts',
  scaling: 'Scaling'
};
export const CRITERION_TIP: Record<CriterionKey, string> = {
  frontline: "Au moins un champion qui encaisse les dégâts pour l'équipe.",
  engage: "Un moyen d'initier le combat.",
  peel: 'De quoi protéger tes carry des plongées.',
  damageMix: 'Des dégâts magiques et des dégâts physiques.',
  scaling: "Puissance de ta compo face à l'ennemi sur les trois phases de la partie."
};
/** Critères de la compo ennemie, calculés sur ses picks connus. */
export const CRITERION_TIP_ENEMY: Record<CriterionKey, string> = {
  frontline: "Au moins un champion ennemi qui encaisse les dégâts pour son équipe.",
  engage: "Un moyen pour l'ennemi d'initier le combat.",
  peel: 'De quoi protéger ses carry des plongées.',
  damageMix: 'Des dégâts magiques et des dégâts physiques chez l\'ennemi.',
  scaling: 'Puissance de la compo ennemie face à la tienne sur les trois phases de la partie.'
};

export const recNoteText = (note: RecNote, player: string, role: Role): string => {
  switch (note) {
    case 'POOL': return 'Les 3 meilleurs du pool de ' + player + ', classés par score.';
    case 'NO_POOL': return player + " n'a pas de pool " + role + ' : tous les champions sont classés.';
    case 'POOL_EXHAUSTED': return 'Aucun champion du pool de ' + player + " n'est disponible : propositions hors pool.";
  }
};

const MISSING: Record<Trait, string> = {
  Frontline: 'Pas de frontline',
  Engage: "Pas d'engage de teamfight",
  Physique: 'Aucun dégât physique',
  Peel: 'Peu de peel pour protéger ton ADC'
};

export const allyReadText = (r: AllyReadItem): string => {
  switch (r.code) {
    case 'HAS_TRAIT': return TRAIT_LABEL[r.trait] + ' avec ' + r.by;
    case 'MISSING_TRAIT': return MISSING[r.trait];
    case 'MAGIC_HEAVY': return 'Dégâts magiques : ' + r.ap + ' picks sur ' + r.total;
    case 'MIXED_DAMAGE': return 'Dégâts mixtes : ' + r.ap + ' magiques sur ' + r.total + ' picks';
    case 'SCALING_ADVANTAGE': return 'Avantage de scaling ' + PHASE_IN[r.phase];
    case 'SCALING_DISADVANTAGE': return 'Désavantage de scaling ' + PHASE_IN[r.phase];
  }
};

export const enemyReadText = (r: EnemyReadItem): string => {
  switch (r.code) {
    case 'ENEMY_FRONTLINE': return 'Frontline solide (' + r.names.join(', ') + ')';
    case 'ENEMY_ENGAGE': return 'Engage de teamfight (' + r.names.join(', ') + ')';
    case 'ENEMY_MAGIC': return 'Dégâts magiques : ' + r.names.join(', ');
    case 'ENEMY_PHYSICAL': return 'Dégâts physiques : ' + r.names.join(', ');
    case 'ENEMY_LATE': return 'Fort en fin de partie';
    case 'ENEMY_EARLY': return 'Fort en début de partie';
    case 'ENEMY_UNKNOWN': return 'Encore inconnus : ' + r.roles.join(', ');
  }
};

export const teamNoteText = (n: TeamNote): string => {
  switch (n.code) {
    case 'NO_POOL': return n.player + " n'a pas de pool " + n.role + ' : tous les champions du rôle sont proposés, sans note de maîtrise.';
    case 'MULTI_ROLE': return n.player + ' est placé sur plusieurs rôles : ' + n.roles.join(', ') + '.';
  }
};

export const actionMessageText = (m: ActionMessage): string => {
  switch (m.code) {
    case 'LOCKED': return m.champion + ' verrouillé en ' + m.role;
    case 'UNLOCKED': return m.role + ' déverrouillé (' + m.champion + ')';
    case 'ENEMY_SET': return 'Pick ennemi en ' + m.role + ' : ' + m.champion;
    case 'ENEMY_CLEARED': return 'Pick ennemi effacé en ' + m.role;
    case 'BANNED': return m.champion + ' banni';
    case 'BAN_REMOVED': return 'Ban de ' + m.champion + ' retiré';
    case 'RESET': return 'Draft réinitialisée';
  }
};

export const GONE_LABEL: Record<GoneReason, string> = {
  BANNED_BY_ALLY: 'Banni par ton équipe',
  BANNED_BY_ENEMY: "Banni par l'ennemi",
  TAKEN_BY_ENEMY: "Pris par l'ennemi",
  TAKEN_BY_ALLY: 'Pris par ton équipe'
};

export const blockedLabel = (b: Blocked, side: Side): string => {
  if (b === 'BANNED') return 'Banni';
  if (b === 'TAKEN_BY_ALLY') return side === 'ally' ? 'Déjà pris' : 'Pris (allié)';
  return side === 'ally' ? 'Pris (ennemi)' : 'Déjà pris';
};

export const BAN_BLOCKED_LABEL: Record<BanBlocked, string> = { ALREADY_BANNED: 'Déjà banni', ALREADY_PICKED: 'Déjà pris' };

export const masteryLevel = (n: number): string => (n >= 9 ? 'Maîtrise' : n >= 7 ? 'Solide' : n >= 4 ? "À l'aise" : 'Découverte');
