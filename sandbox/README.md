# Aura · bac à sable des règles

Prototype pour régler le scoring du jeu : un match à 2 joueurs en 5 manches, 45 s par joueur et par manche,
10 défausses pour tout le match. On pose une main, la foule réagit ; le score cumulé désigne le vainqueur.

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # tests du moteur (Vitest)
npm run build
```

## Le match

- Chaque manche, chaque joueur reçoit une donne neuve (8 cartes), choisit, défausse, puis pose jusqu'à 5 cartes.
- Le chrono démarre au clic sur « C'est parti ». À zéro, la sélection en cours est posée (rien de sélectionné : 0).
- Les défausses sont un budget pour tout le match, pas par manche.
- Qui commence alterne à chaque manche. Victoire au score cumulé après la dernière manche.

Pour l'instant les deux joueurs partagent l'écran (écran « Prêt ? » entre les tours pour cacher la main de
l'autre). Le moteur (`src/engine/match.ts`) traite déjà chaque joueur indépendamment : en réseau, les deux
joueront en même temps et le serveur enverra `timeout` à l'expiration du chrono. Manches, chrono et défausses
se règlent dans le labo.

## Le calcul

Pour la main posée, dans l'ordre où les cartes ont été sélectionnées :

1. **Main reconnue** (meilleure main *activée*) → `chips = base`, `mult = base`
2. **Chaque carte qui compte** → `+ chips du rang`, puis famille : `+ chips`, `+ mult`, `× mult`
3. **Score** = `floor(chips × mult)`

Les cartes qui ne comptent pas (kickers) sont grisées et ne rapportent rien.

## Où modifier quoi

| Je veux… | Où |
|---|---|
| changer des valeurs | le panneau **Le labo** (sauvegardé dans le navigateur, export/import JSON) |
| changer les valeurs par défaut | `src/engine/defaultRules.ts` |
| ajouter un modificateur | `src/engine/score.ts` : une étape de plus dans `scoreHand()` |
| ajouter une combinaison | `HAND_IDS` dans `types.ts` + un détecteur dans `hands.ts` + une entrée dans `defaultRules.ts` |

## L'arène 3D

`src/ui/arena/scene.ts` (three.js, sans React) : ring coupé bleu/rouge, deux combattants, gradins avec ~500
spectateurs instanciés. Apparences par défaut : capsules + sphères. Pour mettre de vrais modèles, remplacer
`makeFighter()` et les géométries des `InstancedMesh` de la foule. La scène est pilotée par `setLevel` (foule,
lumières, tremblement), `setAura(joueur, v)` et `burst(joueur)` (à chaque main posée, la caméra plonge vers ce joueur). Sans WebGL, on retombe
sur la foule 2D (`Crowd.tsx`).

La scène occupe tout l'écran ; HUD, calcul et main flottent par-dessus (`.overlay` dans `app.css`). Le labo est un
tiroir à droite (bouton en haut). `setFrame` décale le cadrage pour garder les combattants au centre de
l'espace libre entre le panneau de score et le labo (`frameX` dans `App.tsx`).

`src/engine/` n'importe rien de React : il pourra être repris tel quel côté serveur.

**Comparer deux réglages** : coche « Rejouer toujours les mêmes donnes », pose une main, puis modifie les règles.
Le panneau affiche le score avec les règles du moment de la pose et l'écart.
