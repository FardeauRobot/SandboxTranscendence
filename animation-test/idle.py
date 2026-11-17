"""Animation de repos : bras le long du corps, respiration, léger balancement. Boucle de 2 s (60 images).

Construite avec le même rig que la danse (rig.py), puis exporte un GLB avec trois clips :
idle, mocap (Mixamo) et keyframes (Chicken Dance réécrite en code, reprise de both.blend).

Lancer depuis un dossier qui contient chicken.fbx et both.blend (keyframe_dance.py d'abord) :
écrit ybot_dances.glb et idle.blend.
"""
import math

import bpy

from rig import DANCE_BLEND, GLB, append_action, build_rig, export_glb, mirror, save_blend

N = 61  # image 61 = image 1
STEP = 5  # une clé toutes les 5 images
BASE_DROP = 0.05  # même flexion de base que la danse ; ici 60 % seulement
hand = (0.24, 0.0, 0.93); elbow = (0.35, 0.45, 1.15)  # mains pendantes, coudes vers l'arrière


def key_idle(rig, f):
    """Une clé de repos à l'image f : la respiration et le balancement font chacun un tour par boucle."""
    ph = (f - 1) / (N - 1) * 2 * math.pi
    breath = math.sin(ph)
    sway = math.sin(ph)  # un balancement par boucle
    rig.key_hips(f, BASE_DROP * 0.6 + 0.008 * (1 - breath), yaw=1.5 * sway, shift=0.015 * sway)
    lift = 0.012 * breath
    rig.key_hands(f, (hand[0], hand[1], hand[2] + lift), (-hand[0], hand[1], hand[2] + lift),
                  elbow, mirror(elbow), None, 0.0)
    rig.key_fingers(f, 18, 10)
    rig.key_bend(f, 'Spine', -1.2 * breath)
    rig.key_bend(f, 'Spine2', -1.0 * breath)
    rig.key_bend(f, 'Neck', 2 + 1.0 * breath, side_deg=1.5 * sway)


def main():
    rig = build_rig()
    for f in range(1, N + 1, STEP):
        key_idle(rig, f)
    rig.bake(N, 'idle')
    append_action(DANCE_BLEND, 'keyframes')  # la Chicken Dance en keyframes, déjà cuite
    print('actions', [a.name for a in bpy.data.actions])
    export_glb(GLB)
    save_blend('idle.blend')


if __name__ == '__main__':
    main()
