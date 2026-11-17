"""Animation de repos : bras le long du corps, respiration, léger balancement. Boucle de 2 s (60 images).

Réutilise le rig de keyframe_dance.py (cibles IK + cuisson en FK), puis exporte un GLB
avec trois clips : idle, mocap (Mixamo) et keyframes (Chicken Dance réécrite en code).
"""
import sys, math
sys.path.insert(0, '.')
import bpy

src = open('keyframe_dance.py').read()
setup = src[:src.index('# Poses de référence')]
exec(compile(setup, 'keyframe_dance_setup', 'exec'))  # arm, P, T, key_* ...

BASE_DROP = 0.05
N = 61  # image 61 = image 1
hand = (0.24, 0.0, 0.93); elbow = (0.35, 0.45, 1.15)  # mains pendantes, coudes vers l'arrière
for f in range(1, N + 1, 5):
    ph = (f - 1) / (N - 1) * 2 * math.pi
    breath = math.sin(ph)
    sway = math.sin(ph)  # un balancement par boucle
    key_hips(f, BASE_DROP * 0.6 + 0.008 * (1 - breath), yaw=1.5 * sway, shift=0.015 * sway)
    lift = 0.012 * breath
    key_hands(f, (hand[0], hand[1], hand[2] + lift), (-hand[0], hand[1], hand[2] + lift),
              elbow, mirror(elbow), None, 0.0)
    key_fingers(f, 18, 10)
    key_bend(f, 'Spine', -1.2 * breath)
    key_bend(f, 'Spine2', -1.0 * breath)
    key_bend(f, 'Neck', 2 + 1.0 * breath, side_deg=1.5 * sway)

bones = list(arm.pose.bones)
baked = {}
for f in range(1, N + 1):
    sc.frame_set(f)
    baked[f] = {pb.name: arm.convert_space(pose_bone=pb, matrix=pb.matrix, from_space='POSE', to_space='LOCAL')
                for pb in bones}
for pb in bones:
    for c in list(pb.constraints):
        pb.constraints.remove(c)
tmp = arm.animation_data.action
arm.animation_data.action = None
for e in T.values():
    bpy.data.objects.remove(e)
if tmp:
    bpy.data.actions.remove(tmp)
for f in range(1, N + 1):
    for pb in bones:
        loc, rot, _ = baked[f][pb.name].decompose()
        pb.rotation_quaternion = rot
        pb.keyframe_insert('rotation_quaternion', frame=f)
        if pb.name == 'mixamorig:Hips':
            pb.location = loc
            pb.keyframe_insert('location', frame=f)
idle = arm.animation_data.action
idle.name = 'idle'
idle.use_fake_user = True

# On récupère la Chicken Dance en keyframes déjà cuite
with bpy.data.libraries.load('/home/claude/dance/both.blend') as (data_from, data_to):
    data_to.actions = ['keyframes']
data_to.actions[0].use_fake_user = True
print('actions', [a.name for a in bpy.data.actions])

sc.frame_start, sc.frame_end = 1, 144
bpy.ops.export_scene.gltf(filepath='/home/claude/dance/ybot_dances.glb', export_format='GLB',
                          export_animation_mode='ACTIONS', export_force_sampling=True, export_frame_step=1,
                          export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath='/home/claude/dance/idle.blend')
