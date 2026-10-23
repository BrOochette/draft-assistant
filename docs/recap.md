# Draft Assistant LoL : récapitulatif de conception

Ce document résume les décisions prises pendant la phase de maquette, et la réflexion code et architecture qui a suivi. Il sert de point de départ au développement.

Statut des décisions :
- **Décidé** : validé par le porteur du projet.
- **Proposé** : recommandation technique, pas encore validée.
- **Ouvert** : question à trancher.

---

## 1. Le produit

Une application web d'aide à la draft sur League of Legends. Elle propose, pour chaque rôle, les meilleurs champions à jouer selon :
- les synergies avec les picks alliés ;
- les counters face aux picks ennemis connus ;
- la maîtrise du joueur placé sur le rôle ;
- le scaling des deux équipes ;
- les bans.

**Décidé**
- Usage strictement personnel, non lucratif, pour une seule personne. Pas de comptes, pas d'équipe partagée, pas de public pour l'instant.
- Application web, stack TypeScript partout.
- Données hybrides : attributs de champions (frontline, engage, peel, type de dégâts) plus statistiques (win rates).
- Saisie manuelle de la draft d'abord. Lecture automatique du client de jeu « plus tard », sans engagement.
- Le moteur doit répondre en **moins d'une seconde**. En draft, on n'a que quelques secondes pour décider.

---

## 2. Concepts métier

### Joueurs et pools

- Chaque joueur a un **champion pool par rôle**, avec une **note de maîtrise sur 10** par champion.
- Avant la draft, on **place un joueur sur chaque rôle**. Le pool utilisé est celui du joueur pour ce rôle précis.
- Si le joueur n'a **pas de pool pour ce rôle**, on propose **tous les champions du rôle**, et la maîtrise n'entre pas dans le score.
- On **ne connaît pas les pools des joueurs ennemis**. Ils ne servent pas dans le calcul, y compris pour les bans.

### Règle de pool pour les recommandations

- Les picks proposés par défaut viennent **du pool du joueur**.
- Les champions **hors pool** n'apparaissent que dans le détail d'une ligne (« Plus de détails »), dans une section séparée « Hors pool ».
- Si aucun champion du pool n'est disponible (tous bannis ou pris), la ligne affiche les meilleurs hors pool, avec une note factuelle qui le signale.

### Règle de counter

- On prend en compte **deux win rates** : le **win rate de lane** et le **win rate de partie**. Un champion peut gagner sa lane puis se faire outscale (exemples cités : Kayle, Kassadin, Mundo).
- Le **scaling** (début, milieu, fin de partie) est un paramètre important pour construire une draft.

### Interaction

- La vue est **interactive** : verrouiller un pick recalcule les recommandations des autres rôles.
- On affiche une **note globale de composition** sur 100, plus rapide à lire que des listes de points forts et faibles.

---

## 3. Règles d'interface

**Décidé**, à respecter partout :

1. **Ton factuel.** Pas de phrases de conseil (« il te manque… »), pas d'instructions d'usage (« clique ici pour… »).
2. **Pas de compteurs ni de textes non pertinents** : pas de taille de pool (« Pool Top : 4 champions »), pas de « 2 picks connus sur 5 », pas de « Bans : 3 alliés, 3 ennemis ».
3. **Cards de recommandation compactes** : l'image du champion, sans son nom. L'image suffit, et la place libérée sert à d'autres infos. Le nom apparaît dans la card dépliée.
4. Le tag s'écrit **« Pool »**, pas « Dans le pool de X ». Les autres valeurs sont « Hors pool » et « Tous les champions ».
5. **Win rates en chips** avec icône et libellé court : « Lane 54,5 % » et « Partie 49,0 % », avec une infobulle.
6. **Saisie manuelle en secours** si l'automatisation échoue :
   - clic sur le portrait d'un champion allié ou ennemi, ou sur le slot vide (« ? » ou « + »), pour ouvrir un sélecteur avec recherche ;
   - clic sur un slot « + » des bans pour ajouter un ban ;
   - les champions indisponibles (bannis, pris) sont grisés avec la raison.
7. **Interaction d'une card**, version 2 : un clic sélectionne la card, qui affiche alors un bouton « Verrouiller ». Le double clic de la v1 est abandonné : peu découvrable et inexistant au tactile.
8. Un pick verrouillé se **retire avec une croix** sur l'avatar du champion. Pas de bouton « Changer de pick ».
9. **Pas de notion de tour.** Tous les rôles ouverts affichent leurs suggestions en même temps. Pas de barre de tour actif, pas de chrono.
10. **Bans dans la même vue que la draft.** Pas d'écran de bans séparé.
11. **Vue « face à face » par lane** : l'allié et l'ennemi d'un même rôle côte à côte. C'est la seule vue de draft.
12. Accessibilité : texte de 13 px minimum, cibles tactiles de 44 px, et les états ne reposent jamais sur la couleur seule (icône plus mot : « Verrouillé », « Sélectionné », « À choisir »).
13. Interface en français.

---

## 4. Les maquettes

Les fichiers sont dans `maquettes/`. Voir `maquettes/README.md` pour le format.

| Fichier | Statut | Contenu |
|---|---|---|
| `1-joueurs.dc.html` | Référence | Liste des joueurs, pools par rôle, notes de maîtrise (boutons + et -), ajout d'un champion, couverture du pool par trait, échelle de maîtrise. |
| `2-composition-obsolete.dc.html` | Obsolète | Placement des joueurs sur les rôles. Fusionné dans la Draft v2. |
| `3-draft-v1.dc.html` | Historique | Première version de la draft, gardée pour comparaison. Rails de bans à gauche et à droite, double clic pour verrouiller. |
| `4-draft-v2.dc.html` | **Référence principale** | La version retenue. Décrite ci-dessous. |

### Draft v2 : structure de l'écran

**En-tête.** Navigation (Joueurs, Draft), chip « Patch 26.21 · Emerald+ », bouton « Nouvelle draft » avec confirmation (« Effacer tes picks et sélections ? »).

**Barre des bans.** 5 slots alliés et 5 slots ennemis :
- un slot rempli montre le portrait barré, et un clic retire le ban ;
- un slot vide « + » ouvre le sélecteur avec recherche et filtre par rôle ;
- un bouton « Suggestions de bans » déplie des cards (portrait, rôle, score de menace, raison, bouton « Bannir »).

**Cinq lignes de rôle** (Top, Jungle, Mid, ADC, Support). Chaque ligne contient :
- **à gauche** : le rôle et un chip d'état, puis le portrait allié « VS » le portrait ennemi, les deux cliquables pour la saisie manuelle. En dessous, le sélecteur de joueur (fusion de l'ancien écran Composition) et des avertissements (« Sans pool : tous les champions », « Placé sur plusieurs rôles ») ;
- **au centre, si le rôle est ouvert** : les **3 meilleures recommandations** en cards compactes. Chaque card montre le portrait avec son rang, le score sur 100, « Compo +N », trois mini barres (Synergie, Counter, Maîtrise), les chips Lane et Partie, et un chip « Peu fiable » si l'échantillon est faible. Un bouton « Plus de détails » déplie la liste complète : pool puis hors pool, avec le nom, le tag, le score, 3 raisons, les barres, le scaling D M F et le nombre de parties ;
- **au centre, si le rôle est verrouillé** : un résumé avec le score, « Compo +N », le tag, les chips Lane et Partie, le nombre de parties, les barres, le scaling et les raisons. Pour Top et Support, les raisons sont des notes de matchup et de compo ;
- **en dessous, si ouvert** : le sélecteur manuel (recherche, grille de portraits, raisons d'indisponibilité, bouton « Effacer » pour un pick ennemi).

**Colonne de droite**, collée en haut au défilement et repassant sous la draft en dessous de 1100 px :
- note de ta compo sur 100, verdict, et note ennemie ;
- 5 critères avec barres et infobulles : Frontline, Engage, Peel, Mix de dégâts, Scaling ;
- scaling des deux équipes par phase, avec verdict (Avantage, Équilibre, Désavantage) ;
- lecture factuelle de ta compo (+ et -) et de la compo ennemie ;
- bloc « Équipe » d'avertissements, visible seulement s'il y en a ;
- bloc repliable « Lire les scores » avec les définitions.

**Notification d'annulation.** Chaque verrouillage, retrait, ban ou saisie manuelle affiche « Annuler » en bas de l'écran.

> Note : sur la version publiée de la maquette, la notification d'annulation a disparu après une modification sur le canvas, peut-être involontaire. La copie fournie ici la contient. **Décidé** (23/10/2026) : la notification est gardée.

### Hypothèse de la maquette à revoir

Dans la maquette, Top et Support sont **verrouillés d'office** (Aurora et Brand) et seuls Jungle, Mid et ADC sont ouverts. C'est une simplification des données d'exemple. **Décidé** (23/10/2026) : dans l'application, les 5 rôles sont ouverts. Aurora et Brand ne sont que des picks de l'état initial, et se retirent avec la croix comme les autres.

---

## 5. Le moteur de recommandation

Le **moteur** est le module qui calcule, sans rien afficher. Il reçoit l'état de la draft et renvoie des résultats. Dans la maquette, ce calcul est mélangé à l'affichage (fonction `renderVals` de `4-draft-v2.dc.html`). Dans l'application, il doit être un module pur, indépendant de l'interface.

### Entrées

- État de la draft : picks alliés par rôle, picks ennemis par rôle, bans alliés et ennemis.
- Placement : le joueur sur chaque rôle, avec son pool (champion et maîtrise sur 10).
- Catalogue : attributs par champion (rôles, type de dégâts AP, AD ou TANK, apports Frontline, Engage, Peel, scaling début, milieu et fin de 1 à 5).
- Stats : par champion et par rôle (win rate de lane, win rate de partie, nombre de parties), et par matchup.

### Sorties

- Pour chaque rôle ouvert : les candidats classés, avec score total, détail synergie, counter et maîtrise, « Compo +N », tag pool, **raisons sous forme de codes**, et indicateur d'échantillon faible.
- Note de compo alliée et ennemie, avec les 5 critères.
- Comparaison de scaling par phase.
- Suggestions de bans.

### Formules de la maquette

Ces formules sont celles de la maquette, **Proposé** comme point de départ. Les poids sont à ajuster avec de vraies données.

**Synergie** (0 à 100) :
- On part d'une base par champion (`synergyBase`). Dans la maquette, c'est une valeur d'exemple. **Ouvert** : comment la dériver des stats réelles.
- Pour chaque apport du champion (Frontline +12, Engage +10, Dégâts physiques +10, Peel +6) : on ajoute le bonus si l'équipe ne l'a pas encore, sinon on retire 3 (raison « déjà couvert par X »).
- Un champion AP quand l'équipe a déjà 2 sources AP ou plus : -4.
- Besoin de scaling : on prend la phase où l'équipe alliée est le plus en retard sur l'ennemi. Si l'écart moyen est de -0,5 ou moins, on ajoute `(scaling du candidat sur cette phase - 3) × 4`.
- Le résultat est borné entre 0 et 100.
- Un champion AD apporte implicitement « Dégâts physiques ».

**Counter** (0 à 100) :
- `wrScore(wr) = borne(50 + (wr - 50) × 10)`
- `counter = 0,4 × wrScore(lane) + 0,6 × wrScore(partie)`

**Score total** :
- avec pool : `0,40 × synergie + 0,35 × counter + 0,25 × maîtrise`, où la maîtrise vaut note × 10 et un hors pool compte 0 ;
- sans pool : `0,55 × synergie + 0,45 × counter`.

**Note de compo** (0 à 100), moyenne pondérée :

| Critère | Valeur si présent | Valeur si absent | Poids |
|---|---|---|---|
| Frontline | 100 | 20 | 25 |
| Engage | 100 | 25 | 25 |
| Peel | 100 | 30 | 15 |
| Mix de dégâts (au moins un AP et un AD) | 100 | 35 | 15 |
| Scaling | `borne(60 + 20 × écart minimal)` | | 20 |

L'écart minimal est le plus petit écart, sur les 3 phases, entre le scaling moyen allié et le scaling moyen ennemi.

- Verdicts : Solide à partir de 75, Correcte à partir de 55, Fragile à partir de 35, À corriger en dessous.
- **Compo +N** = note de compo avec le candidat moins note de compo sans lui.

**Échantillon faible** : moins de 500 parties affiche « Peu fiable ». **Proposé** : lisser les win rates vers la moyenne du champion :

```
win rate lissé = (victoires + 200 × moyenne du champion) / (parties + 200)
```

**Raisons** : la maquette produit des phrases. **Proposé** : le moteur renvoie des codes avec paramètres (`{code: "FRONTLINE_COVERED", by: "Sejuani"}`), et l'interface les traduit en texte. Le ton factuel reste ainsi géré à un seul endroit.

**Suggestions de bans** : la maquette utilise un score de menace fixe. **Ouvert** : la formule réelle (win rate, taux de ban, menace contre la compo alliée prévue). Rappel : on ne connaît pas les pools ennemis.

### Tests de référence

`data/sample/golden-scenarios.json` contient les sorties exactes de la maquette pour quatre scénarios. Un premier portage du moteur doit les reproduire à l'identique, avant tout ajustement des formules. Par exemple, dans l'état initial, la Jungle propose Sejuani 74, Fiddlesticks 72, Viego 67. Avec Sejuani, Orianna et Ashe verrouillés, la compo vaut 90, « Solide ».

### Performance

**Décidé** : réponse en moins d'une seconde. **Proposé** :
- budget de **50 ms pour le moteur** et de 100 ms entre un clic et l'écran à jour ;
- **aucun appel réseau pendant la draft** : les stats sont chargées en mémoire au démarrage ;
- tout le travail lourd (agrégation, lissage, scaling) est fait **hors draft**, par l'outil d'ingestion ;
- matchups rangés dans des tables indexées par identifiant de champion, pour une lecture directe ;
- **pas de recherche combinatoire complète**. Si un jour on cherche la meilleure compo complète, on se limite aux meilleurs candidats de chaque rôle (par exemple 8 par rôle) ;
- un test de performance sur le pire cas (aucun pool, tous les champions du rôle, 10 bans), qui échoue au-delà du budget ;
- un Web Worker seulement si l'interface rame.

---

## 6. Données : d'où viennent les stats

**Ouvert** : la source des statistiques n'est pas tranchée. Le porteur du projet préfère éviter une collecte de plusieurs jours, et penche pour une source tierce.

### API Riot (calcul maison)

- **Gratuite**, pas de crédits. Les limites sont en nombre de requêtes.
- Clés :
  - développement : expire toutes les 24 h ;
  - personnelle : usage privé, 20 requêtes par seconde et 100 par 2 minutes, par région, sans augmentation possible ;
  - production : produits publics validés par Riot, 500 requêtes par 10 secondes au départ.
- Pipeline :
  1. `league-v4` pour lister les joueurs du rang visé (identifiants `puuid`) ;
  2. `match-v5`, liste des parties classées solo par joueur, dédoublonnées et filtrées par patch ;
  3. détail de chaque partie (champion, `teamPosition`, équipe, victoire, durée, version) ;
  4. timeline pour la lane (or et expérience par minute) ;
  5. agrégation par champion et rôle, par matchup de lane, par tranche de durée (scaling mesuré), puis par paires alliées (synergies).
- Volume avec clé personnelle : environ 1 500 parties par heure en comptant la timeline, soit environ 3 jours pour 100 000 parties.
- Les données statiques (noms, images) viennent de **Data Dragon**, qui ne compte pas dans les limites. Les portraits de la maquette viennent du patch 16.21.1. Voir `data/ddragon-ids.json`.
- Les attributs Frontline, Engage et Peel **n'existent pas dans l'API**. Il faut un fichier d'attributs maison d'environ 170 champions.
- **Ouvert** : la définition exacte du win rate de lane (avance en or et en XP à 15 minutes, seuil à fixer).
- À vérifier : le découpage exact des régions pour les limites de `match-v5`, et les General Policies de Riot avant un crawl de masse.

### Sources tierces : ce qui a été vérifié

| Site | Collecte automatisée | Détail |
|---|---|---|
| OP.GG | Interdite | Les conditions proscrivent les scripts automatisés, le scraping et la réutilisation. |
| OP.GG, serveur MCP | Non précisé | `mcp-api.op.gg`, publié par OP.GG. Expose counters, win rates par position et stats méta. Aucune condition d'usage des données trouvée, aucun outil de matchup de lane vu, stabilité non garantie. |
| Mobalytics | Interdite | Les conditions proscrivent l'accès par robots, crawlers et outils de data mining. |
| dpm.lol | Interdite sur les pages utiles | Conditions introuvables. Le robots.txt interdit à tous les robots `/champions/synergy` et `/champions/versus`. |
| Lolalytics | Tolérée par le robots.txt | Conditions introuvables. Le robots.txt autorise les robots génériques, avec un signal « recherche oui, entraînement d'IA non ». |

Un robots.txt n'est pas une autorisation juridique. Les pistes raisonnables :
- Lolalytics, avec une collecte légère et identifiée, une fois par patch ;
- une demande écrite d'accès pour usage personnel ;
- le serveur MCP d'OP.GG pour un premier test.

**Décidé** (23/10/2026) : le moteur lit une interface `StatsProvider`. L'application démarre sur les données d'exemple (`npm run ingest -- sample`). La vraie source se branchera ensuite sans toucher au moteur.

---

## 7. Architecture proposée

**Décidé** (23/10/2026), avec des workspaces npm et sans serveur (moteur dans le navigateur, pools dans IndexedDB, snapshot de stats statique) :

```
draft-assistant/
  packages/
    engine/     logique pure : scores, note de compo, recommandations, bans
    schemas/    types et validation (Champion, Pool, StatsSnapshot, DraftState)
  apps/
    web/        React + Vite, écrans Joueurs et Draft v2
    ingest/     CLI Node : collecte des stats, agrégation, snapshot par patch
  data/
    champions.json              attributs maison
    stats/patch-XX.YY.json      snapshot généré par ingest
```

Principes :

1. **Moteur pur et testé** : pas d'accès au DOM, au réseau ni au stockage. Testé avec les fixtures de `data/sample/`.
2. **`StatsProvider`** : interface qui découple le moteur de la source des stats.
3. **Raisons en codes**, traduites par l'interface.
4. **État de la draft en réducteur** : actions immuables (verrouiller, retirer, bannir, saisir un pick ennemi, placer un joueur), et historique pour l'annulation.
5. **`DraftSource`** : interface pour la source de la draft. La saisie manuelle maintenant, la lecture du client plus tard.
6. **Pas de serveur au départ** : pools et réglages dans IndexedDB, stats en fichier statique chargé au démarrage.
7. **Sécurité** : la clé Riot ne vit que dans `ingest` (variable d'environnement, jamais commitée, jamais dans le code web). Si une clé a déjà été collée quelque part, la régénérer.

---

## 8. Étapes suggérées

1. **Moteur** : porter la logique de `4-draft-v2.dc.html` dans `packages/engine`, avec des tests qui reproduisent `golden-scenarios.json`, plus le test de performance.
2. **Interface web** : écrans Draft v2 et Joueurs en React, branchés sur le moteur, pools persistés dans IndexedDB.
3. **Vraies données statiques** : catalogue complet depuis Data Dragon (noms, images) et fichier d'attributs maison.
4. **Stats réelles** : choisir la source (section 6), écrire le `StatsProvider` et l'outil d'ingestion, générer le premier snapshot de patch.
5. Plus tard : import automatique des pools depuis le mastery et l'historique Riot, puis lecture automatique du client.

## 9. Questions ouvertes

- Source des statistiques (section 6).
- Définition et seuil du win rate de lane.
- Comment dériver la base de synergie des stats réelles.
- Formule des suggestions de bans.
- Tranches de durée du scaling mesuré (proposé : moins de 25 min, 25 à 35, plus de 35).
