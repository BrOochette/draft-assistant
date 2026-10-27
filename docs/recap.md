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
- Saisie manuelle de la draft d'abord. Lecture automatique du client de jeu « plus tard », sans engagement. Mise en place le 25/10/2026 (section 10).
- Le moteur doit répondre en **moins d'une seconde**. En draft, on n'a que quelques secondes pour décider.

---

## 2. Concepts métier

### Joueurs et pools

- Chaque joueur a un **champion pool par rôle**, avec une **note de maîtrise sur 10** par champion.
- Avant la draft, on **place un joueur sur chaque rôle**. Le pool utilisé est celui du joueur pour ce rôle précis.
- Si le joueur n'a **pas de pool pour ce rôle**, on propose **tous les champions du rôle**, et la maîtrise n'entre pas dans le score.
- **Décidé** (23/10/2026) : placer un joueur n'est pas obligatoire. Un rôle sans joueur (« Aucun joueur ») se comporte comme un joueur sans pool. Supprimer un joueur le retire des rôles où il était placé.
- On **ne connaît pas les pools des joueurs ennemis**. Ils ne servent pas dans le calcul, y compris pour les bans.

### Règle de pool pour les recommandations

- Les picks proposés par défaut viennent **du pool du joueur**.
- Les champions **hors pool** n'apparaissent que dans le détail d'une ligne (vue liste), dans une section séparée « Hors pool ».
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
7. **Interaction d'une card**, version 3 (décidé le 24/10/2026) : un bouton cadenas, icône seule, en haut à droite de la card verrouille le champion en un clic. Il apparaît au survol de la card (ou au clavier), et reste affiché quand un clic sur la card la présélectionne (bordure accent). Sur écran tactile, il est toujours visible. La v2 (un clic sélectionne la card, puis bouton « Verrouiller ») demandait deux clics ; le double clic de la v1 était peu découvrable et inexistant au tactile.
8. Un pick verrouillé se **retire avec une croix** sur l'avatar du champion. Pas de bouton « Changer de pick ».
9. **Pas de notion de tour.** Tous les rôles ouverts affichent leurs suggestions en même temps. Pas de barre de tour actif, pas de chrono.
10. **Bans dans la même vue que la draft.** Pas d'écran de bans séparé.
11. **Vue « face à face » par lane** : l'allié et l'ennemi d'un même rôle côte à côte. C'est la seule vue de draft. **Remplacé sur grand écran** le 25/10/2026 par la vue client (section 11) ; gardé en dessous de 1200 px.
12. Accessibilité : texte de 13 px minimum, cibles tactiles de 44 px, et les états ne reposent jamais sur la couleur seule (icône plus mot : « Verrouillé », « Sélectionné », « À choisir »).
13. Interface en français.

---

## 4. Les maquettes

Les fichiers sont dans `maquettes/`. Voir `maquettes/README.md` pour le format.

| Fichier | Statut | Contenu |
|---|---|---|
| `1-joueurs.dc.html` | Référence | Liste des joueurs, pools par rôle, notes de maîtrise (boutons + et -), ajout d'un champion (liste déroulante maison avec portraits, tous les champions du catalogue avec leurs rôles habituels à droite (décidé le 24/10/2026), sans ceux déjà dans le pool : un clic ou Entrée l'ajoute avec la note 5, décidé le 24/10/2026), couverture du pool par trait, échelle de maîtrise. |
| `2-composition-obsolete.dc.html` | Obsolète | Placement des joueurs sur les rôles. Fusionné dans la Draft v2. |
| `3-draft-v1.dc.html` | Historique | Première version de la draft, gardée pour comparaison. Rails de bans à gauche et à droite, double clic pour verrouiller. |
| `4-draft-v2.dc.html` | **Référence principale** | La version retenue. Décrite ci-dessous. |

### Draft v2 : structure de l'écran

**En-tête.** Navigation (Joueurs, Draft), chip « Patch 26.21 · Emerald+ », bouton « Nouvelle draft » avec confirmation (« Effacer tes picks et sélections ? »).

**Barre des bans.** En haut, le titre « Bans » à gauche et le bouton « Suggestions de bans » (32 px) à droite ; en dessous, les 5 slots alliés à gauche et les 5 slots ennemis collés à droite, en miroir (décidé le 24/10/2026) :
- un slot rempli montre le portrait barré, et un clic retire le ban ;
- un slot vide « + » ouvre le sélecteur avec recherche et filtre par rôle ;
- un bouton « Suggestions de bans » déplie les suggestions groupées par rôle, 3 par rôle encore ouvert (décidé le 24/10/2026) : portrait, nom, win rate (la menace, qui en découle, est dans l'infobulle) et bouton « Bannir ». Le snapshot garde 8 candidats par rôle : quand l'un est banni ou pris, le suivant le remplace.

**Cinq lignes de rôle** (Top, Jungle, Mid, ADC, Support). Chaque ligne contient :
- **à gauche** : le rôle et un chip d'état, puis le portrait allié « VS » le portrait ennemi, les deux cliquables pour la saisie manuelle. En dessous, le sélecteur de joueur (fusion de l'ancien écran Composition) et des avertissements (« Sans pool : tous les champions », « Placé sur plusieurs rôles ») ;
- **au centre, si le rôle est ouvert** : les **3 meilleures recommandations** en cards compactes. Chaque card montre le portrait avec son rang, le score sur 100, « Compo +N », trois mini barres (Synergie, Counter, Maîtrise), le chip « WR » (win rate de partie ; Lane et Partie fusionnés le 24/10/2026, faute de win rate de lane), puis « vs adversaire », une info par ligne avec les noms complets, alignées en haut pour que les lignes se correspondent d'une card à l'autre (décidé le 24/10/2026), puis « avec allié(s) +N » quand un allié verrouillé a un duo mesuré : sa fenêtre flottante détaille, par allié, l'écart en duo brut et lissé, le poids (4 divisé par le nombre d'alliés) et l'effet sur la synergie (décidé le 24/10/2026), et un chip « Peu fiable » si l'échantillon est faible. Deux boutons collés à icônes, « Vue top 3 » et « Vue liste », choisissent l'affichage : la liste remplace les 3 cards (décidé le 24/10/2026). Elle montre les 10 premiers champions, et « Voir plus » en bas en ajoute 10 à chaque clic ; tout à droite, un bouton chevron (sans texte) ramène en haut de la ligne du rôle, et un champ de recherche au-dessus porte sur tous les autres (décidé le 24/10/2026) : pool puis hors pool, avec le nom, le tag, le score, 3 raisons, les barres, le scaling D M F et le nombre de parties ;
- **au centre, si le rôle est verrouillé** : un résumé avec le score, « Compo +N », le tag, le chip « Win rate », le nombre de parties, les barres, le scaling et les raisons. Pour Top et Support, les raisons sont des notes de matchup et de compo ;
- **en dessous, si ouvert** : le sélecteur manuel (recherche, grille de portraits, raisons d'indisponibilité, bouton « Effacer » pour un pick ennemi).

**Colonne de droite**, collée en haut au défilement et repassant sous la draft en dessous de 1100 px :
- une seule carte pour les deux compos : note sur 100 et verdict de chaque équipe, puis les 5 critères (Frontline, Engage, Peel, Mix de dégâts, Scaling) avec une barre alliée et une barre ennemie, comme le bloc de scaling. La note ennemie porte sur ses picks connus (**Décidé** le 23/10/2026, ajout par rapport à la maquette) ;
- scaling des deux équipes par phase, avec verdict (Avantage, Équilibre, Désavantage) ;
- lecture factuelle de ta compo (+ et -) et de la compo ennemie ;
- bloc « Équipe » d'avertissements, visible seulement s'il y en a ;
- bloc repliable « Lire les scores » avec les définitions.

**Notification d'annulation.** Dans la maquette, chaque verrouillage, retrait, ban ou saisie manuelle affiche « Annuler » en bas de l'écran.

> **Décidé** (23/10/2026) : la notification est retirée. On corrige à la main (croix sur un pick, clic sur un ban, sélecteur). Le réducteur du moteur garde son historique (`undo`), sans usage dans l'interface pour l'instant.

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

### Win rate attendu (stats mesurées)

**Décidé** (24/10/2026), après l'avis critique : avec les stats Lolalytics, le score affiché et le classement deviennent un seul **win rate attendu en %** (« 54,0 % attendu »). Il remplace le score sur 100 (synergie à bonus fixés à la main, counter = win rate × 10) qui mélangeait deux échelles.

```
attendu = WR du champion sur le rôle, lissé vers 50 % (3 000 parties fictives)
        + Σ ennemis connus : poids × écart du matchup
            vis-à-vis ×1, duo bot adverse ×3/4, autres lanes ×1/4
        + Σ alliés verrouillés : poids × écart du duo
            ADC et support entre eux ×1, autres ×1/2 (Provisoire)
        + maîtrise : (note − 5) × 0,4 point avec un pool (note 10 : +2, note 1 : −1,6, hors pool : −2), 0 sans pool
```

- **Écart d'un matchup** (« à somme nulle », décidé le 26/10/2026) : win rate du champion contre l'ennemi moins celui attendu des deux win rates seuls, **50 + WR du champion − WR de l'ennemi** sur son rôle (avant : moins le WR du champion seul, ce qui pénalisait les deux côtés d'un face-à-face entre deux champions au-dessus de 50 %). Ce que l'un gagne, l'autre le perd. Lissé avec 1 000 parties fictives vers la **moyenne de leur paire de classes**, elle aussi calculée à somme nulle (ennemi sans stats sur son rôle : 50 %) (par exemple Diver contre Vanguard). Toutes les paires mesurées comptent (dès 30 parties à la collecte) : le seuil de 500 parties est **remplacé** par ce lissage. Une paire absente des données prend la moyenne de classe seule ; sans moyenne non plus, sa ligne affiche « Pas de données » et compte 0.
- **Écart d'un duo** : écart de win rate du duo (Lolalytics), lissé avec 200 parties fictives vers la moyenne de leur paire de classes.
- **Moyennes de classe** (`classPriors` du snapshot) : pour chaque paire « rôle, classe principale Riot, rôle de l'autre, classe de l'autre », moyenne des écarts pondérée par les parties, sur tous les candidats. Exemples sur le patch 16.21 : Top Juggernaut avec Jungle Vanguard +0,8 pt, Top Skirmisher avec Jungle Skirmisher −1,0 pt, Top Diver contre Jungle Vanguard −0,9 pt.
- **Poids par rôle du matchup** : **retirés**. Les données donnent déjà l'ordre (écart moyen d'un matchup d'au moins 500 parties : Top 2,4 pts, Mid 2,2, Support 1,9, Jungle 1,9, ADC 1,6).
- **Modes** : Mix = tout ; Synergie = sans les matchups ; Counter = sans les duos. La maîtrise compte dans les trois.
- **Champion du pool hors de ses rôles habituels** : classé avec des stats par défaut (0 partie, 50 %), signalé « Peu fiable ».
- **Options** (décidé le 27/10/2026) : chaque choix garde jusqu'à 2 autres options, les plus jouées, avec win rate et parties : sorts, départ, bottes, et pour chaque objet principal les autres options de son slot (1er, 2e ou 3e objet, à partir de 5 % de pick rate). Chaque objet situationnel garde jusqu'à 2 autres objets de la même règle, sans win rate.
- **Affichage** : le grand chiffre est le WR attendu ; dessous, une ligne par contribution (Base en %, puis Ennemis, Alliés, Maîtrise en points ; « Ennemis » et « Alliés » remplacent « Matchups » et « Duos » le 24/10/2026, car ils couvrent toute la compo), chacune avec une barre centrée sur zéro (vert à droite, orange à gauche, pleine à ±2 pts) et la valeur alignée à droite (décidé le 24/10/2026). La phrase « Les 3 meilleurs du pool de X, classés par score » n'est plus affichée ; seul « pool épuisé » reste signalé. Les fenêtres flottantes « vs … » et « avec … » détaillent chaque ennemi et chaque allié : mesure brute (win rate et parties), écart lissé, moyenne de classe utilisée, poids et effet.
- ~~La synergie par traits ne compte plus dans le score mesuré~~ : **remplacé** le 26/10/2026, elle compte dans la note sur 20 (voir ci-dessous).
- **Archétypes** (**Provisoire**, lecture seulement) : d'après la classe principale, Dive (Diver, Assassin), Engage (Vanguard), Poke (Artillery), Protect (Enchanter, Warden), Pick (Catcher, Burst), Teamfight (Battlemage), Split push (Juggernaut, Skirmisher, Specialist) ; Marksman sans archétype. Affichés dans « Ta compo » et « Compo ennemie » dès 2 champions du même archétype (« Dive : Camille, Lee Sin, Akali »). Ils n'entrent pas dans le score, faute de mesure.

### Note sur 20 et note d'équipe sur 100 (stats mesurées)

**Décidé** (26/10/2026) avec le porteur du projet : le % affiché comme score « ne voulait pas dire grand-chose ». Chaque pick a une **note sur 20**, la note d'une équipe est le **cumul des notes de ses picks connus, sur 100**. Les % restent pour les win rates (chips WR, « vs », fenêtres flottantes) ; le win rate attendu n'est plus affiché sous la note.

```
note = 10 + (WR lissé − 50)              base du champion
     + effet des ennemis                  (mode Synergie : 0)
     + effet des alliés                   (mode Counter : 0)
     + effet de la maîtrise
     + apport à la compo                  (mode Counter : 0)
1 point par point de win rate : 50 % vaut 10, 60 % vaut 20 ; bornée de 0 à 20, le classement suit la valeur avant bornage
```

- **Échelle** : 1 point par point de win rate (d'abord 2, ramené à 1 le même jour : à 2 points, deux picks à 56,6 % et 58,5 % attendus affichaient tous deux 20/20).
- **Apport à la compo**, en points : trait qui manque à la compo +0,5 (Frontline, Engage, Dégâts physiques), +0,25 (Peel) ; scaling dans la phase faible de ta compo (scaling − 3) × 0,2.
- **Redondance multifacteur** : deux porteurs d'un même trait (deux tanks, deux engages, deux peels) ou deux sources de dégâts magiques ne coûtent rien. Le 3e prend −0,5, le 4e −1, le 5e −1,5, par trait (raison « 3e Frontline (Malphite, Sejuani) »). Les **dégâts physiques n'ont pas de malus** : une compo à un seul AP (quatre AD) est courante. Remplace « déjà couvert par X » (−3 dès le 2e). Les données d'exemple appliquent la même règle (−3 de synergie par rang, −4 pour la 3e source AP) : le scénario de référence « Après verrouillage de Sejuani » est mis à jour en conséquence.
- **Dégâts soutenus face à la frontline** (**Décidé** le 26/10/2026, règle **Provisoire**) : un pick a des dégâts soutenus si sa classe principale Riot est Marksman, Juggernaut, Skirmisher ou Battlemage (assassins, mages burst, artilleurs, tanks, supports et spécialistes n'en apportent pas). Face à une frontline ennemie connue, tant que ta compo n'a aucun pick à dégâts soutenus : +0,5 par frontline ennemie (2 au plus) au pick qui en apporte (« Dégâts soutenus face à la frontline (Galio) »), le même malus aux picks qui n'en apportent pas dès 3 alliés déjà là (« Pas de dégâts soutenus… »), et la lecture de ta compo le signale dès 3 picks. Les dégâts par partie de Lolalytics ne servent pas ici : ils mesurent un volume (Malphite en fait plus que Camille), pas la capacité à tenir sur une frontline. Corrections champion par champion (décidé le 26/10/2026, **Provisoire**) : `sustained: true` dans `data/champions-overrides.json` pour Ambessa, Azir, Brand, Briar, Camille, Gangplank, Gnar, Graves, Heimerdinger, Irelia, Kayle, Kennen, Olaf, Quinn, Renekton, Shyvana, Teemo, Vi, Xin Zhao, Zyra (dégâts continus, en % de PV ou bruts hors des classes retenues) ; `sustained: false` possible pour retirer un champion d'une classe retenue. **Ouvert** : poids, et tenir compte de la pénétration si une source la donne.
- **Note d'équipe** : ta compo = cumul des notes des picks verrouillés ; compo ennemie = cumul des picks connus, chacun noté de son côté (matchups contre tes picks, duos, apport à sa compo, sans maîtrise). 0 sans pick. Le **verdict** juge la projection : les rôles sans pick y comptent à la note du win rate moyen du rôle (environ 11,5). Solide dès 65, Correcte dès 56, Fragile dès 50, À corriger en dessous (**Provisoire**) ; pas de verdict tant qu'un côté n'a aucun pick. Les 5 critères (frontline, engage, peel, mix de dégâts, scaling) restent affichés en barres.
- **Affichage** : grand chiffre « 14,2 /20 », vert à partir de 1,5 point au-dessus de la note moyenne du rôle, rouge en dessous ; l'infobulle donne la règle et la moyenne. Contributions en points sur 20 : Ennemis, Alliés, Maîtrise, Compo (barres pleines à ±2). « Compo +N » disparaît avec les stats mesurées.
- **Ouvert** : calibrage. Avec les matchups à somme nulle (26/10/2026), l'écart entre les deux compos se resserre (exemples : 68 contre 43 devenu 77 contre 56 ; 64 contre 41 devenu 72 contre 60). Les duos restent mesurés côté par côté : une compo aux duos faibles dans les données garde une note plus basse. Valeur d'un ban : la baisse de notre meilleure option peut maintenant être négative (un champion que notre option bat vaut moins la peine d'être banni).
- **Plan de jeu** : essayé le 26/10/2026 (lignes de conduite tirées des deux compos), **retiré** le même jour à la demande du porteur du projet. La règle « pas de phrases de conseil » reste sans exception.

### Scaling sur 10

**Décidé** (26/10/2026) : le scaling mesuré passe de 5 à **10 niveaux** : de 1 à 5 par demi-point, un niveau par demi-écart-type de l'écart de win rate de la phase (Lolalytics) par rapport aux autres champions. L'interface l'affiche sur 10 (×2). Les seuils du moteur (avantage à ±0,5 de moyenne, « Scaling en … » dès 4, « Faible en … » à 2 ou moins) gardent leur sens. Le graphe des deux compos (une courbe par équipe, valeur écrite à chaque point) resserre son axe autour des valeurs, avec au moins 3 points d'amplitude, pour que les écarts se lisent.

Les données d'exemple de la maquette gardent les formules ci-dessous (tests de référence).

### Formules de la maquette

Ces formules sont celles de la maquette, **Proposé** comme point de départ. Les poids sont à ajuster avec de vraies données. Avec les stats mesurées, elles sont **remplacées** par le win rate attendu (voir plus haut), sauf la note de compo.

**Synergie** (0 à 100) :
- On part d'une base par champion (`synergyBase`). Dans la maquette, c'est une valeur d'exemple. **Décidé** (23/10/2026) : avec les stats Lolalytics, base de 55 pour tous, plus la synergie de duo mesurée avec chaque allié verrouillé. On prend l'écart de win rate normalisé du duo (Lolalytics), lissé avec 200 parties fictives à 0, et on ajoute `arrondi(4 × moyenne des écarts)`. Raison « Duo avec X » affichée dès 1 point d'écart. Le coefficient 4 reste à ajuster.
- Pour chaque apport du champion (Frontline +12, Engage +10, Dégâts physiques +10, Peel +6) : on ajoute le bonus si l'équipe ne l'a pas encore ; avec un seul porteur déjà là, rien ; au-delà, −3 par rang (3e −3, 4e −6), sauf les dégâts physiques, jamais pénalisés (décidé le 26/10/2026, la maquette retirait 3 dès le 2e).
- Un champion AP quand l'équipe a déjà 2 sources AP ou plus : −4 par rang (3e −4, 4e −8).
- Besoin de scaling : on prend la phase où l'équipe alliée est le plus en retard sur l'ennemi. Si l'écart moyen est de -0,5 ou moins, on ajoute `(scaling du candidat sur cette phase - 3) × 4`.
- Le résultat est borné entre 0 et 100.
- Un champion AD apporte implicitement « Dégâts physiques ».

**Counter** (0 à 100) :
- `wrScore(wr) = borne(50 + (wr - 50) × 10)`
- `counter = 0,4 × wrScore(lane) + 0,6 × wrScore(partie)`
- **Décidé** (23/10/2026), avec les stats Lolalytics : pas de win rate de lane. Le counter vaut `wrScore(partie)`, où « partie » est le win rate du champion contre l'adversaire de sa lane quand celui-ci est connu (lissé vers le win rate du champion, voir plus bas), sinon son win rate sur la lane. L'interface affiche un chip « Win rate » (le chip « Lane — » est retiré le 24/10/2026) et un chip « vs Adversaire ».
- **Décidé** (23/10/2026) : le win rate de partie d'un candidat est lissé vers 50 % avec 3 000 parties fictives, `(win rate × parties + 50 × 3 000) / (parties + 3 000)`, avant le calcul du counter. Le matchup contre l'adversaire de lane est ensuite lissé vers cette valeur avec 1 000 parties fictives (décidé le 23/10/2026 : avec 200, Karthus ADC à 56,2 % sur 153 parties contre Miss Fortune montait à 92 de counter). **Décidé** (23/10/2026) : un matchup de moins de 500 parties est ignoré, le counter utilise alors le win rate lissé du champion et le chip « vs Adversaire » n'est pas affiché (Yasuo ADC à 63 % sur 219 parties contre Miss Fortune restait en tête). **Décidé** (24/10/2026) : les ennemis connus des autres lanes comptent aussi. Pour chacun, on calcule l'écart entre le win rate contre lui (lissé de la même façon, au moins 500 parties) et le win rate général lissé, et cet écart s'ajoute au win rate du counter avec un poids d'un quart du vis-à-vis. En botlane, le poids passe à trois quarts (décidé le 24/10/2026, après un essai à la moitié qui laissait Twitch premier malgré Leona) : support ennemi pour un ADC, ADC ennemi pour un support. Ces matchups viennent des mêmes pages Lolalytics (toutes régions), gardés à partir de 300 parties (30 depuis le 24/10/2026). Le chip « vs Adversaire » ouvre une fenêtre flottante (survol, focus ou clic), précédée d'un loader de 0,3 s affiché sous la souris (décidé le 24/10/2026), avec l'effet de chaque ennemi connu : le vis-à-vis en tête (×1), puis les autres lanes. Les ennemis connus sans assez de parties (moins de 500, ou paire absente des données) apparaissent aussi, avec « Pas assez de parties » et un effet nul (décidé le 24/10/2026). Sans matchup de lane retenu, le chip devient « vs compo ±N ». Sans ce lissage, des picks peu joués à fort win rate (Rek'Sai Top : 517 parties à 55,5 %) saturaient le counter. Le chip « Win rate » affiche toujours le win rate brut.
- **Décidé** (23/10/2026) : sans pool (ou sans joueur), seuls les champions qui jouent ce rôle dans au moins 20 % de leurs parties sont classés. Les autres apparaissent dans la vue liste, section « Rôle secondaire, non classés ». Avec un pool, ses champions restent classés quel que soit leur rôle principal.

**Type de suggestion** (**Décidé** le 24/10/2026) : chaque rôle a son propre sélecteur (Mix, Synergie, Counter) qui choisit ce qui classe ses suggestions (décidé le 24/10/2026). Le sélecteur global au-dessus des rôles règle les 5 d'un coup ; il n'est allumé que si tous les rôles sont sur le même mode. Les choix sont mémorisés sur l'appareil. Avec les stats mesurées, voir « Win rate attendu ». Avec les données d'exemple :
- **Meilleure synergie** : synergie seule (0,75 × synergie + 0,25 × maîtrise avec un pool).
- **Meilleur counter** : counter seul (0,75 × counter + 0,25 × maîtrise avec un pool).
- **Mix** (par défaut) : les poids ci-dessous. Les poids du counter par rôle en Mix (top 65 %, mid et support 55 %, ADC 45 %, jungle 35 %) sont **retirés** le 24/10/2026 avec le passage au win rate attendu.

Les boutons « Vue top 3 » et « Vue liste » sont réduits à 32 px de haut, à la demande du porteur du projet. C'est une exception à la règle des cibles tactiles de 44 px.

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

**Suggestions de bans** : la maquette utilise un score de menace fixe. **Proposé**, en place à titre provisoire : pour chaque rôle, les 3 meilleurs win rates parmi les champions dont c'est la lane principale (au moins 50 % de leurs parties) et d'au moins 1 000 parties, avec une menace égale à `wrScore(win rate)` et la raison « Win rate X % en Rôle ». **Ouvert** : la formule réelle (taux de ban, menace contre la compo alliée prévue). Rappel : on ne connaît pas les pools ennemis. **Décidé** (24/10/2026) : les rôles où l'ennemi a déjà pick sont exclus des suggestions, en plus des champions déjà bannis ou pris. **Décidé** (24/10/2026), bans ciblés (stats mesurées) : pour chaque rôle encore ouvert chez l'ennemi, on prend nos options (pick verrouillé, sinon pool, sinon les 3 suggestions) et les candidats ennemis du rôle (rôle principal, au moins 1 000 parties, hors nos options). Valeur d'un ban, en points de win rate attendu pour nous : `(WR lissé du champion − 50) + (meilleur attendu de nos options − meilleur attendu s'il est notre vis-à-vis)`. Les 3 plus fortes valeurs par rôle sont proposées, avec la raison (« +6,6 pts pour toi · WR 54,3 % · Jinx −3,5 »). Les données d'exemple gardent la liste fixe.

**Scaling mesuré** : **Décidé** (23/10/2026), tranches 0-15, 15-25 et 25 min et plus. Ce sont des tranches de durée de partie Lolalytics : début = 0-15 ; milieu = 15-20 et 20-25 ; fin = 25 et au-delà. Pour chaque phase, on calcule l'écart entre son win rate (lissé avec 200 parties fictives) et le win rate global du champion. On le centre et on le réduit sur tous les candidats, puis on le ramène de 1 à 5 : 3 correspond à la moyenne, ±1 par écart-type. La tranche 0-15 min est peu fournie (environ 1 % des parties, surtout des redditions), donc le scaling « début » reste fragile.

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

**Décidé** (23/10/2026) : **Lolalytics** pour les stats, avec notre propre lecteur en TypeScript et une collecte légère par patch. Le **wiki LoL** (`Module:ChampionData`) sert à amorcer les attributs des champions. L'API Riot est écartée : trop d'appels pour le porteur du projet. Il n'y a donc pas de win rate de lane. **Décidé** (23/10/2026) : région **EUW**, rang Emerald+ (`npm run ingest -- lolalytics [région]` permet d'en changer). EUW représente environ 30 % des parties toutes régions : le lissage et le seuil de 300 parties prennent plus d'importance. **Décidé** (24/10/2026) : les matchups et les duos sont collectés sur **toutes les régions** (environ 4 fois plus de parties), les stats générales restent en EUW. **Décidé** (24/10/2026, plus tard) : les stats générales passent aussi sur **toutes les régions** ; plus aucune donnée n'est limitée à EUW. En EUW seul, un seul matchup Mid sur 44 contre Akali atteignait 500 parties. Réduire les seuils en proportion a été essayé puis écarté : les matchups rares (Yasuo ADC à 63 % sur 219 parties) redevenaient décisifs.

Ce que lit `npm run ingest -- lolalytics` (environ 500 requêtes, une toutes les 1,5 s, User-Agent identifiable, cache du jour pour reprendre après une interruption) :
- la page publique `lolalytics.com/lol/<champion>/build/` de chaque lane jouée à au moins 5 %. Son état embarqué (Qwik) donne le win rate, le nombre de parties, la répartition des dégâts, les victoires par durée de partie et le win rate contre chaque adversaire de la même lane ;
- l'API interne `a1.lolalytics.com/mega/?ep=build-team`, un appel par champion et par lane, pour les win rates de duo avec chaque allié. Ce n'est pas une API publique : elle peut changer sans prévenir.

Fichiers : `data/champions.json` (attributs générés depuis le wiki), `data/champions-overrides.json` (corrections à la main), `data/stats/lolalytics-<patch>.json` (stats collectées). Tous sont versionnés. Le cache `data/stats/.cache/` ne l'est pas. Le type de dégâts AP ou AD vient de la répartition mesurée, sauf pour les tanks et les corrections manuelles.

*Analyse initiale, gardée pour mémoire :*

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
- Win rate de lane : abandonné avec l'API Riot (voir plus haut).
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
5. Plus tard : import automatique des pools depuis le mastery et l'historique Riot. La lecture automatique du client est en place (section 10).

## 9. Questions ouvertes

- Formule réelle des suggestions de bans (une formule provisoire est en place, section 5).
- Coefficients à ajuster sur de vraies drafts : poids des duos dans la synergie, seuils de candidat (5 % de la lane, 300 parties), lissage du win rate (3 000 parties), seuil de rôle principal (20 %).

### Ajustements d'interface (24/10/2026)

- **Décidé** (26/10/2026) : plus aucune infobulle native du navigateur. Une seule couche (`TooltipLayer`) reprend tous les `title` au survol (et au clavier) et les affiche dans une infobulle maison : verre sombre, flèche vers l'élément, au-dessus (en dessous s'il manque la place), 250 ms de délai, fondu coupé si le système demande moins de mouvement.
- **Décidé** : malus en orange (`--neg`, depuis le 26/10/2026 ; rouge doux avant), pour ne pas les confondre avec les couleurs des équipes (bleu et rouge selon le side). « Compo +N » est affiché en gris, plus discret.
- **Décidé** : sans ennemi ou sans allié connu, la ligne Ennemis ou Alliés affiche « — » (rien à mesurer), à distinguer d'un effet nul « 0,0 ».
- **Décidé** : le win rate attendu est coloré par rapport à la moyenne du rôle (moyenne des win rates lissés, pondérée par les parties, champions dont c'est un rôle principal ; environ 51,5 % sur le patch 16.21, pas 50 %) : vert à partir de 1,5 point au-dessus, neutre autour, rouge en dessous. L'infobulle donne la moyenne et l'écart.
- **Décidé** : saisie rapide des picks, sous la barre des bans. Camp Ennemi ou Allié (gardé d'une saisie à l'autre), raccourci « / », recherche ; Entrée place le champion sur son rôle le plus joué encore libre (part des parties Lolalytics), flèches gauche et droite pour un autre rôle, ou clic sur un rôle. Un champion banni ou déjà pris est grisé avec la raison. Allié : le pick est verrouillé.
- **Décidé** : les 3 bans les plus utiles, tous rôles confondus, en petits portraits dans l'en-tête de la barre des bans (« Suggérés ») : un clic bannit. Le panneau « Suggestions de bans » garde le détail par rôle.
- **Écarté** : alléger les cards en retirant les chips WR, « vs … » et « avec … ». Le porteur du projet préfère voir les infos sans interagir.
- **Décidé** : vue liste en grille : nom et portrait (calés en haut) | contributions | « Verrouiller » en haut à droite, score dessous, avec le même écart entre les trois blocs ; scaling et WR sous le nom ; chips du pied en retour à la ligne inversé (la ligne du bas est la plus remplie) ; pied de ligne avec les raisons (vertes et rouges) et les chips « vs » et « avec » sur une même ligne, et le nombre de parties en bas à droite. Le tag « Tous les champions » n'est plus affiché (seuls « Pool », « Hors pool » et « Rôle secondaire » le sont). Empilée sur téléphone (requête de conteneur).
- ~~**Décidé** (mobile)~~ **remplacé** le 26/10/2026 par la vue client empilée (voir « Écran Draft : vue client ») : en-tête sur deux lignes sans le chip du patch, cases de ban plus petites, colonne des picks en grille (visages à gauche, joueur à droite), les 3 cards défilent de côté, et une barre fixée en bas donne les deux notes de compo (un clic mène à l'analyse). La page passe d'environ 7 450 à 4 600 px de haut à 375 px de large.
- **Décidé** : bouton d'échange (icône ⇄) à la place de « VS » dès qu'un des deux picks d'un rôle est saisi : le pick allié et le pick ennemi de ce rôle s'échangent (annulable).
- **Décidé** : petites animations (0,4 s au plus), toutes coupées si le système demande moins de mouvement. Au verrouillage ou à la saisie d'un pick (card, ligne de liste, sélecteur, saisie rapide), le portrait cliqué vole jusqu'au face-à-face, puis rebondit. Les suggestions entrent en cascade au changement de vue ou de mode ; le résumé du pick verrouillé apparaît en fondu. Aussi : card qui se soulève au survol, boutons et segments en transition, barres qui se remplissent, ban qui apparaît et se raye, sélecteur et fenêtres flottantes en fondu, icône ⇄ qui pivote au survol.
- **Décidé** : la ligne « Base » est retirée des contributions (elle répétait le chip WR) ; la base lissée du win rate attendu est donnée dans l'infobulle du chip WR. Le rôle verrouillé reprend la ligne de la vue liste (identité, contributions, score, pied de chips), sans bouton, avec les notes de matchup en pied.
- **Décidé** : plus d'avertissement « Sans joueur : tous les champions » sous un rôle sans joueur (seul « Sans pool » reste, quand un joueur placé n'a pas de pool sur le rôle). La ligne du rôle verrouillé occupe toute la hauteur de la colonne.
- **Décidé** : chip WR dans le pied de ligne de la vue liste, avec les autres chips. Choix du joueur d'un rôle : bouton avec avatar (initiale, couleur stable par nom), nom et 3 meilleurs champions du pool sur le rôle ; le menu montre pour chaque joueur ses 3 meilleurs champions sur le rôle (ou « Sans pool ») et le rôle où il est déjà placé, puis « Aucun joueur ». Clavier : flèches, Entrée, Échap.

## 10. Draft en direct : lecture du client

**Décidé** (25/10/2026) avec le porteur du projet :

- **Pont local en CLI Node** (`apps/bridge`, `npm run bridge`). Le site ne peut pas joindre l'API locale du client (port et mot de passe changent à chaque lancement, certificat auto-signé, pas de CORS). Le pont trouve le client (ligne de commande de `LeagueClientUx`, sinon `lockfile`, ou `LOL_LOCKFILE`), suit `/lol-champ-select/v1/session` par WebSocket et transmet une draft simplifiée sur `ws://127.0.0.1:52147`. Le mot de passe du client ne quitte pas le pont. Seules l'appli en local et `draft-assistant.<sous-domaine>.workers.dev` sont acceptées (`DRAFT_BRIDGE_ORIGINS` pour en ajouter). Chrome demande une fois l'accès au réseau local depuis le site Cloudflare.
- **Lecture seule** : le pont ne survole, ne verrouille et ne bannit rien dans le client.
- **Le client prime** : bans, picks verrouillés et rôles attribués. Un rôle sans pick dans le client garde la saisie à la main, sauf si ce champion est banni ou pris ailleurs. Une nouvelle sélection (autre partie, ou retour après une sortie) repart d'une draft vide ; à la fin de la sélection, la draft reste affichée.
- **Ennemis** : le client ne donne pas leur rôle. Un nouveau pick ennemi va sur son rôle le plus joué encore libre (comme la saisie rapide) ; un champion déjà placé garde son rôle, donc une correction à la main reste.
- **Survols alliés** : affichés (« Survolé », portrait estompé), hors calcul. Les survols ennemis ne sont pas visibles dans le client.
- **Joueurs** : un champ Riot ID par joueur (écran Joueurs, gardé dans IndexedDB). Un allié reconnu est placé sur le rôle de sa case et retiré des autres. En classé, le client masque souvent le Riot ID des alliés : seul le joueur local est alors reconnu.
- **Reconnaissance par pseudo** (décidé le 25/10/2026) : un Riot ID identique prime ; sinon le pseudo lu dans le client est comparé au nom du joueur dans l'appli et au nom de son Riot ID. Casse, accents, espaces, symboles et lettres grecques ou cyrilliques décoratives (« KWΛNGYA ») sont ignorés. Ressemblance : pseudo identique 0,98, nom d'au moins 4 caractères contenu dans le pseudo 0,9, sinon 1 − fautes ÷ longueur (lettre en trop, en moins, remplacée, ou deux lettres voisines inversées). Seuil 0,75, environ une faute pour 4 caractères ; moins de 3 caractères : identique seulement. Chaque joueur va sur une seule case, les meilleures ressemblances d'abord. Si le deuxième joueur le plus proche est à moins de 0,05, la case reste sans joueur.
- En-tête : chip « Draft en direct », « Client LoL connecté » ou « Client LoL fermé », absent quand le pont ne tourne pas.

## 11. Écran Draft : vue client

**Décidé** (25/10/2026) : sur grand écran (1200 px de large et plus), l'écran Draft est la « vue client », retenue parmi quatre mises en page essayées sur une page de test (lignes compactes, vue client, matrice, cartes), supprimée depuis. En dessous de 1200 px (décidé le 26/10/2026, la mise en page en lignes est retirée) : la même vue client, empilée et qui défile. Bandeau sur deux lignes (bans, puis saisie rapide), les deux colonnes d'équipe côte à côte (cartes splash plus basses), puis le centre (rôle choisi, bans ou fin de draft, une colonne) et l'analyse de la compo. Choisir un rôle fait défiler jusqu'au centre. La fin de draft garde ses cartes (pas de bascule par lane), sur plusieurs lignes ; les suggestions de bans défilent de côté.

- **Une seule fenêtre** : en-tête et draft occupent exactement la hauteur de la fenêtre, sans défilement ; les mentions légales (exigées par Riot) restent juste en dessous.
- **Bandeau** : bans alliés, saisie rapide, bans ennemis. Le type de suggestion (Mix, Synergie, Counter) se règle par rôle dans l'en-tête du centre (sélecteur global du bandeau retiré le 25/10/2026).
- **Colonnes des équipes** comme dans le client : alliés à gauche, ennemis à droite, dans l'ordre des cases du client (ordre de pick) pendant une draft en direct, sinon Top, Jungle, Mid, ADC, Support. Allié : rôle, meilleur champion ou pick verrouillé, choix du joueur.
- **Cartes joueurs** (décidé le 25/10/2026, « Splash centré », retenu parmi cinq affichages essayés sur une page de test supprimée depuis) : l'illustration centrée du champion verrouillé occupe la carte (survolé : estompée), le texte se range en bas (rôle, champion en grand, joueur), à gauche pour ton équipe et à droite pour l'ennemi, sur un voile teinté de l'équipe qui ne fonce que vers le bas. Choix du joueur réduit (30 px) et translucide. Illustrations Data Dragon téléchargées une fois (`npm run ingest -- illustrations`, `apps/web/public/champions/centered/`, environ 19 Mo) : aucun appel réseau pendant une draft.
- **Clics** : toute la carte d'un allié montre ses suggestions au centre ; le bouton « Choix manuel » de l'en-tête du centre ouvre la fenêtre de choix (tous les champions, recherche). Toute la carte d'un ennemi ouvre la fenêtre de choix. La croix de retrait et le choix du joueur restent cliquables par-dessus.
- **Centre** : le rôle choisi (clic sur un allié ; par défaut le premier rôle ouvert, et le suivant après un verrouillage), avec son type de suggestion. Les champions du pool en cartes détaillées, élargies pour occuper toute la largeur (note sur 20, contributions, chips WR, vs et avec, raisons, scaling, parties, « Verrouiller ») ; à droite, la liste hors pool avec recherche, seule partie qui défile. Sans pool : les 6 premiers du rôle en cartes, le reste et les rôles secondaires en liste. Rôle verrouillé choisi : les picks verrouillés de l'équipe en cartes.
- **Sous le centre** : notes des deux compos sur 100, 5 critères, graphe de scaling sur 10 (une courbe par équipe sur les trois phases, décidé le 26/10/2026) et faits marquants de ta compo (décidé le 27/10/2026, à la place de la lecture, qui répétait les critères : meilleur et pire matchup, meilleur et pire duo, en effet pondéré en points, pick le plus fort et le plus faible ; plus la ligne « Pas de dégâts soutenus » si elle s'applique).
- **Phase de bans** (décidé le 25/10/2026) : le centre montre les suggestions de bans, une colonne par rôle ennemi encore ouvert, avec autant de bans que la hauteur le permet (3 à 8, mesuré en direct ; les autres écrans en gardent 3). Chaque carte : rang, portrait, nom et valeur du ban en points ; win rate et parties (la force, win rate lissé − 50, en infobulle) ; effet sur ta meilleure option du rôle (« Pour Malphite −2,4 ») et « Bannir ». Le bandeau de compo du bas est masqué pendant les bans (aucun pick à noter). Draft en direct : tant que le client attend des bans (actions de ban non terminées, champ `bansPending` du pont). Saisie à la main : tant qu'aucun pick n'est saisi et que tes 5 bans ne sont pas posés. Un clic sur un allié montre ses suggestions à la place.
- **Draft complète** (10 picks connus, décidé le 25/10/2026) : le centre montre les deux équipes lane par lane, Top au-dessus de Top. Bandeau de chaque équipe (note sur 100, verdict, dégâts, critères), tes picks et les picks ennemis dans les mêmes cartes compactes, en miroir (décidé le 26/10/2026 : note sur 20, contributions, chips WR, vs et avec avec leurs fenêtres flottantes, scaling, parties ; sous le nom, dégâts et archétype, précédés du joueur pour toi (27/10/2026) ; chaque pick ennemi est évalué de son côté comme un pick allié, sans maîtrise), puis les faits marquants des deux compos (mêmes lignes que sous le centre) avec leurs archétypes en chips, et le graphe de scaling. Les lanes ne sont plus rappelées (décidé le 26/10/2026) : picks et lignes dans l'ordre Top, Jungle, Mid, ADC, Support. Le bandeau de compo du bas est retiré, ce panneau le reprend. Sur un écran moins haut (panneau de moins de 980 px depuis le 26/10/2026, 760 avant), une ligne par lane remplace les deux rangées de cartes : ton pick face au pick ennemi, même contenu des deux côtés en miroir (identité, contributions, note sur 20, chips WR, vs et avec avec fenêtres flottantes ; scaling par pick masqué si la ligne est étroite) ; si la place manque encore, les critères des bandeaux s'écrivent avec leur valeur, et le scaling par phase, les dégâts et l'archétype de chaque pick ennemi ne sont plus répétés (ils restent dans la lecture des compos et la répartition des dégâts). Tient sans défiler en 1904 × 931, 1366 × 768 et 1280 × 720 (vérifié sur une draft type ; une lecture de compo plus longue fait défiler le panneau).
- **Exception** : le choix du joueur fait 36 px de haut (44 ailleurs), comme les boutons de vue.
- **Glisser-déposer** (décidé le 27/10/2026) : un pick se glisse d'une case de joueur vers une autre, même équipe ou équipe adverse, pour corriger un champion placé sur le mauvais rôle. Le pick de la case visée prend sa place. Seuls les champions changent de case : les joueurs restent sur leur rôle. Annulable. Pendant une draft en direct, le rôle donné par le client reste prioritaire ; pour un pick sans rôle donné (en pratique l'ennemi), la correction est gardée.
- **En-tête** (décidé le 27/10/2026) : l'icône seule, sans le nom de l'appli (gardé pour les lecteurs d'écran).
- **Ordre de pick** (décidé le 26/10/2026) : sur chaque rôle allié ouvert dont le vis-à-vis n'est pas connu, chip « Contre-pick +x,x » à côté du rôle : gain moyen, en points sur 20, à choisir après avoir vu le vis-à-vis plutôt qu'à l'aveugle. Options comparées : le pool du joueur (sinon les 5 premières suggestions) ; adversaires probables : les 15 champions les plus joués du rôle (rôle principal, au moins 1 000 parties), pondérés par leurs parties, hors bannis et pris. Gain = moyenne du meilleur choix contre chaque adversaire − meilleur choix à l'aveugle. Affiché dès 0,3 ; le plus grand des rôles ouverts mis en avant. **Provisoire**.
- **Joueur qui pick** (draft en direct) : sa carte avance vers le centre, bordée d'une barre épaisse de la couleur de son équipe et balayée d'un reflet ; les autres joueurs de son équipe s'estompent ; badge « En train de choisir ». Sans rôle choisi d'un clic, le centre montre ses suggestions.
- **Boutons** : « Verrouiller » détouré dans la couleur de ton équipe (cadenas), « Bannir » neutre (cercle barré, rouge au survol, icône seule sur carte étroite), croix de retrait en pastille sombre dans le coin haut de la carte, côté extérieur.

## 12. Thème

**Décidé** (25/10/2026) : thème unique « Épuré équipes », retenu parmi une douzaine d'essais (page de test supprimée), dans `apps/web/src/theme.css` sur `<body data-theme="teams">`, pour toute l'appli.

- Aplats sombres sans bordures, police Inter partout (titres et scores compris).
- **Couleurs des camps selon le side** : ton équipe en bleu côté bleu, en rouge côté rouge, l'adversaire dans l'autre couleur (side lu dans le client ; bleu à la saisie à la main). La couleur d'équipe identifie les camps sans juger : un bon score reste vert, les verdicts « info » neutres, le rouge reste le malus.
- **Fond** : dégradé de la couleur de ton équipe (gauche) vers celle de l'adversaire (droite) sur tout l'écran, en-tête translucide.
- **Colonnes des joueurs** en verre teinté de la couleur de l'équipe ; **centre** translucide, bandeau du haut quasi noir avec un filet clair. Cartes champion du centre : portrait très flou en fond, fond teinté et barre extérieure de 3 px de l'équipe concernée (tes options et tes picks : ton équipe, à gauche ; bans et champions adverses : l'adversaire, à droite).
- **Sélection** (meilleure suggestion, rôle choisi) : seule la bordure change, prise dans la couleur de ton équipe ; le fond reste.
- **Arrondis** de la vue client : 12 px les grands blocs, 8 px les contrôles et portraits, 6 px les petits éléments, pastilles rondes.
- **Écarts avec les règles 9 et 11** : les suggestions détaillées ne portent que sur le rôle choisi (les autres rôles montrent leur meilleur champion), et le face-à-face par lane n'est plus côte à côte. Pas encore repris : le panneau de suggestions de bans par rôle, la lecture de la compo ennemie, les archétypes, le bloc « Équipe » et « Lire les scores ».

## 13. Appli desktop Windows

**Décidé** (26/10/2026) : l'appli existe aussi en appli Windows, avec **Electron** (retenu face à Tauri : le pont est en Node et s'intègre tel quel, tout reste en TypeScript ; installeur d'environ 100 Mo).

- `apps/desktop` : processus principal en un seul fichier (esbuild), qui démarre le pont (`startBridge` de `apps/bridge/src/server.ts`, la CLI `npm run bridge` utilise le même) et ouvre une fenêtre sur l'appli web construite.
- L'appli web est servie par un schéma maison `app://draft-assistant` (stockage local et fetch comme sur un site https), sans serveur ni appel réseau ; le pont accepte cette origine en plus des siennes. Le mot de passe du client LoL reste dans le processus principal ; la page lit la draft par le WebSocket local, comme l'appli web.
- Une seule instance (un second lancement ramène la fenêtre) ; si un pont tourne déjà sur le port, l'appli s'y connecte.
- Fenêtre : taille, position et « Toujours au premier plan » (menu Affichage, Ctrl+T) gardés entre deux lancements ; liens externes ouverts dans le navigateur.
- Installeur NSIS (`npm run desktop:dist`), non signé : avertissement SmartScreen au premier lancement. Icône : le logo de l'en-tête (Λ dans un carré arrondi), dégradé bleu-rouge des équipes (`apps/desktop/build/icon.svg`, rendu en PNG ; aussi favicon du site).
- **Mise à jour automatique** (décidé le 26/10/2026) : electron-updater sur les releases GitHub du dépôt. Vérification dès le lancement et téléchargement en arrière-plan, même pendant une draft (décidé le 27/10/2026, seule exception à « aucun appel réseau pendant une draft » ; avant : 15 s après le lancement et hors draft) ; puis fenêtre « Redémarrer maintenant / Au prochain lancement » ; « Redémarrer maintenant » installe en silence et relance l'appli (corrigé le 26/10/2026 : l'installeur s'ouvrait en mode assistant, sans relance). Journal dans `%APPDATA%\Draft Assistant\logs\updater.log`. Joueurs, pools et stats restent dans `%APPDATA%\Draft Assistant`.
- **Releases automatiques** : workflow « Release desktop » (`.github/workflows/desktop-release.yml`) sur chaque tag `v*` égal à la version de `apps/desktop/package.json` : tests, build, installeur ; installation silencieuse et test de démarrage de l'appli installée (`--smoke`, décidé le 26/10/2026) ; publication de la release (avec `latest.yml`) seulement si l'appli démarre. La 0.1.0 n'a pas la mise à jour automatique : l'installer une fois en 0.2.0 à la main.
- **Mise à jour des stats dans l'appli** (décidé le 26/10/2026) : bouton dans l'en-tête (appli desktop seulement). Le processus principal lance la collecte Lolalytics (même code que la CLI, `@draft/ingest`), puis l'assemblage du snapshot avec les attributs embarqués (`data/champions.json`, `champions-overrides.json`, `ddragon-version.txt`) ; snapshot, collecte brute et cache du jour dans le dossier de l'utilisateur. Le snapshot local est servi à la place de celui de l'installeur. **Une fois par semaine** au plus (rythme des patchs), comptée depuis la dernière collecte réussie. Refusée pendant une sélection des champions, et en pause tant qu'une draft est en cours (règle « aucun appel réseau pendant une draft »). Annulable. Avancement dans l'en-tête (« Stats 42/173 »), rechargement de la page à la fin. Avant la collecte, les champions du wiki absents de l'installeur sont ajoutés, et leurs portrait et illustration téléchargés (Data Dragon) dans le dossier de l'utilisateur, servis en priorité.
- Polices embarquées (décidé le 26/10/2026, site et appli) : Inter et Barlow Condensed en caractères latins, dans les graisses utilisées (@fontsource) ; plus d'appel à Google Fonts. Cinzel, inutilisée, est retirée.

## 14. Partage de la liste des joueurs

**Décidé** (26/10/2026) : export et import de la liste des joueurs en JSON, depuis l'écran Joueurs (bloc « Partager la liste »). Boutons doubles (décidé le 26/10/2026) : « Copier » et « Coller », chacun avec une flèche qui propose la même chose en fichier (« Télécharger un fichier », « Ouvrir un fichier »). Un seul joueur : « Copier le joueur » (flèche : fichier) dans l'en-tête de ses pools, même format (liste d'un joueur), importé par « Coller » ou « Importer ». En premier, sans fichier : « Copier » (JSON dans le presse-papiers) et « Coller » (lit directement le presse-papiers ; zone de texte de secours s'il est inaccessible) ; en dessous, sur une ligne et plus discrets, « Exporter » et « Importer » (fichier).

- Format (`PlayersFileSchema`) : `{ kind: "draft-assistant/joueurs", version: 1, exportedAt, players: [{ name, riotId?, pools }] }`, joueurs dans l'ordre d'affichage.
- Import : récapitulatif avant confirmation (chaque joueur marqué « remplacé » ou « nouveau »). Un joueur du même nom est remplacé en entier (pools et Riot ID) ; les nouveaux sont ajoutés à la fin ; les autres ne changent pas. Champions inconnus du catalogue ignorés (listés), doublons d'un rôle retirés. Fichier illisible, d'un autre format ou vide : message, rien n'est changé.
- Sert aussi à passer ses joueurs du site à l'appli desktop, qui ont chacun leur stockage.

## 15. Écran Joueurs

**Décidé** (27/10/2026) : même design que l'écran Draft. Pas de grand titre ; panneaux en verre teinté de ton équipe ; joueurs en cartes illustrées (illustration du champion le mieux maîtrisé, voile de l'équipe) ; lignes du pool comme les cartes champion (portrait très flou, barre de l'équipe) ; rôles en boutons segmentés.

## 16. Build proposé

**Décidé** (27/10/2026) : un build est proposé pour ton pick.

- **Joueur** : en draft en direct, le joueur connecté au client (sa case) ; sinon le joueur marqué « Moi » dans l'écran Joueurs (bouton à côté du Riot ID, mémorisé sur l'appareil). Pick : verrouillé, sinon survolé dans le client.
- **Contenu** : runes (page la plus jouée et page au meilleur win rate si elle diffère, à partir de 500 parties), sorts d'invocateur, départ, bottes, trois objets principaux, jusqu'à trois objets situationnels. Pas d'ordre des compétences.
- **Source** : build général du champion sur son rôle (page build Lolalytics déjà collectée, aucune requête de plus), options gardées à partir d'un pick rate de 5 % (sorts), 3 % (départs), 2 % (bottes) et 1 % (objets). Objets, runes et sorts en français avec leurs icônes : Data Dragon (`npm run ingest -- build`), fournis avec l'appli.
- **Règles** (`packages/engine/src/build.ts`), chaque choix parmi les options jouées sur ce champion, avec sa raison affichée :
  - départ : le plus joué ; Bouclier de Doran pour un champion de mêlée contre un vis-à-vis à distance (Top, Mid) ;
  - bottes : résistance magique ou armure contre une équipe ennemie majoritairement magique ou physique (au moins 2 champions, plus que l'autre type), sinon selon les dégâts du vis-à-vis (Top, Mid), sinon les plus jouées ;
  - objets principaux : les trois premiers objets les plus joués ensemble, sans les bottes, complétés par les objets les plus construits ;
  - situationnels : anti-soins contre au moins un soigneur (liste `HEALERS`), résistance contre des dégâts ennemis majoritaires, pénétration contre au moins 2 tanks ou frontline ennemis, ou quand ton équipe compte au moins 3 picks de ton type de dégâts ; pas d'anti-soins ni de pénétration en double avec les objets principaux.
- **Affichage** : bascule « Draft | Build · Champion » en haut du centre de l'écran Draft, dès qu'il y a un build ; choisir un rôle revient à la draft. Win rate et parties de l'option pour les runes, les sorts, le départ et les bottes ; pas de win rate par objet (biaisé par la durée des parties).
- **Ouvert** : builds par matchup (pages « vs » de Lolalytics) pour les champions des pools, environ 1 min 40 par champion et par rôle (49 adversaires de lane en moyenne à au moins 30 parties) ; mise à jour du catalogue des objets par l'appli desktop après un patch qui ajoute des objets (aujourd'hui fourni avec l'appli).
