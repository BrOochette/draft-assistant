# Données

## Données réelles

| Fichier | Contenu |
|---|---|
| `champions.json` | Attributs des champions générés depuis le wiki LoL (`npm run ingest -- wiki`) : clé Riot, identifiant Data Dragon, type de dégâts, apports, rôles, classes. Ne pas modifier à la main : il est réécrit à chaque import. |
| `champions-overrides.json` | Corrections manuelles par champion (`damage`, `provides`, `roles`). Elles priment sur le wiki et sur la mesure. |
| `stats/lolalytics-<patch>.json` | Stats collectées sur Lolalytics (`npm run ingest -- lolalytics`) : par champion et par lane, parties, win rate, dégâts, victoires par durée, matchups de lane et duos. |
| `ddragon-version.txt` | Version Data Dragon des portraits téléchargés. |

## Données d'exemple

Toutes les valeurs de `sample/` sont **des données d'exemple** extraites de la maquette. Les win rates, les échantillons, les bases de synergie et les scores de menace sont inventés. Ils servent à porter et tester le moteur, pas à prendre de vraies décisions.

| Fichier | Contenu |
|---|---|
| `ddragon-ids.json` | Nom affiché du champion vers son identifiant Data Dragon, pour les 80 champions de la maquette. |
| `sample/champions.json` | Catalogue d'exemple : rôles, type de dégâts (AP, AD, TANK), apports (Frontline, Engage, Peel), scaling début, milieu et fin de 1 à 5. Un champion AD apporte aussi implicitement « Dégâts physiques ». |
| `sample/candidates.json` | Candidats détaillés par rôle : nombre de parties, base de synergie, win rate de lane et de partie, notes de contexte. |
| `sample/pools.json` | Pools des 5 joueurs d'exemple (Alex, Sam, Noa, Lou, Max) par rôle, avec la maîtrise sur 10. |
| `sample/initial-draft-state.json` | État de départ de la maquette : joueur placé par rôle, picks fixes (Top Aurora, Support Brand), picks ennemis connus, bans. |
| `sample/matchup-notes.json` | Notes de matchup et de compo affichées pour Top et Support. |
| `sample/ban-suggestions.json` | Suggestions de bans avec score de menace fixe. |
| `sample/golden-scenarios.json` | Sorties exactes de la maquette pour 4 scénarios : recommandations classées avec scores, détail synergie, counter et maîtrise, « Compo +N », raisons, note de compo et scaling. |

## Utiliser les scénarios de référence

Un premier portage du moteur doit reproduire `golden-scenarios.json` à l'identique. Les 4 scénarios sont :
1. l'état initial ;
2. après le verrouillage de Sejuani en Jungle ;
3. avec Sejuani, Orianna et Ashe verrouillés ;
4. Max placé en Mid, sans pool Mid.

Les raisons y sont sous forme de phrases, comme dans la maquette. Si le moteur passe aux codes de raison, comparer après traduction, ou adapter le test.
