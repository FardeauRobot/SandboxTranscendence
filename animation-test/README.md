# Test d'animation : Chicken Dance en mocap vs en keyframes

- `chicken_compare.glb` : le Y Bot de Mixamo avec deux clips, `mocap` (le fichier d'origine) et `keyframes` (réécrit en code). Même squelette `mixamorig`, 144 images à 30 i/s (4,8 s).
- `keyframe_dance.py` : le script Blender qui écrit la danse. Cibles IK pour les mains, les coudes et les pieds, rotations FK pour le tronc, la tête et les doigts, puis « cuisson » en rotations simples, image par image.
- `common.py` : chargement du FBX.
- `planche-comparaison.png` : 6 images clés, mocap en haut, keyframes en bas.

## Regénérer

```sh
pip install bpy==5.3.0      # Blender en module Python (Python 3.13)
# placer le FBX Mixamo sous le nom chicken.fbx à côté des scripts
python3 keyframe_dance.py   # écrit both.blend (les deux actions)
```
Puis l'export GLB : `bpy.ops.export_scene.gltf(..., export_animation_mode='ACTIONS')`.

## Pièges rencontrés

- **Ne pas appeler un script `inspect.py`** : il masque le module standard du même nom et bpy se charge deux fois (crash « InitGoogleLogging twice »).
- **En T-pose, bras et jambes sont parfaitement tendus** : l'IK avec cible de pôle ne sait pas de quel côté plier. On pré-plie l'avant-bras et le genou de 15° pour lui donner le plan de flexion.
- **Des cibles fixes dans le monde ne suivent pas le corps.** Pendant « la queue », le buste descend et les mains restaient en l'air : on passe les bras en FK sur cette phase.
- Les GLB ne peuvent pas être servis tels quels par les artifacts claude.ai : le modèle y est encodé en base64 dans un fichier `.js`.

## Intégration dans le bac à sable (17 nov.)

- `idle.py` : animation de repos (bras le long du corps, respiration, balancement ; boucle de 2 s), construite avec le même rig. Il exporte `ybot_dances.glb` avec trois clips : `idle`, `mocap` et `keyframes`.
- Ce GLB est copié dans `sandbox/public/models/`. `src/ui/arena/scene.ts` le charge, remplace les silhouettes par le Y Bot (teinté bleu/rouge) et, à chaque main posée (`burst`), joue la danse 2 fois avant de revenir au repos.
- Réglages en haut de `scene.ts` : `DANCE_CLIP` (`'mocap'` ou `'keyframes'`), `DANCE_REPEAT`, `MODEL_SCALE`, `FADE`.
