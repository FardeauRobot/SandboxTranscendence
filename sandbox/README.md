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

1. **Main reconnue** (meilleure main *activée*) → `points = base`, `mult = base`
2. **Chaque carte qui compte** → `+ points du rang`, puis famille : `+ points`, `+ mult`, `× mult`
3. **Score** = `floor(points × mult)`

Les cartes qui ne comptent pas (kickers) sont grisées et ne rapportent rien.

## Du menu à la partie

Le menu (`/`) et la partie (`/partie/:id`) ne partagent rien d'autre que l'URL. Le parcours reprend celui
de Transcendence, avec un faux serveur en mémoire à la place d'Adonis :

| Étape | Fichier | Ici | Dans Transcendence |
|---|---|---|---|
| ① créer | `pages/Menu.tsx` → `net/api.ts` | `createGame()` | `POST /api/v1/games` |
| ② naviguer | `pages/Menu.tsx` | `navigate('/partie/3')` | `useNavigate()` |
| ③ lire l'id | `App.tsx` | `matchGame(path)` | `useParams()` sur `/game/:id` |
| ④ charger | `pages/GamePage.tsx` | `getGame(3)` | `GET /api/v1/games/3`, puis `game:join` en WebSocket |
| ⑤ jouer | `pages/GamePage.tsx` | `<Game game={…} />` | la page `/game/:id` |

`net/fakeServer.ts` joue le backend : il choisit le seed et garde les parties dans `localStorage`, si
bien qu'un F5 sur `/partie/3` retrouve la même donne (à la manche 1 : l'avancement n'est pas stocké).
Console ouverte, chaque requête et chaque réponse y sont tracées. Le jeu lui-même reste local, sans
WebSocket.

## Où modifier quoi

| Je veux… | Où |
|---|---|
| changer des valeurs | le panneau **Le labo** (sauvegardé dans le navigateur, export/import JSON) |
| placer combattants, lumières, caméra | l'**éditeur de scène** : bouton « Scène » ou `?scene` (voir plus bas) |
| changer les valeurs par défaut | `src/engine/defaultRules.ts` |
| ajouter un modificateur | `src/engine/score.ts` : une étape de plus dans `scoreHand()` |
| ajouter une combinaison | `HAND_IDS` dans `types.ts` + un détecteur dans `hands.ts` + une entrée dans `defaultRules.ts` |

## L'arène 3D

`src/ui/arena/` (three.js, sans React sauf `Arena3D.tsx` et `useArena.ts`) : ring coupé bleu/rouge, deux
combattants, gradins avec ~500 spectateurs instanciés. La scène est pilotée par `setLevel` (foule, lumières,
tremblement), `setAura(joueur, v)` et `burst(joueur)` (à chaque main posée, le joueur danse et la caméra plonge
vers lui). Sans WebGL, on retombe sur la foule 2D (`Crowd.tsx`).

| Fichier | Contenu |
|---|---|
| `scene.ts` | `createArena()` : assemble les morceaux et tient la boucle de rendu |
| `config.ts` | tous les réglages : couleurs, danse (`DANCE_REPEAT`, `MODEL_SCALE`, `FADE`), combattants, foule, tribunes |
| `layout.ts` | la disposition : position des combattants, des lumières et de leurs cibles, de la caméra et de sa visée |
| `state.ts` | l'état partagé (niveau, auras, dernière main posée), lissé à chaque frame |
| `ring.ts` | sol et ring |
| `stands.ts`, `crowd.ts` | gradins et placement des spectateurs ; foule instanciée et son animation |
| `fighter.ts` | combattants : silhouette (capsules + sphère), aura, saut et bras |
| `dancer.ts` | le Y Bot (`public/models/all_dances.glb`) : chargement, repos ↔ danse de la main ×N, fondus |
| `dances.ts` | main posée → danse (clip de `all_dances.glb`), quinte flush royale comprise |
| `lights.ts`, `camera.ts` | lumières ; caméra (orbite, plongée, tremblement, cadrage) |
| `materials.ts` | matériau `std()`, dégradé de l'aura, libération des ressources |
| `Arena3D.tsx`, `useArena.ts`, `webgl.ts` | le composant React, son hook de cycle de vie, le test WebGL |
| `editor/` | l'éditeur de scène : `editor.ts` (three.js : caméra libre, gizmo, sélection), `SceneEditor.tsx` (la page) |

Combattants : le Y Bot de Mixamo remplace les silhouettes dès qu'il est chargé (elles restent si le chargement
échoue). Pour d'autres modèles de foule, remplacer les géométries des `InstancedMesh` dans `crowd.ts`.
Le GLB se regénère avec les scripts de `animation-test/`.

La scène occupe tout l'écran ; HUD, calcul et main flottent par-dessus (`.overlay` dans `app.css`). Le labo est un
tiroir à droite (bouton en haut). `setFrame` décale le cadrage pour garder les combattants au centre de
l'espace libre entre le panneau de score et le labo (`frameX` dans `App.tsx`).

### L'éditeur de scène

`?scene` (ou le bouton « Scène ») ouvre l'arène en vue libre. On clique un combattant, une lumière (sphère), la
cible d'un projecteur (losange) ou la caméra de jeu (boîte jaune, sa visée en losange jaune), puis on le
déplace au gizmo (W) ; les combattants se tournent aussi (E). Le panneau donne les coordonnées exactes, la
« vue joueur » (V) montre le cadrage du jeu, et « Tester » déclenche poses, niveau de foule et auras.

Chaque changement est enregistré dans le navigateur ; le jeu le relit au chargement (`loadLayout()`). Pour en
faire la valeur livrée, « Copier le JSON » et le coller dans `DEFAULT_LAYOUT` (`layout.ts`). Le ring, les
tribunes et la foule restent centrés : ils ne sont pas dans la disposition.

L'éditeur se greffe sur l'arène via `arena.rig` (caméra de rendu `view`, rappel `beforeRender`) sans toucher
à la boucle de rendu. La caméra de jeu orbite autour de sa visée, quelle que soit sa position.

`src/engine/` n'importe rien de React : il pourra être repris tel quel côté serveur.

**Comparer deux réglages** : coche « Rejouer toujours les mêmes donnes », pose une main, puis modifie les règles.
Le panneau affiche le score avec les règles du moment de la pose et l'écart.
