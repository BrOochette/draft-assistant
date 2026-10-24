// Textes des écrans, regroupés par écran. Les phrases paramétrées sont des fonctions.
import type { Archetype, PoolStatus } from '@draft/engine';
import type { Role } from '@draft/schemas';
import { fmt1, fmtDelta, fmtInt, fmtPct, fmtSigned } from './format';

export const ARCHETYPE_LABEL: Record<Archetype, string> = {
  dive: 'Dive',
  engage: 'Engage',
  poke: 'Poke',
  protect: 'Protect',
  pick: 'Pick',
  teamfight: 'Teamfight',
  split: 'Split push'
};

export const POOL_TAG: Record<PoolStatus, string> = { in: 'Pool', out: 'Hors pool', all: 'Tous les champions' };

export const APP_TEXT = {
  brand: 'Draft Assistant',
  nav: 'Navigation principale',
  players: 'Joueurs',
  draft: 'Draft',
  dataChip: (patch: string, rank: string, region: string | undefined, lolalytics: boolean) =>
    'Patch ' + patch + ' · ' + rank + (region ? ' · ' + region : '') + (lolalytics ? ' · Lolalytics' : ''),
  dataTip: (sample: boolean, region: string | undefined) =>
    sample ? "Win rates et échantillons : données d'exemple" : 'Stats Lolalytics, classé solo, ' + (region ?? 'toutes régions'),
  sampleData: "Données d'exemple",
  resetGroup: 'Confirmer la nouvelle draft',
  resetAsk: 'Effacer picks, bans et sélections ?',
  resetYes: 'Oui, nouvelle draft',
  cancel: 'Annuler',
  newDraft: 'Nouvelle draft',
  loading: 'Chargement…',
  snapshotMissing: (status: number) => 'Snapshot introuvable (' + status + '). Lancer « npm run ingest -- sample ».'
};

export const DRAFT_TEXT = {
  modesLabel: 'Suggestions, tous les rôles',
  roleRegion: (role: Role) => 'Rôle ' + role,
  toChoose: 'À choisir',
  locked: 'Verrouillé',
  vs: 'VS',
  waiting: 'En attente',
  allyFace: (picked: boolean, player: string | null, role: Role) =>
    'Saisie manuelle : ' + (picked ? 'changer le champion' : 'choisir le champion') + (player ? ' de ' + player : '') + ' en ' + role,
  allyFaceTip: (picked: boolean) => (picked ? 'Changer à la main' : 'Choisir à la main'),
  enemyFace: (picked: boolean, role: Role) => 'Saisie manuelle : ' + (picked ? 'changer le pick ennemi en ' : 'pick ennemi en ') + role,
  enemyFaceTip: (picked: boolean) => (picked ? 'Changer à la main' : 'Saisir à la main'),
  removeAlly: (champion: string, role: Role) => 'Retirer ' + champion + ' et rouvrir les suggestions en ' + role,
  removeEnemy: (champion: string, role: Role) => 'Retirer le pick ennemi ' + champion + ' en ' + role,
  removeTip: (champion: string) => 'Retirer ' + champion,
  player: 'Joueur',
  noPlayer: 'Aucun joueur',
  noPoolWarn: (hasPlayer: boolean) => (hasPlayer ? 'Sans pool' : 'Sans joueur') + ' : tous les champions',
  multiRole: 'Placé sur plusieurs rôles',
  roleModes: (role: Role) => 'Suggestions en ' + role,
  inRole: (label: string, role: Role) => label + ' en ' + role,
  viewGroup: (role: Role) => 'Affichage des suggestions en ' + role,
  viewTop3: 'Vue top 3',
  viewList: 'Vue liste',
  noChampion: 'Aucun champion disponible pour ce rôle.',
  search: 'Rechercher un champion',
  searchIn: (role: Role) => 'Rechercher un champion dans la liste ' + role,
  notFound: 'Aucun champion trouvé.',
  headPool: 'Pool',
  headAll: (role: Role, hasPlayer: boolean) => 'Tous les champions ' + role + (hasPlayer ? ' (aucun pool)' : ' (aucun joueur)'),
  headOut: 'Hors pool',
  headSecondary: 'Rôle secondaire, non classés',
  secondaryTip: (share: number, role: Role) => 'Moins de ' + share + ' % des parties de ces champions sont jouées en ' + role,
  more: 'Voir plus',
  moreIn: (role: Role) => 'Voir plus de champions en ' + role,
  up: 'Remonter',
  upIn: (role: Role) => 'Remonter en haut du rôle ' + role,
  pickerAlly: (player: string | null, role: Role) => 'Champion' + (player ? ' de ' + player : '') + ' en ' + role,
  pickerEnemy: (role: Role) => 'Pick ennemi en ' + role,
  chooseIn: (champion: string, role: Role) => 'Choisir ' + champion + ' en ' + role,
  enterIn: (champion: string, role: Role) => 'Saisir ' + champion + ' en ' + role,
  clear: 'Effacer',
  current: 'Actuel',
  noMatchupNotes: 'Pas de données de matchup pour cette paire',
  unknownOpponent: 'Adversaire direct inconnu'
};

export const CARD_TEXT = {
  /** Nom accessible d'une card : score attendu (stats mesurées) ou score sur 100. */
  group: (champion: string, expected: number | null, total: number, selected: boolean) =>
    champion + ', ' + (expected != null ? fmtPct(expected) + ' attendu' : 'score ' + total + ' sur 100') + (selected ? ', présélectionné' : ''),
  lock: (champion: string, role: Role) => 'Verrouiller ' + champion + ' en ' + role,
  lockTip: 'Verrouiller',
  lockButton: 'Verrouiller',
  compo: (delta: number) => 'Compo ' + fmtDelta(delta),
  compoTip: 'Points que ce pick ajoute à la note de ta compo',
  expected: 'attendu',
  expectedTip: (base: number) => 'Win rate attendu : ' + fmtPct(base) + ' de base, plus les matchups, les duos et la maîtrise',
  base: 'Base',
  baseTip: (base: number) => 'Win rate du champion sur le rôle, lissé vers 50 % : ' + fmtPct(base),
  matchups: 'Matchups',
  duos: 'Duos',
  mastery: 'Maîtrise',
  masteryNone: 'n/a',
  matchupsTip: 'Effet des ennemis connus, en points de win rate (détail dans « vs … »)',
  duosTip: 'Effet des alliés verrouillés, en points de win rate (détail dans « avec … »)',
  masteryTip: (note: number | null) => (note == null ? "Pas de pool pour ce rôle, la maîtrise n'entre pas dans le score" : 'Maîtrise ' + note + '/10 : (note − 5) × 0,4 point'),
  synergy: 'Synergie',
  counter: 'Counter',
  outOf100: (label: string, v: number) => label + ' : ' + v + ' sur 100',
  lowSample: 'Peu fiable',
  sample: (games: number, low: boolean) => fmtInt(games) + ' parties' + (low ? ' : peu fiable' : ''),
  sampleTip: (games: number) => 'Échantillon de ' + fmtInt(games) + ' parties : sous 500 parties, le win rate est peu fiable',
  secondary: (share: number) => 'Rôle secondaire · ' + fmtInt(Math.round(share)) + ' %',
  secondaryTip: (role: Role) => 'Part des parties du champion jouées en ' + role,
  wr: (wr: number, lane: number | null) => 'WR ' + fmtPct(wr) + (lane != null ? ' · lane ' + fmtPct(lane) : ''),
  wrTip: (hasLane: boolean) => 'Win rate de partie sur ce rôle, tous adversaires' + (hasLane ? ', puis win rate de lane' : ''),
  scaling: 'Scaling',
  scalingTip: 'Puissance au début, au milieu et en fin de partie',
  phaseTip: (phase: string, v: number) => phase + ' : ' + v + ' sur 5'
};

export const POPOVER_TEXT = {
  loading: 'Chargement',
  vsLane: 'Vis-à-vis',
  vs: (opponent: string) => 'vs ' + opponent,
  vsCompo: 'vs compo',
  pts: (v: number) => fmtSigned(v) + ' pts',
  with: (ally: string) => 'avec ' + ally,
  withAllies: 'avec alliés',
  enemyPanel: (champion: string) => 'Effet des ennemis sur le win rate attendu de ' + champion,
  enemyHead: (champion: string) => champion + ' contre les ennemis connus',
  allyPanel: (champion: string) => 'Effet des alliés sur le win rate attendu de ' + champion,
  allyHead: (champion: string) => champion + ' avec les alliés verrouillés',
  colEnemy: 'Ennemi',
  colAlly: 'Allié',
  colMeasured: 'Mesuré',
  colGap: 'Écart',
  colWeight: 'Poids',
  colEffect: 'Effet',
  games: (n: number) => fmtInt(n) + ' parties',
  noData: 'Pas de données',
  classVs: (a: string, b: string) => 'Moyenne ' + a + ' contre ' + b,
  classWith: (a: string, b: string) => 'Moyenne ' + a + ' avec ' + b,
  enemyFoot:
    "Écart : win rate contre cet ennemi moins win rate du champion, lissé vers la moyenne de leur paire de classes (1 000 parties fictives). L'effet s'ajoute au win rate attendu.",
  allyFoot:
    "Écart : win rate du duo par rapport à l'attendu, lissé vers la moyenne de leur paire de classes (200 parties fictives). L'effet s'ajoute au win rate attendu."
};

export const BANS_TEXT = {
  title: 'Bans',
  suggestions: 'Suggestions de bans',
  allies: 'Alliés',
  enemies: 'Ennemis',
  allyGroup: 'Bans de ton équipe',
  enemyGroup: "Bans de l'équipe ennemie",
  remove: (champion: string) => 'Retirer le ban de ' + champion,
  addAlly: 'Ajouter un ban de ton équipe',
  addEnemy: "Saisir un ban de l'équipe ennemie",
  allyFull: 'Les 5 bans de ton équipe sont posés.',
  sideFull: 'Les 5 bans de ce côté sont déjà posés.',
  suggestedIn: (role: Role) => 'Bans suggérés en ' + role,
  ban: 'Bannir',
  banChampion: (champion: string) => 'Bannir ' + champion,
  pickerAlly: 'Ban de ton équipe',
  pickerEnemy: "Ban de l'équipe ennemie",
  /** Stats mesurées : valeur du ban et sa décomposition. */
  impact: (value: number) => fmtSigned(value) + ' pts pour toi',
  impactDetail: (winRate: number, ours: string | null, drop: number) =>
    'WR ' + fmtPct(winRate) + (ours ? ' · ' + ours + ' ' + fmtSigned(-drop) : ''),
  impactTip: (strength: number, ours: string | null, drop: number) =>
    'Force ' + fmtSigned(strength) + ' (win rate lissé − 50)' + (ours ? ', et ' + ours + ', ta meilleure option, ' + (Math.round(drop * 10) >= 0 ? 'perd ' : 'gagne ') + fmt1(Math.abs(drop)) + ' pt contre lui' : ''),
  threatTip: (threat: number) => 'Menace ' + threat + ' sur 100'
};

export const COMPO_TEXT = {
  aside: 'Analyse de la composition',
  scores: 'Notes des compositions',
  ally: 'Ta compo',
  enemy: 'Compo ennemie',
  outOf100: 'Notes sur 100',
  allies: 'Alliés',
  enemies: 'Ennemis',
  scalingSection: 'Scaling des deux équipes',
  scaling: 'Scaling',
  reading: 'Lecture des compositions',
  archetype: (label: string, names: readonly string[]) => label + ' : ' + names.join(', '),
  archetypeTip: 'Archétype des champions d’après leur classe Riot (au moins 2 champions)',
  team: "Points d'attention sur l'équipe",
  teamTitle: 'Équipe',
  help: 'Aide',
  helpToggle: 'Lire les scores',
  helpItems: (measured: boolean): [string, string][] =>
    measured
      ? [
          ['Win rate attendu', "Win rate du champion sur le rôle (lissé vers 50 %), plus l'effet des ennemis connus (vis-à-vis ×1, duo bot adverse ×3/4, autres ×1/4), plus l'effet des alliés verrouillés (ADC et support ×1, autres ×1/2), plus la maîtrise : (note − 5) × 0,4 point, −2 hors pool. En mode Synergie, sans les matchups ; en mode Counter, sans les duos."],
          ['Matchups et duos', 'Une paire peu jouée est lissée vers la moyenne de sa paire de classes (par exemple Diver contre Vanguard) : plus elle est jouée, plus sa propre mesure compte.'],
          ['Compo +N', 'Points que ce pick ajoute à la note globale de ta compo (frontline, engage, peel, mix de dégâts, scaling).'],
          ['Peu fiable', 'Moins de 500 parties derrière le win rate : la valeur peut changer fortement.'],
          ['Scaling D, M, F', 'Puissance au début, au milieu et en fin de partie, de 1 à 5.']
        ]
      : [
          ['Score sur 100', 'Selon le mode choisi : synergie avec ta compo, counter face à l’ennemi, ou les deux (Mix). La maîtrise du joueur compte pour un quart quand il a un pool.'],
          ['Compo +N', 'Points que ce pick ajoute à la note globale de ta compo.'],
          ['Lane et Partie', 'Win rate du champion dans ce matchup en lane, et sur la partie entière.'],
          ['Peu fiable', 'Moins de 500 parties derrière le win rate : la valeur peut changer fortement.'],
          ['Scaling D, M, F', 'Puissance au début, au milieu et en fin de partie, de 1 à 5.']
        ],
  data: 'Données',
  dataSample: (patch: string, rank: string) => 'Patch ' + patch + ', rang ' + rank + ". Valeurs d'exemple.",
  dataMeasured: (patch: string, rank: string, region: string | undefined) =>
    'Lolalytics, patch ' + patch + ', rang ' + rank + ', ' + (region ? 'région ' + region : 'toutes régions') +
    ". Win rate de lane indisponible. Sans pool, seuls les champions qui jouent ce rôle dans au moins 20 % de leurs parties sont classés."
};

export const PLAYERS_TEXT = {
  title: 'Joueurs et champion pools',
  players: 'Joueurs',
  pools: (roles: readonly string[]) => (roles.length ? 'Pools : ' + roles.join(', ') : 'Aucun pool'),
  noPlayer: 'Aucun joueur.',
  create: 'Créer un joueur',
  nickname: 'Pseudo du joueur',
  createButton: 'Créer le joueur',
  poolsOf: (player: string) => 'Pools de ' + player,
  confirmDelete: (player: string) => 'Confirmer la suppression de ' + player,
  deleteAsk: (player: string) => 'Supprimer ' + player + ' et ses pools ?',
  deleteYes: 'Oui, supprimer',
  cancel: 'Annuler',
  deletePlayer: 'Supprimer le joueur',
  role: 'Rôle',
  noPool: 'Aucun pool',
  emptyTitle: (role: Role, player: string) => 'Aucun pool ' + role + ' pour ' + player,
  emptyText: (role: Role, player: string) => 'Placé ' + role + ' en draft, ' + player + ' se voit proposer tous les champions du rôle, sans note de maîtrise.',
  masteryLabel: (level: string) => 'Maîtrise : ' + level,
  masteryLower: (champion: string) => 'Baisser la maîtrise de ' + champion,
  masteryRaise: (champion: string) => 'Augmenter la maîtrise de ' + champion,
  removeFromPool: (champion: string) => 'Retirer ' + champion + ' du pool',
  add: 'Ajouter un champion',
  addFor: (player: string, role: Role) => 'Champion pour ' + player + ', rôle ' + role + ', ajouté avec la note 5',
  search: 'Rechercher un champion',
  champions: (role: Role) => 'Champions ' + role,
  notFound: 'Aucun champion trouvé.',
  coverage: (role: Role) => 'Couverture du pool ' + role,
  coverageCount: (n: number) => (n === 0 ? 'Aucun' : n + (n > 1 ? ' champions' : ' champion')),
  scale: 'Échelle de maîtrise',
  scaleItems: [
    ['1 à 3', 'Découverte : tu connais le kit, peu de parties.'],
    ['4 à 6', "À l'aise : tu le joues sans te faire punir."],
    ['7 à 8', 'Solide : combos, matchups et timings acquis.'],
    ['9 à 10', 'Maîtrise : tu peux porter une partie avec.']
  ] as const,
  traits: { frontline: 'Frontline', engage: 'Engage', peel: 'Peel', physical: 'Dégâts physiques', early: 'Early game', late: 'Scaling tardif' }
};

export const PICKER_TEXT = {
  close: 'Fermer',
  search: 'Rechercher un champion',
  notFound: 'Aucun champion trouvé.',
  unavailable: (champion: string, why: string) => champion + ', indisponible : ' + why,
  roleFilter: 'Filtrer par rôle',
  all: 'Tous'
};
