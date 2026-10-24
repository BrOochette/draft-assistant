# Draft Assistant LoL

Aide à la draft sur League of Legends, pour un usage personnel. L'application tourne entièrement dans le navigateur, sans serveur. Voir `CLAUDE.md` et `docs/recap.md`.

## Démarrer

```bash
npm install
npm run ingest -- portraits   # une fois : portraits Data Dragon en local
npm run dev                   # assemble le snapshot de stats puis lance Vite sur http://localhost:5173
```

## Mettre à jour les stats (à chaque patch)

```bash
npm run ingest -- lolalytics  # environ 18 min (EUW, matchups toutes régions) : écrit data/stats/lolalytics-<patch>.json
npm run dev                   # le snapshot est réassemblé avec les stats les plus récentes
```

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
| `npm run ingest -- lolalytics [région] [région des matchups]` | Stats du patch courant, Emerald+ : stats générales en EUW et matchups et duos sur toutes les régions par défaut (`all`, `euw`, `kr`, `na`…). Écrit `data/stats/lolalytics-<patch>.json` |
| `npm run ingest -- snapshot` | Assemble `apps/web/public/data/snapshot.json` : stats Lolalytics si présentes, sinon données d'exemple |
| `npm run ingest -- sample` | Force le snapshot sur les données d'exemple de la maquette |
| `npm run ingest -- portraits` | Télécharge les portraits manquants dans `apps/web/public/champions/` |

## Organisation

- `packages/schemas` : types et validation zod.
- `packages/engine` : moteur pur (scores, note de compo, recommandations, bans, réducteur de la draft).
- `packages/i18n-fr` : tous les textes d'interface. Le moteur ne renvoie que des codes.
- `apps/ingest` : CLI de collecte (wiki, Lolalytics) et d'assemblage du snapshot.
- `apps/web` : écrans Draft et Joueurs. Les pools sont gardés dans IndexedDB.

## Sources

- Stats : [Lolalytics](https://lolalytics.com). Pages publiques des champions, plus l'API interne du site pour les duos (non publique, elle peut changer). Collecte légère et identifiée, une fois par patch, pour un usage personnel non commercial.
- Attributs : [wiki League of Legends](https://wiki.leagueoflegends.com/en-us/Module:ChampionData/data), contenu sous licence CC BY-SA.
- Portraits : Data Dragon de Riot Games.
