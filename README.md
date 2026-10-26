# Draft Assistant LoL

Aide à la draft sur League of Legends, pour un usage personnel. L'application tourne entièrement dans le navigateur, sans serveur. Voir `CLAUDE.md` et `docs/recap.md`.

## Démarrer

```bash
npm install
npm run dev                   # assemble le snapshot de stats puis lance Vite sur http://localhost:5173
```

## Draft en direct

```bash
npm run bridge                # pont local en lecture seule vers le client LoL, à laisser ouvert pendant les drafts
```

L'appli (en local ou sur Cloudflare) se connecte au pont toute seule : picks, bans, rôles et survols alliés arrivent pendant la sélection des champions. Le chip « Draft en direct » s'affiche dans l'en-tête. Renseigner le Riot ID des joueurs (écran Joueurs) pour qu'ils soient placés sur leur rôle. Chrome demande une fois l'accès au réseau local depuis le site Cloudflare. Variables utiles : `LOL_LOCKFILE` (chemin du `lockfile` si le client n'est pas trouvé), `DRAFT_BRIDGE_ORIGINS` (autre adresse du site, séparées par des virgules), `DRAFT_BRIDGE_PORT` (port local, 52147 par défaut, à changer aussi côté appli).

## Partager la liste des joueurs

Écran Joueurs, bloc « Partager la liste » : « Exporter » télécharge un fichier JSON (`draft-assistant-joueurs-AAAA-MM-JJ.json`) avec tous les joueurs, leurs Riot ID et leurs pools. « Importer » lit un tel fichier et montre les joueurs concernés avant de les ajouter : un joueur du même nom est remplacé (pools et Riot ID), les nouveaux sont ajoutés, les autres restent tels quels. Les champions inconnus sont ignorés. Le fichier passe d'une version à l'autre (site et appli desktop).

## Appli desktop (Windows)

```bash
npm run desktop               # construit l'appli web et l'ouvre dans une fenêtre Electron
npm run desktop:dist          # produit l'installeur apps/desktop/release/Draft Assistant Setup x.y.z.exe
```

L'appli desktop démarre elle-même le pont vers le client LoL : pas de `npm run bridge` à lancer à part. Elle sert l'appli web construite en local (`app://draft-assistant`), sans serveur ni appel réseau pendant une draft, et garde pools et Riot ID dans son propre stockage (séparé de celui du navigateur). Menu Affichage (Alt) : « Toujours au premier plan » (Ctrl+T), zoom. En développement : `npm run dev` dans un terminal, puis `npm run desktop:dev` (la fenêtre charge le serveur Vite). Installeur non signé : Windows affiche un avertissement SmartScreen au premier lancement (« Informations complémentaires », puis « Exécuter quand même »).

**Mettre à jour les stats dans l'appli** : bouton « Mettre à jour les stats » dans l'en-tête (appli desktop seulement). Il lance la même collecte Lolalytics que `npm run ingest -- lolalytics` (environ 12 à 15 minutes, une requête toutes les 1,5 s), puis réassemble le snapshot dans le dossier de l'utilisateur (`%APPDATA%Draft Assistantstats`) ; l'appli le charge ensuite à la place de celui de l'installeur. Une fois par semaine au plus. Refusée pendant une sélection des champions, et mise en pause si une draft commence en cours de collecte. Annulable ; une collecte interrompue reprend où elle s'était arrêtée le même jour (cache). Un nouveau champion demande toujours `npm run ingest -- wiki` puis un nouvel installeur (attributs, portrait, illustration).

Sous Windows sans le mode développeur, electron-builder échoue à décompresser ses outils de signature (liens symboliques macOS). Une fois suffit : décompresser l'archive `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\*.7z` dans un dossier `winCodeSign-2.6.0` au même endroit, en ignorant les deux erreurs de liens.

## Mettre à jour les stats (à chaque patch)

```bash
npm run ingest -- lolalytics  # environ 15 min (toutes régions) : écrit data/stats/lolalytics-<patch>.json
npm run dev                   # le snapshot est réassemblé avec les stats les plus récentes
```

Puis commiter `data/stats/` et `apps/web/public/data/snapshot.json`, et pousser : Cloudflare redéploie le site. Après la sortie d'un champion, `npm run ingest -- portraits` ajoute son portrait dans `apps/web/public/champions/` et `npm run ingest -- illustrations` son illustration dans `apps/web/public/champions/centered/` (à commiter aussi).

Les attributs des champions (Frontline, Engage, Peel, type de dégâts, rôles) viennent du wiki LoL. Pour les régénérer, par exemple après la sortie d'un champion :

```bash
npm run ingest -- wiki        # écrit data/champions.json
```

Pour corriger un attribut à la main, modifier `data/champions-overrides.json` : ces corrections priment sur le wiki et sur la mesure.

## Commandes

| Commande | Rôle |
|---|---|
| `npm test` | Tests du moteur (scénarios golden, performance, stats réelles), de l'ingestion et de l'interface |
| `npm run typecheck` | TypeScript strict sur tout le dépôt |
| `npm run build` | Build de production dans `apps/web/dist` |
| `npm run ingest -- wiki` | Attributs des champions depuis le wiki LoL : `data/champions.json` |
| `npm run ingest -- lolalytics [région] [région des matchups]` | Stats du patch courant, Emerald+ : stats générales, matchups et duos sur toutes les régions par défaut (`all`, `euw`, `kr`, `na`…). Écrit `data/stats/lolalytics-<patch>.json` |
| `npm run ingest -- snapshot` | Assemble `apps/web/public/data/snapshot.json` : stats Lolalytics si présentes, sinon données d'exemple |
| `npm run ingest -- sample` | Force le snapshot sur les données d'exemple de la maquette |
| `npm run ingest -- portraits` | Télécharge les portraits manquants dans `apps/web/public/champions/` |
| `npm run ingest -- illustrations` | Télécharge les illustrations centrées manquantes (fond des cartes joueurs) dans `apps/web/public/champions/centered/` |
| `npm run bridge` | Pont local vers le client LoL pour la draft en direct (lecture seule) |
| `npm run desktop` | Appli desktop Electron, pont compris |
| `npm run desktop:dev` | Appli desktop sur le serveur Vite (`npm run dev` lancé à côté) |
| `npm run desktop:dist` | Installeur Windows dans `apps/desktop/release/` |

## Organisation

- `packages/schemas` : types et validation zod.
- `packages/engine` : moteur pur (scores, note de compo, recommandations, bans, réducteur de la draft).
- `packages/i18n-fr` : tous les textes d'interface. Le moteur ne renvoie que des codes.
- `apps/ingest` : CLI de collecte (wiki, Lolalytics) et d'assemblage du snapshot.
- `apps/web` : écrans Draft et Joueurs. Les pools et les Riot ID sont gardés dans IndexedDB.
- `apps/bridge` : pont local vers le client LoL (sélection des champions), en lecture seule. `src/server.ts` le démarre, pour la CLI comme pour l'appli desktop.
- `apps/desktop` : appli Windows (Electron). Processus principal en un seul fichier (esbuild), pont compris ; l'appli web construite est copiée à côté par l'installeur.

## Sources

- Stats : [Lolalytics](https://lolalytics.com). Pages publiques des champions, plus l'API interne du site pour les duos (non publique, elle peut changer). Collecte légère et identifiée, une fois par patch, pour un usage personnel non commercial.
- Attributs : [wiki League of Legends](https://wiki.leagueoflegends.com/en-us/Module:ChampionData/data), contenu sous licence CC BY-SA.
- Portraits : Data Dragon de Riot Games.

## Déploiement (Cloudflare)

Cloudflare construit le site depuis GitHub à chaque push sur `master` (Workers Builds, assets statiques). Le snapshot de stats, les portraits et les illustrations sont commités : le build n'a pas besoin du réseau. `wrangler.jsonc` indique à `wrangler deploy` d'envoyer `apps/web/dist` tel quel, sans code serveur ; sans ce fichier, Wrangler refuse de deviner quelle appli du monorepo déployer.

Réglages du projet (Workers & Pages, Create, Import a repository, dépôt `draft-assistant`) :

| Réglage | Valeur |
|---|---|
| Project name | `draft-assistant` (le même que `name` dans `wrangler.jsonc`) |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` (valeur par défaut) |
| Root directory | (vide : racine du dépôt) |
| Variable de build | `NODE_VERSION` = `22` (aussi fixé par `.node-version`) |

Le site est servi sur `draft-assistant.<sous-domaine>.workers.dev`. `apps/web/public/_headers` règle le cache : fichiers du build un an, portraits et illustrations une semaine, stats revalidées à chaque chargement.

Les stats viennent de Lolalytics : pour ne pas les republier en accès libre, protéger le site avec Cloudflare Access (Zero Trust, Access, Applications, Self-hosted : domaine `draft-assistant.<sous-domaine>.workers.dev`, règle « Emails » avec les adresses autorisées).

## Mention légale

Draft Assistant isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.

Projet de fan non commercial. Pas de publicité, pas de monétisation.
