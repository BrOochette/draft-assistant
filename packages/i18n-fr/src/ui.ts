// Textes des écrans, regroupés par écran. Les phrases paramétrées sont des fonctions.
import type { Archetype, PoolStatus } from '@draft/engine';
import type { Role } from '@draft/schemas';
import { fmt1, fmtDelta, fmtInt, fmtPct, fmtSigned, fmtScal } from './format';

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
  /** Mention exigée par Riot pour un projet de fan (texte officiel, en anglais). */
  legalRiot:
    "Draft Assistant isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.",
  legalSources: 'Projet de fan non commercial. Stats : Lolalytics. Attributs des champions : wiki League of Legends. Portraits : Data Dragon (Riot Games).',
  footer: 'Mentions',
  snapshotMissing: (status: number) => 'Snapshot introuvable (' + status + '). Lancer « npm run ingest -- sample ».'
};

/** Appli desktop : mise à jour des stats Lolalytics dans l'appli. */
const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
export const STATS_TEXT = {
  start: 'Mettre à jour les stats',
  startTip: (last: string | null) =>
    'Collecte Lolalytics complète, environ 15 minutes, une fois par semaine' + (last ? '. Dernière : ' + dateFr(last) : ''),
  nextTip: (next: string, last: string | null) => 'Prochaine mise à jour possible le ' + dateFr(next) + (last ? ' (dernière : ' + dateFr(last) + ')' : ''),
  running: 'Mise à jour des stats',
  progress: (done: number, total: number) => 'Stats ' + done + '/' + total,
  runningTip: (champion: string) => 'Collecte Lolalytics en cours' + (champion ? ' : ' + champion : ''),
  paused: 'Stats en pause',
  pausedTip: 'Sélection des champions en cours : la collecte reprend après la draft',
  cancel: 'Annuler',
  error: {
    TOO_SOON: 'Une mise à jour par semaine',
    IN_CHAMP_SELECT: 'Draft en cours',
    RUNNING: 'Mise à jour déjà en cours',
    ACCESS_DENIED: 'Lolalytics refuse l’accès',
    NETWORK: 'Échec de la mise à jour (réseau)',
    CANCELLED: 'Mise à jour annulée',
    NO_DATA: 'Aucune stat récupérée'
  } as Record<'TOO_SOON' | 'IN_CHAMP_SELECT' | 'RUNNING' | 'ACCESS_DENIED' | 'NETWORK' | 'CANCELLED' | 'NO_DATA', string>
};

/** Client LoL lu par le pont local. */
export const CLIENT_TEXT = {
  status: { closed: 'Client LoL fermé', idle: 'Client LoL connecté', champSelect: 'Draft en direct', outdated: 'Pont obsolète' } as Record<'closed' | 'idle' | 'champSelect' | 'outdated', string>,
  tip: 'Picks, bans et rôles lus dans le client LoL, en lecture seule',
  outdatedTip: 'Pont lancé avec une version antérieure de l’appli : phase de bans, side et joueur en train de choisir manquent'
};

export const DRAFT_TEXT = {
  modesLabel: 'Suggestions, tous les rôles',
  roleRegion: (role: Role) => 'Rôle ' + role,
  toChoose: 'À choisir',
  locked: 'Verrouillé',
  vs: 'VS',
  waiting: 'En attente',
  hovered: 'Survolé',
  /** Draft en direct : ce joueur choisit son champion en ce moment. */
  picking: 'En train de choisir',
  hoverTip: (champion: string) => champion + ' survolé dans le client, hors calcul',
  allyFace: (picked: boolean, player: string | null, role: Role) =>
    'Saisie manuelle : ' + (picked ? 'changer le champion' : 'choisir le champion') + (player ? ' de ' + player : '') + ' en ' + role,
  allyFaceTip: (picked: boolean) => (picked ? 'Changer à la main' : 'Choisir à la main'),
  enemyFace: (picked: boolean, role: Role) => 'Saisie manuelle : ' + (picked ? 'changer le pick ennemi en ' : 'pick ennemi en ') + role,
  enemyFaceTip: (picked: boolean) => (picked ? 'Changer à la main' : 'Saisir à la main'),
  removeAlly: (champion: string, role: Role) => 'Retirer ' + champion + ' et rouvrir les suggestions en ' + role,
  removeEnemy: (champion: string, role: Role) => 'Retirer le pick ennemi ' + champion + ' en ' + role,
  removeTip: (champion: string) => 'Retirer ' + champion,
  swap: (role: Role) => 'Inverser les picks allié et ennemi en ' + role,
  swapTip: 'Inverser les picks',
  player: 'Joueur',
  noPlayer: 'Aucun joueur',
  noPool: 'Sans pool',
  playerIn: (role: Role, player: string | null) => 'Joueur en ' + role + ' : ' + (player ?? 'aucun'),
  playersFor: (role: Role) => 'Joueurs pour le rôle ' + role,
  placedIn: (role: Role) => 'Déjà placé en ' + role,
  poolTip: (player: string, role: Role, champions: string[]) => 'Pool ' + role + ' de ' + player + ' : ' + champions.join(', '),
  noPoolWarn: 'Sans pool : tous les champions',
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
  /** Nom accessible d'une card : note sur 20. */
  group: (champion: string, points: number, selected: boolean) => champion + ', ' + fmt1(points) + ' sur 20' + (selected ? ', présélectionné' : ''),
  /** Note sur 20 d'un pick. */
  points: (v: number) => fmt1(v),
  outOf20: '/20',
  pointsTip: (avg: number | null) =>
    'Note sur 20 : 10 pour 50 % de win rate attendu, 1 point par point de win rate (champion, ennemis, alliés, maîtrise), plus l’apport à ta compo' +
    (avg != null ? '. Moyenne du rôle : ' + fmt1(avg) : ''),
  pointsSampleTip: 'Note sur 20 : score sur 100 de la maquette divisé par 5 (données d’exemple)',
  fit: 'Compo',
  fitTip: 'Apport à ta compo, en points sur 20 : trait qui manque (+0,5 frontline, engage ou dégâts physiques, +0,25 peel), 3e frontline, 3e engage, 3e peel ou 3e source de dégâts magiques −0,5 (4e −1…), scaling dans la phase faible de ta compo, dégâts soutenus face à la frontline ennemie (+0,5 par frontline, 2 au plus, tant que ta compo n’en a pas ; le même malus pour les derniers picks qui n’en apportent pas)',
  lock: (champion: string, role: Role) => 'Verrouiller ' + champion + ' en ' + role,
  lockTip: 'Verrouiller',
  lockButton: 'Verrouiller',
  compo: (delta: number) => 'Compo ' + fmtDelta(delta),
  compoTip: 'Points que ce pick ajoute à la note de ta compo',
  expected: 'attendu',
  expectedTip: (base: number, avg: number | null, score: number) =>
    'Win rate attendu : ' + fmtPct(base) + " de base, plus l'effet des ennemis, des alliés et de la maîtrise" +
    (avg != null ? '. Moyenne du rôle : ' + fmtPct(avg) + ' (' + fmtSigned(score - avg) + ' pts)' : ''),
  enemies: 'Ennemis',
  allies: 'Alliés',
  mastery: 'Maîtrise',
  masteryNone: 'n/a',
  /** Aucun ennemi ou allié connu : rien à mesurer. */
  nobody: '—',
  enemiesTip: 'Effet de toute la compo ennemie connue (matchups), en points sur 20 : 1 par point de win rate (détail dans « vs … »)',
  alliesTip: 'Effet de tous les alliés verrouillés (synergies de duo), en points sur 20 : 1 par point de win rate (détail dans « avec … »)',
  masteryTip: (note: number | null) => (note == null ? "Pas de pool pour ce rôle, la maîtrise n'entre pas dans le score" : 'Maîtrise ' + note + '/10 : (note − 5) × 0,4 point sur 20'),
  synergy: 'Synergie',
  counter: 'Counter',
  outOf100: (label: string, v: number) => label + ' : ' + v + ' sur 100',
  lowSample: 'Peu fiable',
  sample: (games: number, low: boolean) => fmtInt(games) + ' parties' + (low ? ' : peu fiable' : ''),
  sampleTip: (games: number) => 'Échantillon de ' + fmtInt(games) + ' parties : sous 500 parties, le win rate est peu fiable',
  secondary: (share: number) => 'Rôle secondaire · ' + fmtInt(Math.round(share)) + ' %',
  secondaryTip: (role: Role) => 'Part des parties du champion jouées en ' + role,
  wr: (wr: number, lane: number | null) => 'WR ' + fmtPct(wr) + (lane != null ? ' · lane ' + fmtPct(lane) : ''),
  wrTip: (hasLane: boolean, base: number | null = null) =>
    'Win rate de partie sur ce rôle, tous adversaires' + (hasLane ? ', puis win rate de lane' : '') +
    (base != null ? '. Base du win rate attendu : ' + fmtPct(base) + ' (lissé vers 50 % selon le nombre de parties)' : ''),
  scaling: 'Scaling',
  scalingTip: 'Puissance au début, au milieu et en fin de partie',
  phaseTip: (phase: string, v: number) => phase + ' : ' + fmtScal(v) + ' sur 10'
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
  topLabel: 'Suggérés',
  topGroup: 'Bans suggérés les plus utiles',
  topTip: (champion: string, role: Role, detail: string) => champion + ' (' + role + ') : ' + detail,
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
  threatTip: (threat: number) => 'Menace ' + threat + ' sur 100',
  /** Panneau des bans (vue client) : valeur du ban et sa décomposition, une ligne par terme. */
  value: (value: number) => fmtSigned(value),
  /** Unité de la valeur, masquée sur une carte étroite (l'infobulle la donne). */
  unit: ' pts',
  valueTip: 'Ce que ce ban te rapporte, en points de win rate attendu : force du champion, plus la baisse de ta meilleure option s’il est ton vis-à-vis',
  strength: (winRate: number, games: number | undefined) => 'WR ' + fmtPct(winRate) + (games != null ? ' · ' + fmtInt(games) + ' parties' : ''),
  strengthTip: (strength: number) => 'Force ' + fmtSigned(strength) + ' : win rate lissé du champion sur le rôle, moins 50',
  versusOurs: (ours: string, drop: number) => 'Pour ' + ours + ' ' + fmtSigned(-drop),
  versusOursTip: (ours: string) => 'Écart du win rate attendu de ' + ours + ', ta meilleure option du rôle, s’il est ton vis-à-vis'
};

export const COMPO_TEXT = {
  unit100: '/100',
  scalingChart: (phase: string, ally: string, enemy: string) => phase + ' · ' + ally + ' contre ' + enemy + ' (sur 10)',
  aside: 'Analyse de la composition',
  /** Barre de résumé en bas d'écran (mobile) : un clic mène à l'analyse. */
  mini: "Aller à l'analyse de la composition",
  scores: 'Notes des compositions',
  ally: 'Ta compo',
  enemy: 'Compo ennemie',
  outOf100: 'Notes sur 100',
  allies: 'Alliés',
  enemies: 'Ennemis',
  scalingSection: 'Scaling des deux équipes',
  scaling: 'Scaling',
  reading: 'Lecture des compositions',
  /** Fin de draft (vue client) : les deux équipes complètes. */
  teams: 'Les deux équipes',
  archetype: (label: string, names: readonly string[]) => label + ' : ' + names.join(', '),
  archetypeTip: 'Archétype des champions d’après leur classe Riot (au moins 2 champions)',
  team: "Points d'attention sur l'équipe",
  teamTitle: 'Équipe',
  help: 'Aide',
  helpToggle: 'Lire les scores',
  helpItems: (measured: boolean): [string, string][] =>
    measured
      ? [
          ['Note sur 20', "10 pour 50 % de win rate attendu, 1 point par point de win rate, plus l'apport à ta compo. La note d'équipe sur 100 est le cumul des notes des picks connus."],
          ['Win rate attendu', "Win rate du champion sur le rôle (lissé vers 50 %), plus l'effet des ennemis connus (vis-à-vis ×1, duo bot adverse ×3/4, autres ×1/4), plus l'effet des alliés verrouillés (ADC et support ×1, autres ×1/2), plus la maîtrise : (note − 5) × 0,4 point, −2 hors pool. En mode Synergie, sans l'effet des ennemis ; en mode Counter, sans l'effet des alliés."],
          ['Ennemis et alliés', 'Chaque paire (matchup contre un ennemi, duo avec un allié) est mesurée sur Lolalytics. Une paire peu jouée est lissée vers la moyenne de sa paire de classes (par exemple Diver contre Vanguard) : plus elle est jouée, plus sa propre mesure compte.'],
          ['Compo', 'Apport à ta compo : un trait qui manque rapporte, deux porteurs d’un même trait sont neutres, le 3e coûte 0,5 point (le 4e 1 point). Plusieurs sources de dégâts physiques ne coûtent rien.'],
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
  playerActions: (player: string) => 'Partager ' + player,
  playerCopy: (player: string) => 'Copier ' + player,
  playerCopyTip: (player: string) => 'Copie ' + player + ' (Riot ID et pools) en JSON, à coller ailleurs',
  playerExport: (player: string) => 'Exporter ' + player,
  playerExportTip: (player: string) => 'Télécharge un fichier JSON avec ' + player + ', son Riot ID et ses pools',
  riotId: 'Riot ID',
  riotIdPlaceholder: 'Nom#TAG',
  riotIdTip: 'Draft en direct : joueur reconnu par son Riot ID, sinon par son pseudo, à quelques fautes près, puis placé sur le rôle attribué par le client',
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
  traits: { frontline: 'Frontline', engage: 'Engage', peel: 'Peel', physical: 'Dégâts physiques', early: 'Early game', late: 'Scaling tardif' },
  share: 'Partager la liste',
  copyButton: 'Copier',
  copyTip: 'Copie la liste des joueurs (Riot ID et pools) en JSON, à coller ailleurs',
  copied: 'JSON copié',
  copyFailed: 'Copie impossible : presse-papiers indisponible',
  pasteButton: 'Coller',
  pasteTip: 'Lit le JSON copié depuis Draft Assistant (presse-papiers) : les joueurs du même nom sont remplacés, les autres ajoutés',
  pasteLabel: 'JSON des joueurs',
  pastePlaceholder: 'Coller ici le JSON copié',
  pasteRead: 'Lire le JSON',
  exportButton: 'Exporter',
  exportTip: 'Télécharge un fichier JSON avec tous les joueurs, leurs Riot ID et leurs pools',
  importButton: 'Importer',
  importTip: 'Lit un fichier JSON exporté depuis Draft Assistant : les joueurs du même nom sont remplacés, les autres ajoutés',
  importFile: 'Fichier de joueurs à importer',
  importAsk: 'Importer ces joueurs',
  importReplaced: 'remplacé',
  importNew: 'nouveau',
  importUnknown: (names: readonly string[]) => 'Champions inconnus ignorés : ' + names.join(', '),
  importConfirm: (n: number) => 'Importer ' + n + (n > 1 ? ' joueurs' : ' joueur'),
  importDone: (n: number) => n + (n > 1 ? ' joueurs importés' : ' joueur importé'),
  importError: {
    NOT_JSON: 'Illisible : ce n’est pas du JSON.',
    BAD_FORMAT: 'Ce n’est pas une liste de joueurs exportée depuis Draft Assistant.',
    EMPTY: 'La liste ne contient aucun joueur.'
  } as Record<'NOT_JSON' | 'BAD_FORMAT' | 'EMPTY', string>
};

export const PICKER_TEXT = {
  close: 'Fermer',
  search: 'Rechercher un champion',
  notFound: 'Aucun champion trouvé.',
  unavailable: (champion: string, why: string) => champion + ', indisponible : ' + why,
  roleFilter: 'Filtrer par rôle',
  all: 'Tous'
};

export const QUICK_TEXT = {
  region: 'Saisie rapide',
  sides: 'Camp de la saisie rapide',
  enemy: 'Ennemi',
  ally: 'Allié',
  input: (side: 'ally' | 'enemy') => 'Saisie rapide : pick ' + (side === 'enemy' ? 'ennemi' : 'allié'),
  placeholder: 'Champion',
  shortcut: '/',
  shortcutTip: 'Raccourci : /',
  options: 'Champions',
  place: (champion: string, role: Role) => champion + ' en ' + role,
  replaces: (current: string) => 'remplace ' + current,
  notFound: 'Aucun champion trouvé.'
};

/** Vue client de l'écran Draft (grand écran) : textes propres à cette vue. */
export const VIEW_TEXT = {
  focus: (role: Role) => 'Suggestions en ' + role,
  manual: 'Choix manuel',
  manualIn: (role: Role) => 'Choix manuel du champion en ' + role,
  best: 'Meilleur',
  noData: '—',
  /** Panneau des deux équipes (fin de draft) */
  damage: { AD: 'AD', AP: 'AP', TANK: 'Tank' } as Record<'AD' | 'AP' | 'TANK', string>,
  damageTip: (counts: string) => 'Type de dégâts des picks connus : ' + counts,
  noPick: 'Aucun pick',
  /** Effet du pick ennemi sur ton pick de la même lane, en points de win rate attendu. */
  versus: (ally: string) => 'Pour ' + ally,
  versusTip: (ally: string, enemy: string) => 'Effet de ' + enemy + ' sur le win rate attendu de ' + ally + ' : écart lissé, pondéré (vis-à-vis ×1, autres lanes moins), en points',
  enemyWr: 'WR',
  enemyWrTip: (role: Role) => 'Win rate du champion en ' + role + ', toutes régions'
};
