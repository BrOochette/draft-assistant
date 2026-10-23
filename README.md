# Draft Assistant LoL

Aide à la draft sur League of Legends, pour un usage personnel. L'application tourne entièrement dans le navigateur, sans serveur. Voir `CLAUDE.md` et `docs/recap.md`.

## Démarrer

```bash
npm install
npm run ingest -- portraits   # une fois : portraits Data Dragon en local
npm run dev                   # régénère le snapshot d'exemple puis lance Vite sur http://localhost:5173
```

## Commandes

| Commande | Rôle |
|---|---|
| `npm test` | Tests du moteur (scénarios golden, performance, réducteur), de l'ingestion et de l'interface |
| `npm run typecheck` | TypeScript strict sur tout le dépôt |
| `npm run build` | Build de production dans `apps/web/dist` |
| `npm run ingest -- sample` | Valide `data/sample` et écrit `apps/web/public/data/snapshot.json` |
| `npm run ingest -- portraits` | Télécharge les portraits manquants dans `apps/web/public/champions/` |

## Organisation

- `packages/schemas` : types et validation zod.
- `packages/engine` : moteur pur (scores, note de compo, recommandations, bans, réducteur de la draft).
- `packages/i18n-fr` : tous les textes d'interface. Le moteur ne renvoie que des codes.
- `apps/ingest` : CLI qui produit le snapshot de stats. C'est là que se branchera une vraie source.
- `apps/web` : écrans Draft et Joueurs. Les pools sont gardés dans IndexedDB.

Les stats actuelles sont des **données d'exemple**, sans valeur réelle.
