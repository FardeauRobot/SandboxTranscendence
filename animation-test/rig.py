"""Rig d'animation pour le squelette Mixamo (le Y Bot de chicken.fbx), commun à toutes les chorégraphies.

Méthode d'animateur : on ne touche pas aux rotations bras/jambes une par une.
On place des cibles (poignets, coudes, pieds, genoux) et l'IK calcule les angles ;
le tronc, la tête et les doigts sont en FK. Ensuite on « cuit » tout en rotations
simples, image par image, pour que three.js puisse le lire.

Utilisation (voir keyframe_dance.py et idle.py) :

    rig = build_rig()                  # charge le FBX et monte le rig
    rig.key_hands(1, ...)              # clés : mains, doigts, bassin, flexions
    rig.bake(144, 'keyframes')         # cuisson en FK des images 1 à 144
    export_glb('ybot_dances.glb')
"""
import contextlib
import io
import math
import os

import bpy
from mathutils import Matrix, Quaternion, Vector

from common import load

# ---------------------------------------------------------------- fichiers (relatifs au dossier courant)
FBX = 'chicken.fbx'             # le Y Bot de Mixamo avec sa Chicken Dance capturée
DANCE_BLEND = 'both.blend'      # écrit par keyframe_dance.py : actions 'mocap' et 'keyframes'
GLB = 'ybot_dances.glb'         # écrit par idle.py : clips 'idle', 'mocap' et 'keyframes'

# Durée de la mocap (images à 30 i/s) : c'est aussi la plage de la scène.
MOCAP_FRAMES = 144

FINGERS = ['Index', 'Middle', 'Ring', 'Pinky']
SIDES = {'L': 'Left', 'R': 'Right'}


def abspath(path):
    """Chemin absolu depuis le dossier courant (bpy ne résout pas toujours les chemins relatifs pareil)."""
    return os.path.abspath(path)


# ---------------------------------------------------------------- géométrie
def mirror(v):
    """Symétrique d'une position par rapport au plan médian du corps (x → -x)."""
    return (-v[0], v[1], v[2])


def hand_quat(fingers, palm):
    """Orientation de main (monde) à partir de la direction des doigts et de la normale de la paume.

    Axes locaux de la main Mixamo : Y = vers les doigts, Z = normale de la paume.
    """
    y = Vector(fingers).normalized()
    z = Vector(palm)
    z = (z - z.dot(y) * y).normalized()
    x = y.cross(z)
    return Matrix((x, y, z)).transposed().to_quaternion()


# ---------------------------------------------------------------- chargement
def load_ybot(path=FBX):
    """Charge le FBX dans une scène vide. Sa danse capturée est gardée comme action 'mocap' et détachée
    de l'armature, qui est renvoyée libre pour de nouvelles clés."""
    with contextlib.redirect_stdout(io.StringIO()):
        arm = load(path)
    mocap = arm.animation_data.action
    mocap.name = 'mocap'
    mocap.use_fake_user = True
    arm.animation_data.action = None
    return arm


def build_rig(path=FBX):
    """Charge le Y Bot et monte le rig : c'est le point d'entrée des chorégraphies."""
    return Rig(load_ybot(path))


# ---------------------------------------------------------------- le rig
class Rig:
    """Armature Mixamo + cibles IK (empties) + contraintes, et les outils pour poser des clés.

    Cibles : hand_L/R (poignets), elbow_L/R (pôles des coudes), foot_L/R (chevilles), knee_L/R (pôles
    des genoux). Les pieds restent à plat ; l'orientation des mains suit hand_L/R selon un poids animé.
    """

    def __init__(self, arm):
        self.arm = arm
        self.scene = bpy.context.scene
        self.scene.frame_start, self.scene.frame_end = 1, MOCAP_FRAMES
        self._reset_pose()
        self.mw = arm.matrix_world.copy()
        self.targets = {k: self._empty(k) for k in
                        ['hand_L', 'hand_R', 'elbow_L', 'elbow_R', 'foot_L', 'foot_R', 'knee_L', 'knee_R']}
        self._place_leg_targets()
        self.iks = {}
        self.hand_rotation = {}
        self._prebend_limbs()
        self._add_iks()
        self._lock_feet()
        self._orient_hands()
        hips_rest = self.mw @ self.bone('Hips').bone.matrix_local
        self._hips_rest = hips_rest
        self._hip_head = hips_rest.translation.copy()

    def bone(self, name):
        """Os de pose par son nom Mixamo sans préfixe ('Hips', 'LeftForeArm'…)."""
        return self.arm.pose.bones['mixamorig:' + name]

    # ---- montage
    def _reset_pose(self):
        """Repose en T, rotations en quaternions."""
        for pb in self.arm.pose.bones:
            pb.rotation_mode = 'QUATERNION'
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)
        bpy.context.view_layer.update()

    def _empty(self, name):
        e = bpy.data.objects.new(name, None)
        self.scene.collection.objects.link(e)
        e.rotation_mode = 'QUATERNION'
        return e

    def _place_leg_targets(self):
        """Pieds à leur place de repos, pôles des genoux devant et au-dessus."""
        T = self.targets
        T['foot_L'].location = (0.082, 0.027, 0.087)
        T['foot_R'].location = (-0.082, 0.027, 0.087)
        T['knee_L'].location = (0.12, -0.8, 0.5)
        T['knee_R'].location = (-0.12, -0.8, 0.5)

    def _prebend_limbs(self):
        """En T-pose bras et jambes sont parfaitement tendus : l'IK ne sait pas de quel côté plier.
        On les pré-plie de 15° pour lui donner le plan de flexion."""
        for s in ('Left', 'Right'):
            self.bone(s + 'ForeArm').rotation_quaternion = Quaternion((0, 0, 1), math.radians(15))
            self.bone(s + 'Leg').rotation_quaternion = Quaternion((1, 0, 0), math.radians(-15))

    def _ik(self, bone, target, pole, angle):
        c = self.bone(bone).constraints.new('IK')
        c.target, c.pole_target, c.pole_angle, c.chain_count = target, pole, math.radians(angle), 2
        self.iks[bone] = c

    def _add_iks(self):
        """IK à deux os : avant-bras → poignet (pôle au coude), jambe → cheville (pôle au genou)."""
        T = self.targets
        self._ik('LeftForeArm', T['hand_L'], T['elbow_L'], 0)
        self._ik('RightForeArm', T['hand_R'], T['elbow_R'], 0)
        self._ik('LeftLeg', T['foot_L'], T['knee_L'], 90)
        self._ik('RightLeg', T['foot_R'], T['knee_R'], 90)

    def _lock_feet(self):
        """Pieds à plat : ils gardent leur orientation de repos quoi que fassent les genoux."""
        for s, e in (('Left', 'foot_L'), ('Right', 'foot_R')):
            target = self.targets[e]
            target.rotation_quaternion = (self.mw @ self.bone(s + 'Foot').bone.matrix_local).to_quaternion()
            self.bone(s + 'Foot').constraints.new('COPY_ROTATION').target = target

    def _orient_hands(self):
        """Orientation des mains : copiée sur l'empty (poids animé : 1 = main orientée, 0 = suit l'avant-bras)."""
        for s in 'LR':
            c = self.bone(SIDES[s] + 'Hand').constraints.new('COPY_ROTATION')
            c.target = self.targets['hand_' + s]
            self.hand_rotation[s] = c

    # ---- clés
    def key_hands(self, f, posL, posR, eL, eR, ori=None, w=1.0):
        """Poignets en posL/posR, coudes vers eL/eR (positions monde, en m).

        ori : paire (gauche, droite) d'orientations de main (voir hand_quat) ou None pour ne pas
        la clé ; w : poids de cette orientation (0 = la main suit l'avant-bras).
        """
        for s, pos, el in (('L', posL, eL), ('R', posR, eR)):
            hand, elbow = self.targets['hand_' + s], self.targets['elbow_' + s]
            hand.location = pos
            hand.keyframe_insert('location', frame=f)
            elbow.location = el
            elbow.keyframe_insert('location', frame=f)
            if ori:
                hand.rotation_quaternion = ori[0 if s == 'L' else 1]
                hand.keyframe_insert('rotation_quaternion', frame=f)
            self.hand_rotation[s].influence = w
            self.hand_rotation[s].keyframe_insert('influence', frame=f)

    def key_fingers(self, f, curl, thumb):
        """curl : flexion des 4 doigts (°), thumb : fermeture du pouce (°). Mêmes valeurs des deux côtés."""
        for side in ('Left', 'Right'):
            for fi in FINGERS:
                for j, k in ((1, 0.8), (2, 1.0), (3, 0.7)):
                    pb = self.bone(f'{side}Hand{fi}{j}')
                    pb.rotation_quaternion = Quaternion((1, 0, 0), math.radians(curl * k))
                    pb.keyframe_insert('rotation_quaternion', frame=f)
            sign = 1 if side == 'Left' else -1
            for j in (1, 2, 3):
                pb = self.bone(f'{side}HandThumb{j}')
                pb.rotation_quaternion = Quaternion((0, 0, 1), math.radians(sign * thumb * (0.6 if j == 1 else 0.4)))
                pb.keyframe_insert('rotation_quaternion', frame=f)

    def key_hips(self, f, drop=0.0, yaw=0.0, shift=0.0):
        """drop : descente (m), yaw : rotation du bassin autour de la verticale (°), shift : décalage latéral (m)."""
        d = Vector((shift, 0, -drop))
        R = Matrix.Rotation(math.radians(yaw), 4, 'Z')
        M = Matrix.Translation(self._hip_head + d) @ R @ Matrix.Translation(-self._hip_head) @ self._hips_rest
        pb = self.bone('Hips')
        pb.matrix = self.mw.inverted() @ M
        bpy.context.view_layer.update()
        pb.keyframe_insert('location', frame=f)
        pb.keyframe_insert('rotation_quaternion', frame=f)

    def key_bend(self, f, bone, deg, side_deg=0.0):
        """Flexion FK d'un os du tronc : deg vers l'avant (axe X), side_deg sur le côté (axe Z)."""
        pb = self.bone(bone)
        pb.rotation_quaternion = Quaternion((1, 0, 0), math.radians(deg)) @ Quaternion((0, 0, 1), math.radians(side_deg))
        pb.keyframe_insert('rotation_quaternion', frame=f)

    def key_rotation(self, f, bone, q):
        """Clé de rotation locale brute (quaternion) sur un os."""
        pb = self.bone(bone)
        pb.rotation_quaternion = q
        pb.keyframe_insert('rotation_quaternion', frame=f)

    def key_ik_influence(self, bone, keys):
        """Anime le poids de l'IK de `bone` : keys = [(image, poids), …] (0 = l'os repasse en FK)."""
        c = self.iks[bone]
        for f, w in keys:
            c.influence = w
            c.keyframe_insert('influence', frame=f)

    def local_rotation(self, bone):
        """Rotation locale de l'os telle qu'évaluée à l'image courante (IK et contraintes comprises)."""
        pb = self.bone(bone)
        return self.arm.convert_space(pose_bone=pb, matrix=pb.matrix, from_space='POSE', to_space='LOCAL').to_quaternion()

    # ---- cuisson
    def bake(self, last, name):
        """Cuit les images 1..last en FK pure et renvoie la nouvelle action, nommée `name`.

        Évalue la pose de chaque image (IK et contraintes comprises), puis démonte le rig (contraintes,
        cibles, action de travail) et pose une clé de rotation par os et par image (+ position du bassin).
        Le rig n'est plus utilisable ensuite.
        """
        bones = list(self.arm.pose.bones)
        baked = self._evaluate(bones, last)
        self._dismantle(bones)
        for f in range(1, last + 1):
            for pb in bones:
                loc, rot, _ = baked[f][pb.name].decompose()
                pb.rotation_quaternion = rot
                pb.keyframe_insert('rotation_quaternion', frame=f)
                if pb.name == 'mixamorig:Hips':
                    pb.location = loc
                    pb.keyframe_insert('location', frame=f)
        act = self.arm.animation_data.action
        act.name = name
        act.use_fake_user = True
        return act

    def _evaluate(self, bones, last):
        """Matrice locale de chaque os à chaque image 1..last : {image: {nom d'os: matrice}}."""
        baked = {}
        for f in range(1, last + 1):
            self.scene.frame_set(f)
            baked[f] = {pb.name: self.arm.convert_space(pose_bone=pb, matrix=pb.matrix, from_space='POSE', to_space='LOCAL')
                        for pb in bones}
        return baked

    def _dismantle(self, bones):
        """Retire contraintes, action de travail et cibles : l'armature est prête pour les clés cuites."""
        for pb in bones:
            for c in list(pb.constraints):
                pb.constraints.remove(c)
        work = self.arm.animation_data.action
        self.arm.animation_data.action = None
        for e in self.targets.values():
            bpy.data.objects.remove(e)
        if work:
            bpy.data.actions.remove(work)


# ---------------------------------------------------------------- actions et fichiers
def set_linear(action):
    """Interpolation linéaire entre les clés.

    Sans effet avec bpy 5.x : les actions « à slots » n'ont plus d'attribut `fcurves`
    (gardé tel quel ; l'export GLB échantillonne de toute façon chaque image).
    """
    for fc in action.fcurves if hasattr(action, 'fcurves') else []:
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'


def append_action(blend, name):
    """Ajoute à la scène courante l'action `name` d'un autre .blend, protégée de la purge."""
    with bpy.data.libraries.load(abspath(blend)) as (data_from, data_to):
        data_to.actions = [name]
    data_to.actions[0].use_fake_user = True
    return data_to.actions[0]


def save_blend(path):
    bpy.ops.wm.save_as_mainfile(filepath=abspath(path))


def export_glb(path=GLB):
    """Exporte toutes les actions de l'armature en clips glTF, échantillonnés à chaque image."""
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, MOCAP_FRAMES
    bpy.ops.export_scene.gltf(filepath=abspath(path), export_format='GLB',
                              export_animation_mode='ACTIONS', export_force_sampling=True, export_frame_step=1,
                              export_yup=True)
