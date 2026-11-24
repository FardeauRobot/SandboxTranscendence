"""Rendus de contrôle de Volt : python render_volt.py volt.blend sortie_prefix [clip:frame ...]"""
import sys, math
import bpy
from mathutils import Vector

BLEND, PREFIX = sys.argv[1], sys.argv[2]
SHOTS = sys.argv[3:] or ['rest:0']
bpy.ops.wm.open_mainfile(filepath=BLEND)
sc = bpy.context.scene
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')

sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = 24
sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 420, 630
sc.render.film_transparent = False
sc.view_settings.view_transform = 'AgX'

world = bpy.data.worlds.new('w'); sc.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.018, 0.018, 0.022, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0

# sol sombre
bpy.ops.mesh.primitive_plane_add(size=12)
floor = bpy.context.object
fm = bpy.data.materials.new('floor'); fm.use_nodes = True
fm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.03, 0.03, 0.035, 1)
fm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.6
floor.data.materials.append(fm)


def light(name, loc, energy, color, size=2.0):
    d = bpy.data.lights.new(name, 'AREA'); d.energy = energy; d.color = color; d.size = size
    o = bpy.data.objects.new(name, d); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector((0, 0, 1.0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()


light('key', (2.2, -3.5, 3.0), 900, (1, 0.97, 0.94))
light('fill', (-3, -2.5, 1.5), 180, (0.85, 0.9, 1))
light('rimB', (-2.6, 2.2, 2.2), 900, (0.25, 0.45, 1.0))
light('rimR', (2.6, 2.4, 2.0), 700, (1.0, 0.2, 0.3))

cam_d = bpy.data.cameras.new('cam'); cam_d.lens = 50
cam = bpy.data.objects.new('cam', cam_d); sc.collection.objects.link(cam); sc.camera = cam


def aim(loc, target):
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()


for shot in SHOTS:
    clip, frame = shot.split(':')
    view = 'face'
    if '@' in frame:
        frame, view = frame.split('@')
    if arm.animation_data is None:
        arm.animation_data_create()
    if clip == 'rest':
        arm.animation_data.action = None
        for pb in arm.pose.bones:
            pb.matrix_basis.identity()
    else:
        act = bpy.data.actions[clip]
        arm.animation_data.action = act
        if act.slots:
            arm.animation_data.action_slot = act.slots[0]
    sc.frame_set(int(frame))
    if view == 'face':
        aim((1.5, -4.6, 1.15), (0, 0, 0.93))
    elif view == 'head':
        aim((0.35, -1.1, 1.72), (0, 0, 1.68))
    elif view == 'back':
        aim((-1.4, 4.6, 1.2), (0, 0, 0.93))
    sc.render.filepath = f'{PREFIX}_{clip}_{frame}_{view}.png'
    bpy.ops.render.render(write_still=True)
    print('[render]', sc.render.filepath)
