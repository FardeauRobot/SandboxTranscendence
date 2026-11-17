# Test d'animation : Chicken Dance en mocap vs en keyframes

- `chicken_compare.glb` : le Y Bot de Mixamo avec deux clips, `mocap` (le fichier d'origine) et `keyframes` (réécrit en code). Même squelette `mixamorig`, 144 images à 30 i/s (4,8 s).
- `ybot_dances.glb` : le même Y Bot avec trois clips, `idle`, `mocap` et `keyframes`. C'est celui de l'arène (copié dans `sandbox/public/models/`).
- `planche-comparaison.png` : 6 images clés, mocap en haut, keyframes en bas.

## Les scripts

| Fichier | Rôle |
|---|---|
| `rig.py` | Le rig, commun à toutes les chorégraphies : chargement du FBX (sa danse devient l'action `mocap`), cibles IK des mains, coudes, pieds et genoux, pré-pliage de 15°, pieds verrouillés à plat, orientation des mains ; outils de clés (`key_hands`, `key_fingers`, `key_hips`, `key_bend`…) ; cuisson en FK (`bake`) ; export GLB. |
| `keyframe_dance.py` | La Chicken Dance (16 temps : bec, ailes, queue, claps). Écrit `both.blend` (actions `mocap` et `keyframes`). |
| `idle.py` | Le repos (bras le long du corps, respiration, balancement ; boucle de 2 s). Reprend `keyframes` dans `both.blend` et écrit `ybot_dances.glb` (+ `idle.blend`). |
| `common.py` | `load()` (import du FBX) et `dump()` (positions monde des articulations, pour comparer deux danses). |

Une chorégraphie ne fait que poser des clés sur le rig, puis le cuire :

```python
from rig import build_rig, export_glb
rig = build_rig()                       # charge chicken.fbx et monte le rig
rig.key_hands(1, pos_g, pos_d, coude_g, coude_d)
rig.key_hips(1, drop=0.05)
rig.bake(60, 'ma_danse')                # images 1 à 60 → action « ma_danse » en FK pure
export_glb('sortie.glb')                # toutes les actions → clips glTF
```

## Regénérer

```sh
pip install bpy==5.3.0      # Blender en module Python (Python 3.13)
# dans un dossier de travail contenant le FBX Mixamo sous le nom chicken.fbx :
python3 /chemin/vers/animation-test/keyframe_dance.py   # écrit both.blend
python3 /chemin/vers/animation-test/idle.py             # écrit ybot_dances.glb et idle.blend
```

Les fichiers sont lus et écrits dans le dossier courant. Le FBX n'est pas versionné.

## Pièges rencontrés

- **Ne pas appeler un script `inspect.py`** : il masque le module standard du même nom et bpy se charge deux fois (crash « InitGoogleLogging twice »).
- **En T-pose, bras et jambes sont parfaitement tendus** : l'IK avec cible de pôle ne sait pas de quel côté plier. On pré-plie l'avant-bras et le genou de 15° pour lui donner le plan de flexion.
- **Des cibles fixes dans le monde ne suivent pas le corps.** Pendant « la queue », le buste descend et les mains restaient en l'air : on passe les bras en FK sur cette phase.
- Avec bpy 5.x, les actions n'ont plus d'attribut `fcurves` : `set_linear()` ne fait rien. Sans conséquence, l'export GLB échantillonne chaque image.
- Les GLB ne peuvent pas être servis tels quels par les artifacts claude.ai : le modèle y est encodé en base64 dans un fichier `.js`.

## Intégration dans le bac à sable (17 nov.)

- `ybot_dances.glb` est copié dans `sandbox/public/models/`. `src/ui/arena/dancer.ts` le charge, remplace les silhouettes par le Y Bot (teinté bleu/rouge) et, à chaque main posée (`burst`), joue la danse 2 fois avant de revenir au repos.
- Réglages dans `src/ui/arena/config.ts` : `DANCE_CLIP` (`'mocap'` ou `'keyframes'`), `DANCE_REPEAT`, `MODEL_SCALE`, `FADE`.
