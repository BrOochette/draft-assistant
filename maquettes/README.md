# Maquettes

Ces fichiers viennent d'un canvas de maquettage. Ce ne sont pas des pages autonomes : ils ont besoin d'un runtime (`support.js`) qui n'est pas fourni, donc ils ne s'ouvrent pas tels quels dans un navigateur. Ils servent de **référence de conception** : structure de l'écran, styles et logique de calcul.

| Fichier | Statut |
|---|---|
| `4-draft-v2.dc.html` | Référence principale de l'écran de draft |
| `1-joueurs.dc.html` | Référence de l'écran Joueurs et pools |
| `3-draft-v1.dc.html` | Historique, gardé pour comparaison |
| `2-composition-obsolete.dc.html` | Obsolète, fusionné dans la Draft v2 |

## Lire le format

Chaque fichier a deux parties.

**Le gabarit**, entre `<x-dc>` et `</x-dc>` : du HTML avec des styles en ligne, plus :
- `{{chemin.vers.valeur}}` : une valeur calculée, insérée dans le texte ou un attribut ;
- `<sc-for list="{{rows}}" as="r">…</sc-for>` : une boucle ;
- `<sc-if value="{{cond}}">…</sc-if>` : un affichage conditionnel ;
- `onClick="{{fonction}}"`, `onChange="{{fonction}}"` : des gestionnaires d'événements.

**La logique**, dans `<script type="text/x-dc">` : une classe `Component` avec :
- `this.state` : l'état de l'écran (picks, bans, joueur placé par rôle, sélections, etc.) ;
- `renderVals()` : calcule tout ce que le gabarit affiche. C'est là que se trouvent les données d'exemple, le catalogue, les formules de score et de note de compo ;
- des méthodes d'action : `lockPick`, `unlockPick`, `chooseManual`, `addBan`, `removeBan`, `assignPlayer`, `commit` et `undo` pour l'annulation.

Dans l'application, `renderVals()` se découpe en deux. Le calcul pur va dans le moteur (`packages/engine`), la mise en forme pour l'affichage va dans les composants React.

## Images

Les portraits pointent vers des URL `/_blob/…` propres au canvas, qui ne fonctionnent pas ailleurs. Dans l'application, utiliser Data Dragon :

```
https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/{ddragonId}.png
```

La correspondance entre nom affiché et `ddragonId` est dans `data/ddragon-ids.json` (par exemple « Kai'Sa » donne `Kaisa`, « Lee Sin » donne `LeeSin`). La liste des versions est sur `https://ddragon.leagueoflegends.com/api/versions.json`. Les portraits de la maquette viennent de la version 16.21.1.

## Palette et typographie de la maquette

- Fonds : `#0F1218` (page), `#12161E`, `#171B24` (cartes), `#1E2430`, `#252B3A`
- Bordure : `#2B3242`
- Texte : `#E9ECF3`, secondaire `#C9D0DF`, atténué `#A3ABBD`
- Accent : `#3DD6C3` (sélection, verrouillé, meilleur score)
- Allié : `#6AA8FF` ; ennemi : `#FF9F5A`
- Positif : `#8FE8D3` sur `#12332E` ; négatif : `#FFB98A` sur `#3A2618` ; avertissement : `#FFD27A` sur `#3A3016`
- Polices : Barlow Condensed (titres, scores) et Inter (texte)
