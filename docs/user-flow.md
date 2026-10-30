# User flow : navigation dans l'appli

État au 29/10/2026 (après l'appli 0.5). Deux écrans, choisis dans l'en-tête : **Joueurs** et **Draft**. La draft se remplit à la main ou toute seule depuis le client LoL (appli desktop ou `npm run bridge`).

## Vue d'ensemble

```mermaid
flowchart TD
  start([Ouverture de l'appli]) --> launch{Appli desktop ?}
  launch -- oui --> update[Vérification de la mise à jour<br/>téléchargée puis installée à la fermeture]
  launch -- non, site --> draft
  update --> draft

  subgraph header[En-tête, toujours visible]
    nav[Joueurs · Draft]
    chip[Patch · rang · source<br/>bouton de mise à jour des stats sur desktop]
    client[État du client LoL]
    reset[Nouvelle draft<br/>confirmation]
  end

  draft[Écran Draft] <--> players[Écran Joueurs]
  nav -.-> draft
  nav -.-> players
  reset -.-> draft
```

## Écran Joueurs

```mermaid
flowchart TD
  players[Écran Joueurs] --> list[Liste des joueurs<br/>cartes illustrées]
  players --> create[Créer un joueur]
  players --> share[Partager la liste<br/>Copier · Coller · fichier]
  list -- clic sur un joueur --> detail[Fiche du joueur]
  create --> detail
  share -- coller --> preview[Aperçu de l'import] -- confirmer --> list

  detail --> riot[Riot ID<br/>reconnaissance en draft en direct]
  detail --> me[Bouton « Moi »<br/>build proposé pour son pick]
  detail --> one[Copier le joueur · fichier]
  detail --> del[Supprimer le joueur<br/>confirmation]
  detail --> roles[Rôle : Top · Jungle · Mid · ADC · Support]
  roles --> pool[Pool du rôle<br/>maîtrise − / +, retirer]
  roles --> add[Ajouter un champion<br/>recherche]
  roles --> cover[Couverture du pool<br/>et échelle de maîtrise]
```

## Écran Draft

```mermaid
flowchart TD
  draft[Écran Draft] --> source{Draft lue dans le client ?}
  source -- oui, sélection en cours --> live[Picks, bans, rôles, ordre de pick,<br/>joueurs et survols remplis tout seuls]
  source -- non --> manual[Saisie à la main<br/>saisie rapide, + des bans, clic sur une case vide]
  live --> phase
  manual --> phase

  phase{Phase de la draft} -- bans --> bans
  phase -- picks --> picks
  phase -- complète --> teams
  tabs[Onglets fixes du centre<br/>Bans · Picks · Build · Équipes] -. clic : gardé jusqu'à la phase suivante .-> bans & picks & build & teams

  bans[Bans<br/>suggestions par rôle, clic : bannir]
  picks[Picks<br/>rôle choisi : cartes du pool, liste hors pool]
  teams[Équipes<br/>notes, faits marquants, scaling]
  build[Build · champion en focus]

  allyCard[Carte alliée] -- clic --> picks
  allyCard --> player[Choix du joueur]
  allyCard --> dnd[Glisser-déposer du pick]
  picks -- clic sur une carte ou une ligne --> focus[Champion en focus]
  enemyCard[Pick ennemi] -- clic --> focus
  focus --> build
  picks -- Verrouiller --> next[Rôle ouvert suivant]
  build --> styles[Styles : Bruiser, AP, Tank…]
  build --> portraits[Barre des picks]
  portraits --> focus
```

## Règles de navigation

- **Onglets fixes** : Bans, Picks, Build et Équipes sont toujours visibles. L'onglet actif suit la phase (bans, puis picks, puis draft complète). Un onglet choisi d'un clic reste affiché jusqu'au changement de phase suivant.
- **Champion en focus, partagé par Picks et Build** : un clic sur une suggestion (carte ou ligne), sur un portrait de la barre des picks ou sur un pick ennemi le choisit. Sans clic : ton pick (joueur connecté au client, sinon « Moi »), sinon le champion du rôle choisi ou affiché (verrouillé, sinon la meilleure suggestion).
- **Choisir un rôle** (carte alliée) ouvre Picks sur ce rôle ; son pick verrouillé devient le champion en focus.
- **Après un verrouillage** depuis le centre, le rôle ouvert suivant s'affiche dans Picks.
- **Build d'un ennemi** : calculé de son point de vue (son équipe, ton équipe en face).
- **Build sur un seul écran** : barre des picks des deux équipes au-dessus, en-tête (champion, styles), puis runes principales en cartes, sorts / départ / bottes, chemin d'objets avec les 4e à 6e objets, et situationnels ; les autres options en petites icônes après « ou ».
- **Écran Joueurs** : les changements sont enregistrés tout de suite sur l'appareil ; la draft en cours est gardée en changeant d'écran.
