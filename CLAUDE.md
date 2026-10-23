# Draft Assistant LoL

Application web personnelle d'aide à la draft sur League of Legends. Elle recommande, pour chaque rôle, les champions à jouer selon les synergies, les counters, la maîtrise du joueur et le scaling, et elle note la composition globale.

## À lire avant de coder

- `docs/recap.md` : toutes les décisions de conception, les règles d'interface, les formules du moteur, l'analyse des sources de données, l'architecture proposée et les questions ouvertes.
- `maquettes/4-draft-v2.dc.html` : la maquette de référence de l'écran de draft. Voir `maquettes/README.md` pour lire ce format.
- `data/sample/` : les données d'exemple de la maquette, et `golden-scenarios.json` qui sert de tests de référence pour le moteur.

## Contraintes non négociables

- **Performance** : le moteur répond en moins d'une seconde. Le budget visé est de 50 ms pour le moteur et de 100 ms entre un clic et l'écran à jour. Aucun appel réseau pendant une draft.
- **Ton de l'interface** : informations factuelles uniquement. Pas de phrases de conseil, pas d'instructions d'usage, pas de compteurs inutiles. Interface en français.
- **Règle de pool** : les recommandations par défaut viennent du pool du joueur placé sur le rôle. Les champions hors pool n'apparaissent que dans le détail d'une ligne.
- **Counter** : deux win rates, de lane et de partie, plus le scaling début, milieu et fin.
- **Usage solo** : pas de comptes ni de serveur au départ.
- **Sécurité** : la clé API Riot ne doit jamais apparaître dans le code web ni dans le dépôt. Elle passe par une variable d'environnement de l'outil d'ingestion.

## Stack

TypeScript partout, validé avec le porteur du projet :
- monorepo en workspaces npm : `packages/schemas`, `packages/engine` (logique pure), `packages/i18n-fr` (tous les textes d'interface), `apps/web` (React + Vite) et `apps/ingest` (CLI Node) ;
- Vitest pour les tests.

Commandes : `npm run dev`, `npm test`, `npm run typecheck`, `npm run ingest -- sample|portraits`.

## Première étape suggérée

Porter la logique de calcul de `maquettes/4-draft-v2.dc.html` (méthode `renderVals` et méthodes d'action de la classe `Component`) dans un module moteur pur, sans interface. Écrire des tests qui reproduisent exactement `data/sample/golden-scenarios.json`, puis un test de performance sur le pire cas. Ne pas modifier les formules avant que ces tests passent.

## Conventions

- Code et identifiants en anglais, textes d'interface en français.
- Le moteur renvoie des raisons sous forme de codes avec paramètres. L'interface les traduit en texte.
- Toute question listée comme « Ouvert » dans `docs/recap.md` se tranche avec le porteur du projet, pas par défaut.
