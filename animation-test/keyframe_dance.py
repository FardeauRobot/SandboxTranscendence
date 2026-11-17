"""Chicken Dance écrite à la main en keyframes sur le squelette Mixamo.

Méthode d'animateur : on ne touche pas aux rotations bras/jambes une par une.
On place des cibles (poignets, coudes, pieds) et l'IK calcule les angles ;
le tronc, la tête et les doigts sont en FK. Ensuite on « cuit » tout en
rotations simples, image par image, pour que three.js puisse le lire.

Tempo : 1 temps = 9 images à 30 i/s. 16 temps = 144 images = 4,8 s (même durée que la mocap).
  temps 0-3   : le bec   (mains devant, 4 « clac »)
  temps 4-7   : les ailes (poings sous les bras, 4 battements de coudes)
  temps 8-11  : la queue  (on descend en se tortillant)
  temps 12-15 : 4 claps, puis retour au bec pour boucler
"""
import sys, io, math, contextlib
sys.path.insert(0, '.')
import bpy
from mathutils import Vector, Matrix, Quaternion
from common import load

OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'keyframes.glb'

with contextlib.redirect_stdout(io.StringIO()):
    arm = load()
mocap = arm.animation_data.action
mocap.name = 'mocap'
mocap.use_fake_user = True
arm.animation_data.action = None
sc = bpy.context.scene
sc.frame_start, sc.frame_end = 1, 144
for pb in arm.pose.bones:
    pb.rotation_mode = 'QUATERNION'
    pb.rotation_quaternion = (1, 0, 0, 0)
    pb.location = (0, 0, 0)
bpy.context.view_layer.update()

MW = arm.matrix_world.copy()
P = lambda n: arm.pose.bones['mixamorig:' + n]
BEAT = 9
def F(beat):  # image d'un temps (le temps 0 tombe sur l'image 1)
    return 1 + round(beat * BEAT)

# ---------------------------------------------------------------- cibles (empties)
def empty(name):
    e = bpy.data.objects.new(name, None)
    sc.collection.objects.link(e)
    e.rotation_mode = 'QUATERNION'
    return e

T = {k: empty(k) for k in ['hand_L', 'hand_R', 'elbow_L', 'elbow_R', 'foot_L', 'foot_R', 'knee_L', 'knee_R']}
T['foot_L'].location = (0.082, 0.027, 0.087)
T['foot_R'].location = (-0.082, 0.027, 0.087)
T['knee_L'].location = (0.12, -0.8, 0.5)
T['knee_R'].location = (-0.12, -0.8, 0.5)

IKS = {}
def ik(bone, target, pole, angle):
    c = P(bone).constraints.new('IK')
    c.target, c.pole_target, c.pole_angle, c.chain_count = target, pole, math.radians(angle), 2
    IKS[bone] = c

# En T-pose bras et jambes sont parfaitement tendus : l'IK ne sait pas de quel côté plier.
# On les pré-plie de 15° pour lui donner le plan de flexion.
for s in ('Left', 'Right'):
    P(s + 'ForeArm').rotation_quaternion = Quaternion((0, 0, 1), math.radians(15))
    P(s + 'Leg').rotation_quaternion = Quaternion((1, 0, 0), math.radians(-15))
ik('LeftForeArm', T['hand_L'], T['elbow_L'], 0)
ik('RightForeArm', T['hand_R'], T['elbow_R'], 0)
ik('LeftLeg', T['foot_L'], T['knee_L'], 90)
ik('RightLeg', T['foot_R'], T['knee_R'], 90)
# Orientation des mains : copiée sur l'empty (poids animé : 1 = main orientée, 0 = suit l'avant-bras)
# Pieds à plat : ils gardent leur orientation de repos quoi que fassent les genoux
for s, e in (('Left', 'foot_L'), ('Right', 'foot_R')):
    T[e].rotation_quaternion = (MW @ P(s + 'Foot').bone.matrix_local).to_quaternion()
    P(s + 'Foot').constraints.new('COPY_ROTATION').target = T[e]
rotc = {}
for s in 'LR':
    c = P(('Left' if s == 'L' else 'Right') + 'Hand').constraints.new('COPY_ROTATION')
    c.target = T['hand_' + s]
    rotc[s] = c

# ---------------------------------------------------------------- orientations de main
# Axes locaux de la main Mixamo : Y = vers les doigts, Z = normale de la paume.
def hand_quat(fingers, palm):
    y = Vector(fingers).normalized()
    z = Vector(palm)
    z = (z - z.dot(y) * y).normalized()
    x = y.cross(z)
    return Matrix((x, y, z)).transposed().to_quaternion()

ORI = {
    'beak_L': hand_quat((0, -1, 0.15), (0, 0, -1)),  # doigts devant, paume vers le bas
    'beak_R': hand_quat((0, -1, 0.15), (0, 0, -1)),
    'clap_L': hand_quat((0, -0.6, 0.8), (-1, 0, 0)),  # doigts vers le haut, paumes face à face
    'clap_R': hand_quat((0, -0.6, 0.8), (1, 0, 0)),
}

# ---------------------------------------------------------------- outils de clé
def key_hands(f, posL, posR, eL, eR, ori=None, w=1.0):
    for s, pos, el in (('L', posL, eL), ('R', posR, eR)):
        T['hand_' + s].location = pos
        T['hand_' + s].keyframe_insert('location', frame=f)
        T['elbow_' + s].location = el
        T['elbow_' + s].keyframe_insert('location', frame=f)
        if ori:
            T['hand_' + s].rotation_quaternion = ORI[f'{ori}_{s}']
            T['hand_' + s].keyframe_insert('rotation_quaternion', frame=f)
        rotc[s].influence = w
        rotc[s].keyframe_insert('influence', frame=f)

def mirror(v):
    return (-v[0], v[1], v[2])

FINGERS = ['Index', 'Middle', 'Ring', 'Pinky']
def key_fingers(f, curl, thumb):
    """curl : flexion des 4 doigts (°), thumb : fermeture du pouce (°)."""
    for side in ('Left', 'Right'):
        for fi in FINGERS:
            for j, k in ((1, 0.8), (2, 1.0), (3, 0.7)):
                pb = P(f'{side}Hand{fi}{j}')
                pb.rotation_quaternion = Quaternion((1, 0, 0), math.radians(curl * k))
                pb.keyframe_insert('rotation_quaternion', frame=f)
        for j in (1, 2, 3):
            pb = P(f'{side}HandThumb{j}')
            sign = 1 if side == 'Left' else -1
            pb.rotation_quaternion = Quaternion((0, 0, 1), math.radians(sign * thumb * (0.6 if j == 1 else 0.4)))
            pb.keyframe_insert('rotation_quaternion', frame=f)

HIPS_REST = MW @ P('Hips').bone.matrix_local
HIP_HEAD = HIPS_REST.translation.copy()
def key_hips(f, drop=0.0, yaw=0.0, shift=0.0):
    """drop : descente (m), yaw : rotation du bassin (°), shift : décalage latéral (m)."""
    d = Vector((shift, 0, -drop))
    R = Matrix.Rotation(math.radians(yaw), 4, 'Z')
    M = Matrix.Translation(HIP_HEAD + d) @ R @ Matrix.Translation(-HIP_HEAD) @ HIPS_REST
    pb = P('Hips')
    pb.matrix = MW.inverted() @ M
    bpy.context.view_layer.update()
    pb.keyframe_insert('location', frame=f)
    pb.keyframe_insert('rotation_quaternion', frame=f)

def key_bend(f, bone, deg, side_deg=0.0):
    pb = P(bone)
    pb.rotation_quaternion = Quaternion((1, 0, 0), math.radians(deg)) @ Quaternion((0, 0, 1), math.radians(side_deg))
    pb.keyframe_insert('rotation_quaternion', frame=f)

# ---------------------------------------------------------------- la chorégraphie
BASE_DROP = 0.05  # genoux légèrement fléchis en permanence (sinon l'IK verrouille la jambe tendue)
BOUNCE = 0.03     # petit rebond sur chaque temps

# Poses de référence (côté gauche, le droit est en miroir)
beak_hand = (0.17, -0.30, 1.50); beak_elbow = (0.55, 0.15, 0.95)
wing_hand = (0.13, -0.10, 1.37)
wing_up = (0.60, 0.20, 1.50); wing_down = (0.40, 0.10, 1.00)
clap_in = (0.035, -0.32, 1.27); clap_out = (0.24, -0.28, 1.30); clap_elbow = (0.55, 0.05, 0.85)

def beak_pose(f, closed):
    key_hands(f, beak_hand, mirror(beak_hand), beak_elbow, mirror(beak_elbow), 'beak', 1.0)
    key_fingers(f, 25 if closed else 0, 55 if closed else -10)

# Temps 0-3 : le bec. Clac sur le temps, ouvert à la croche ; la tête picore.
for b in range(4):
    beak_pose(F(b), True)
    beak_pose(F(b + 0.5), False)
    key_hips(F(b), BASE_DROP + BOUNCE); key_hips(F(b + 0.5), BASE_DROP)
    key_bend(F(b), 'Neck', 12); key_bend(F(b + 0.5), 'Neck', -4)
    key_bend(F(b), 'Spine', 3); key_bend(F(b + 0.5), 'Spine', 0)

# Temps 4-7 : les ailes. Poings sous les aisselles, coudes en haut sur le temps.
for b in range(4, 8):
    key_hands(F(b), wing_hand, mirror(wing_hand), wing_up, mirror(wing_up), None, 0.0)
    key_hands(F(b + 0.5), wing_hand, mirror(wing_hand), wing_down, mirror(wing_down), None, 0.0)
    key_fingers(F(b), 85, 40); key_fingers(F(b + 0.5), 85, 40)
    key_hips(F(b), BASE_DROP + BOUNCE); key_hips(F(b + 0.5), BASE_DROP)
    key_bend(F(b), 'Neck', 4); key_bend(F(b + 0.5), 'Neck', 0)
    key_bend(F(b), 'Spine', 0); key_bend(F(b + 0.5), 'Spine', 0)

# Temps 8-11 : la queue. On descend en tortillant le bassin, buste penché, ailes rangées.
for i, b in enumerate(range(8, 12)):
    drop = BASE_DROP + 0.07 * (i + 1)  # descend un peu à chaque temps
    for half, sgn in ((0, 1), (0.5, -1)):
        f = F(b + half)
        key_hips(f, drop, yaw=18 * sgn, shift=0.035 * sgn)
        key_hands(f, wing_hand, mirror(wing_hand), wing_down, mirror(wing_down), None, 0.0)
        key_fingers(f, 85, 40)
        key_bend(f, 'Spine', 10 + 3 * i, side_deg=-6 * sgn)
        key_bend(f, 'Neck', 5)

# Temps 12-15 : on remonte et on tape 4 fois dans les mains ; la dernière ouverture repart vers le bec.
for b in range(12, 16):
    key_hands(F(b), clap_in, mirror(clap_in), clap_elbow, mirror(clap_elbow), 'clap', 1.0)
    key_fingers(F(b), 5, 0)
    key_hips(F(b), BASE_DROP + BOUNCE)
    key_bend(F(b), 'Spine', 4); key_bend(F(b), 'Neck', 6)
    if b < 15:
        key_hands(F(b + 0.5), clap_out, mirror(clap_out), clap_elbow, mirror(clap_elbow), 'clap', 1.0)
        key_hips(F(b + 0.5), BASE_DROP)
        key_bend(F(b + 0.5), 'Spine', 0); key_bend(F(b + 0.5), 'Neck', 0)
# image 144 = image 1 : la boucle se referme
beak_pose(144, True); key_hips(144, BASE_DROP + BOUNCE)
key_bend(144, 'Neck', 12); key_bend(144, 'Spine', 3)

# Pendant la queue, le buste descend et se penche : des cibles fixes dans le monde laisseraient
# les mains en l'air. On passe les bras en FK (pose des ailes figée par rapport au buste).
sc.frame_set(F(7.5))
arm_fk = {n: arm.convert_space(pose_bone=P(n), matrix=P(n).matrix, from_space='POSE', to_space='LOCAL').to_quaternion()
          for s in ('Left', 'Right') for n in (s + 'Arm', s + 'ForeArm')}
for n, q in arm_fk.items():
    for f in (F(7.5), F(11.5)):
        P(n).rotation_quaternion = q
        P(n).keyframe_insert('rotation_quaternion', frame=f)
for n in ('LeftForeArm', 'RightForeArm'):
    c = IKS[n]
    for f, w in ((F(7.5), 1.0), (F(8), 0.0), (F(11.5), 0.0), (F(12), 1.0)):
        c.influence = w
        c.keyframe_insert('influence', frame=f)

# ---------------------------------------------------------------- cuisson en FK
bones = [pb for pb in arm.pose.bones]
baked = {}
for f in range(1, 145):
    sc.frame_set(f)
    baked[f] = {pb.name: arm.convert_space(pose_bone=pb, matrix=pb.matrix, from_space='POSE', to_space='LOCAL')
                for pb in bones}

for pb in bones:
    for c in list(pb.constraints):
        pb.constraints.remove(c)
src = arm.animation_data.action
arm.animation_data.action = None
for e in T.values():
    bpy.data.objects.remove(e)
if src:
    bpy.data.actions.remove(src)

for f in range(1, 145):
    for pb in bones:
        loc, rot, _ = baked[f][pb.name].decompose()
        pb.rotation_quaternion = rot
        pb.keyframe_insert('rotation_quaternion', frame=f)
        if pb.name == 'mixamorig:Hips':
            pb.location = loc
            pb.keyframe_insert('location', frame=f)
act = arm.animation_data.action
act.name = 'keyframes'
act.use_fake_user = True
for fc in act.fcurves if hasattr(act, 'fcurves') else []:
    for kp in fc.keyframe_points:
        kp.interpolation = 'LINEAR'
print('baked', act.name)

bpy.ops.wm.save_as_mainfile(filepath='/home/claude/dance/both.blend')
