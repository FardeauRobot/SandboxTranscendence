"""Chicken Dance écrite à la main en keyframes sur le squelette Mixamo (rig : voir rig.py).

Tempo : 1 temps = 9 images à 30 i/s. 16 temps = 144 images = 4,8 s (même durée que la mocap).
  temps 0-3   : le bec   (mains devant, 4 « clac »)
  temps 4-7   : les ailes (poings sous les bras, 4 battements de coudes)
  temps 8-11  : la queue  (on descend en se tortillant)
  temps 12-15 : 4 claps, puis retour au bec pour boucler

Lancer depuis un dossier qui contient chicken.fbx : écrit both.blend (actions 'mocap' et 'keyframes').
"""
from rig import DANCE_BLEND, MOCAP_FRAMES, build_rig, hand_quat, mirror, save_blend, set_linear

BEAT = 9


def F(beat):
    """Image d'un temps (le temps 0 tombe sur l'image 1)."""
    return 1 + round(beat * BEAT)


BASE_DROP = 0.05  # genoux légèrement fléchis en permanence (sinon l'IK verrouille la jambe tendue)
BOUNCE = 0.03     # petit rebond sur chaque temps

# Orientations de main (gauche, droite)
BEAK = (hand_quat((0, -1, 0.15), (0, 0, -1)),) * 2                           # doigts devant, paume vers le bas
CLAP = (hand_quat((0, -0.6, 0.8), (-1, 0, 0)), hand_quat((0, -0.6, 0.8), (1, 0, 0)))  # doigts en haut, paumes face à face

# Poses de référence (côté gauche, le droit est en miroir)
beak_hand = (0.17, -0.30, 1.50); beak_elbow = (0.55, 0.15, 0.95)
wing_hand = (0.13, -0.10, 1.37)
wing_up = (0.60, 0.20, 1.50); wing_down = (0.40, 0.10, 1.00)
clap_in = (0.035, -0.32, 1.27); clap_out = (0.24, -0.28, 1.30); clap_elbow = (0.55, 0.05, 0.85)


def sym_hands(rig, f, hand, elbow, ori=None, w=1.0):
    """Clé des deux mains en miroir à partir de la pose du côté gauche."""
    rig.key_hands(f, hand, mirror(hand), elbow, mirror(elbow), ori, w)


def beak_pose(rig, f, closed):
    sym_hands(rig, f, beak_hand, beak_elbow, BEAK, 1.0)
    rig.key_fingers(f, 25 if closed else 0, 55 if closed else -10)


def beak(rig):
    """Temps 0-3 : le bec. Clac sur le temps, ouvert à la croche ; la tête picore."""
    for b in range(4):
        beak_pose(rig, F(b), True)
        beak_pose(rig, F(b + 0.5), False)
        rig.key_hips(F(b), BASE_DROP + BOUNCE); rig.key_hips(F(b + 0.5), BASE_DROP)
        rig.key_bend(F(b), 'Neck', 12); rig.key_bend(F(b + 0.5), 'Neck', -4)
        rig.key_bend(F(b), 'Spine', 3); rig.key_bend(F(b + 0.5), 'Spine', 0)


def wings(rig):
    """Temps 4-7 : les ailes. Poings sous les aisselles, coudes en haut sur le temps."""
    for b in range(4, 8):
        sym_hands(rig, F(b), wing_hand, wing_up, None, 0.0)
        sym_hands(rig, F(b + 0.5), wing_hand, wing_down, None, 0.0)
        rig.key_fingers(F(b), 85, 40); rig.key_fingers(F(b + 0.5), 85, 40)
        rig.key_hips(F(b), BASE_DROP + BOUNCE); rig.key_hips(F(b + 0.5), BASE_DROP)
        rig.key_bend(F(b), 'Neck', 4); rig.key_bend(F(b + 0.5), 'Neck', 0)
        rig.key_bend(F(b), 'Spine', 0); rig.key_bend(F(b + 0.5), 'Spine', 0)


def tail(rig):
    """Temps 8-11 : la queue. On descend en tortillant le bassin, buste penché, ailes rangées."""
    for i, b in enumerate(range(8, 12)):
        drop = BASE_DROP + 0.07 * (i + 1)  # descend un peu à chaque temps
        for half, sgn in ((0, 1), (0.5, -1)):
            f = F(b + half)
            rig.key_hips(f, drop, yaw=18 * sgn, shift=0.035 * sgn)
            sym_hands(rig, f, wing_hand, wing_down, None, 0.0)
            rig.key_fingers(f, 85, 40)
            rig.key_bend(f, 'Spine', 10 + 3 * i, side_deg=-6 * sgn)
            rig.key_bend(f, 'Neck', 5)


def claps(rig):
    """Temps 12-15 : on remonte et on tape 4 fois dans les mains ; la dernière ouverture repart vers le bec."""
    for b in range(12, 16):
        sym_hands(rig, F(b), clap_in, clap_elbow, CLAP, 1.0)
        rig.key_fingers(F(b), 5, 0)
        rig.key_hips(F(b), BASE_DROP + BOUNCE)
        rig.key_bend(F(b), 'Spine', 4); rig.key_bend(F(b), 'Neck', 6)
        if b < 15:
            sym_hands(rig, F(b + 0.5), clap_out, clap_elbow, CLAP, 1.0)
            rig.key_hips(F(b + 0.5), BASE_DROP)
            rig.key_bend(F(b + 0.5), 'Spine', 0); rig.key_bend(F(b + 0.5), 'Neck', 0)


def close_loop(rig):
    """Image 144 = image 1 : la boucle se referme."""
    beak_pose(rig, MOCAP_FRAMES, True); rig.key_hips(MOCAP_FRAMES, BASE_DROP + BOUNCE)
    rig.key_bend(MOCAP_FRAMES, 'Neck', 12); rig.key_bend(MOCAP_FRAMES, 'Spine', 3)


def arms_fk_during_tail(rig):
    """Pendant la queue, le buste descend et se penche : des cibles fixes dans le monde laisseraient
    les mains en l'air. On passe les bras en FK (pose des ailes figée par rapport au buste)."""
    rig.scene.frame_set(F(7.5))
    arm_fk = {n: rig.local_rotation(n) for s in ('Left', 'Right') for n in (s + 'Arm', s + 'ForeArm')}
    for n, q in arm_fk.items():
        for f in (F(7.5), F(11.5)):
            rig.key_rotation(f, n, q)
    for n in ('LeftForeArm', 'RightForeArm'):
        rig.key_ik_influence(n, ((F(7.5), 1.0), (F(8), 0.0), (F(11.5), 0.0), (F(12), 1.0)))


def main():
    rig = build_rig()
    beak(rig)
    wings(rig)
    tail(rig)
    claps(rig)
    close_loop(rig)
    arms_fk_during_tail(rig)
    act = rig.bake(MOCAP_FRAMES, 'keyframes')
    set_linear(act)
    print('baked', act.name)
    save_blend(DANCE_BLEND)


if __name__ == '__main__':
    main()
