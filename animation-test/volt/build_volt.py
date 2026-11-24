"""Volt : le robot danseur du casting, construit sur le squelette du X Bot de all_dances.glb.

Principe : pas de nouveau corps. La combinaison noire, c'est le corps du X Bot recoloré. Les plaques
blanches et bleues sont des « coques » découpées dans ce même corps, poussées vers l'extérieur et
épaissies : elles gardent les poids de skinning d'origine, donc elles suivent les 52 danses sans
retargeting. Le casque (visière LED, oreillettes, antenne) est rigide, accroché à l'os Head.

Usage : python build_volt.py <all_dances.glb> <sortie.glb> [--blend volt.blend]  (voir README.md)
"""
import sys, math
import bpy, bmesh
from mathutils import Vector, Matrix

SRC, OUT = sys.argv[1], sys.argv[2]
BLEND = sys.argv[sys.argv.index('--blend') + 1] if '--blend' in sys.argv else None

# ------------------------------------------------------------------ scène
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
for o in list(bpy.data.objects):
    if o.type == 'MESH' and not o.name.startswith('Beta'):
        bpy.data.objects.remove(o)  # objet parasite (Icosphere) du fichier source
ARM = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
SURF = bpy.data.objects['Beta_Surface']
JOINTS = bpy.data.objects['Beta_Joints']
MW = SURF.matrix_world.copy()          # local du corps -> monde (mètres, Z haut, avant = -Y)
PRE = 'mixamorig:'
DECIMATE = 0.45


def joint(name):
    """Position monde (repos) de la tête d'un os Mixamo."""
    return ARM.matrix_world @ ARM.data.bones[PRE + name].head_local


# ------------------------------------------------------------------ matériaux
def mat(name, rgb, rough=0.4, metal=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if emit:
        p.inputs['Emission Color'].default_value = (*emit, 1)
        p.inputs['Emission Strength'].default_value = strength
    return m


def lin(h):
    """Couleur sRGB hex -> linéaire (ce que Blender et glTF attendent)."""
    c = [(h >> s & 255) / 255 for s in (16, 8, 0)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


M_SUIT = mat('volt_suit', lin(0x15161c), rough=0.42, metal=0.15)
M_JOINT = mat('volt_joint', lin(0x2a2d36), rough=0.35, metal=0.5)
M_WHITE = mat('volt_white', lin(0xf3f5fa), rough=0.22)
M_BLUE = mat('volt_blue', lin(0x1f5bff), rough=0.28, metal=0.1)
M_VISOR = mat('volt_visor', lin(0x05060a), rough=0.08, metal=0.3)
M_LED = mat('volt_led', lin(0x7ff6ff), rough=0.3, emit=lin(0x3fe8ff), strength=6.0)
M_YELLOW = mat('volt_yellow', lin(0xffd23f), rough=0.35)
M_SOLE = mat('volt_sole', lin(0x101114), rough=0.7)

SURF.data.materials.clear(); SURF.data.materials.append(M_SUIT)
JOINTS.data.materials.clear(); JOINTS.data.materials.append(M_JOINT)


# ------------------------------------------------------------------ silhouette : taille affinée
# Le X Bot a un ventre rond ; Volt est fin. On resserre la taille (x et y) entre le bassin et le plastron,
# avec un fondu aux deux bouts. Ça ne touche que la position de repos : le skinning ne change pas.
def slim(obj, z0=0.86, z1=1.36, fx=0.88, fy=0.92):
    mw, mwi = obj.matrix_world, obj.matrix_world.inverted()
    for v in obj.data.vertices:
        p = mw @ v.co
        if z0 < p.z < z1:
            u = (p.z - z0) / (z1 - z0)
            k = min(1.0, math.sin(math.pi * u) * 1.6)  # fondu aux bords, plateau au milieu
            p.x *= 1 - (1 - fx) * k
            p.y = 0.01 + (p.y - 0.01) * (1 - (1 - fy) * k)
            v.co = mwi @ p


slim(SURF)
slim(JOINTS)


def shrink_joint(obj, bone, f):
    """Rapetisse la boule d'articulation de `bone` (sommets dont c'est l'os dominant) vers son centre."""
    gi = obj.vertex_groups[PRE + bone].index
    vs = [v for v in obj.data.vertices if v.groups and max(v.groups, key=lambda g: g.weight).group == gi]
    c = sum((v.co for v in vs), Vector()) / len(vs)
    for v in vs:
        v.co = c + (v.co - c) * f


# La grosse boule du bassin du X Bot fait un ventre rond : on la réduit, la surface du bassin prend le relais
shrink_joint(JOINTS, 'Hips', 0.80)


# ------------------------------------------------------------------ coques découpées dans le corps
def axis_point(a, b, t):
    return a + (b - a) * t


def finish(obj, smooth_angle=50):
    """Parente à l'armature, ajoute le modificateur Armature, lisse avec arêtes vives au-delà de l'angle."""
    obj.parent = ARM
    obj.matrix_parent_inverse = Matrix()
    obj.matrix_world = MW
    mod = obj.modifiers.new('Armature', 'ARMATURE')
    mod.object = ARM
    obj.data.shade_smooth()
    obj.data.set_sharp_from_angle(angle=math.radians(smooth_angle))
    return obj


def shell(name, bones, material, planes=(), src=None, offset=0.010, thick=0.006):
    """Copie le segment du corps (faces dont l'os dominant est dans `bones`), le coupe net par les plans
    (point, normale : on garde le côté où pointe la normale), le pousse de `offset` m le long des normales
    et l'épaissit de `thick` vers l'intérieur. Les poids de skinning sont conservés (et interpolés aux coupes)."""
    src = src or SURF
    bm = bmesh.new()
    bm.from_mesh(src.data)
    bm.transform(src.matrix_world)
    bm.normal_update()
    dl = bm.verts.layers.deform.active
    names = {g.index: g.name.replace(PRE, '') for g in src.vertex_groups}

    def dom(f):
        tot = {}
        for v in f.verts:
            for gi, w in v[dl].items():
                tot[gi] = tot.get(gi, 0) + w
        return names[max(tot, key=tot.get)] if tot else ''

    bmesh.ops.delete(bm, geom=[f for f in bm.faces if dom(f) not in bones], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    for co, no in planes:
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-5, plane_co=co, plane_no=no, clear_inner=True)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    if not bm.faces:
        raise RuntimeError(f'coque vide : {name}')
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * offset
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=thick)
    bm.transform(MW.inverted())
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    for g in src.vertex_groups:
        obj.vertex_groups.new(name=g.name)
    # les coques héritent de la densité du corps : on en garde ~45 %, invisible à cette échelle
    dec = obj.modifiers.new('Decimate', 'DECIMATE')
    dec.ratio = DECIMATE
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
        bpy.ops.object.modifier_apply(modifier=dec.name)
    return finish(obj)


SIDES = (('Left', 1), ('Right', -1))
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
O = Vector((0, 0, 0))


def between(a, b, t0, t1):
    """Plans qui gardent la tranche t0..t1 du segment a->b."""
    d = (b - a).normalized()
    return [(axis_point(a, b, t0), d), (axis_point(a, b, t1), -d)]


# Plastron : tout le haut du torse (devant, côtés, dos), coupé net en bas et au col
shell('volt_chest', {'Spine2', 'Spine1', 'LeftShoulder', 'RightShoulder'}, M_WHITE,
      planes=[(Vector((0, 0, 1.338)), Z), (Vector((0, 0, 1.505)), -Z)], offset=0.012, thick=0.008)
# Abdomen : panneaux bleus sur les flancs, le ventre reste noir
for s in (1, -1):
    shell(f'volt_flank_{s}', {'Spine', 'Spine1'}, M_BLUE, planes=[(Vector((s * 0.075, 0, 0)), s * X)],
          offset=0.008, thick=0.005)

for side, s in SIDES:
    sh, el, wr = joint(side + 'Arm'), joint(side + 'ForeArm'), joint(side + 'Hand')
    hip, kn, an = joint(side + 'UpLeg'), joint(side + 'Leg'), joint(side + 'Foot')
    # Épaule : la boule d'articulation devient une calotte blanche ronde
    shell(f'volt_shoulder_{side}', {side + 'Arm', side + 'Shoulder'}, M_WHITE, src=JOINTS, offset=0.012, thick=0.008)
    # Bras : manche blanche sur tout le segment
    shell(f'volt_upperarm_{side}', {side + 'Arm'}, M_WHITE, planes=between(sh, el, 0.10, 0.92),
          offset=0.008, thick=0.006)
    # Avant-bras : gantelet blanc, manchette bleue au poignet
    shell(f'volt_forearm_{side}', {side + 'ForeArm'}, M_WHITE, planes=between(el, wr, 0.12, 0.76),
          offset=0.010, thick=0.007)
    shell(f'volt_cuff_{side}', {side + 'ForeArm'}, M_BLUE, planes=between(el, wr, 0.78, 0.98),
          offset=0.013, thick=0.007)
    # Bassin : panneau bleu sur le côté
    shell(f'volt_hip_{side}', {'Hips'}, M_BLUE, planes=[(Vector((s * 0.115, 0, 0)), s * X)],
          offset=0.009, thick=0.006)
    # Cuisse : plaque blanche devant, bande bleue à l'extérieur
    shell(f'volt_thigh_{side}', {side + 'UpLeg'}, M_WHITE,
          planes=between(hip, kn, 0.18, 0.86) + [(Vector((0, 0.012, 0)), -Y)], offset=0.010, thick=0.007)
    shell(f'volt_thighband_{side}', {side + 'UpLeg'}, M_BLUE,
          planes=between(hip, kn, 0.06, 0.80) + [(hip + s * X * 0.062, s * X)], offset=0.015, thick=0.006)
    # Genou : la boule d'articulation, moitié avant, en blanc
    shell(f'volt_knee_{side}', {side + 'Leg'}, M_WHITE, src=JOINTS,
          planes=[(kn + Vector((0, 0.01, 0)), -Y)], offset=0.012, thick=0.008)
    # Tibia : protège-tibia blanc devant, bande bleue à l'intérieur
    shell(f'volt_shin_{side}', {side + 'Leg'}, M_WHITE,
          planes=between(kn, an, 0.14, 0.74) + [(Vector((0, 0.018, 0)), -Y)], offset=0.010, thick=0.007)
    shell(f'volt_shinband_{side}', {side + 'Leg'}, M_BLUE,
          planes=between(kn, an, 0.20, 0.70) + [(kn - s * X * 0.028, -s * X)], offset=0.014, thick=0.006)
    # Basket : tige blanche, semelle noire, talon jaune
    feet = {side + 'Foot', side + 'ToeBase', side + 'Toe_End'}
    shell(f'volt_shoe_{side}', feet | {side + 'Leg'}, M_WHITE,
          planes=[(Vector((0, 0, 0.026)), Z), (Vector((0, 0, 0.165)), -Z)], offset=0.012, thick=0.008)
    shell(f'volt_sole_{side}', feet, M_SOLE, planes=[(Vector((0, 0, 0.032)), -Z)], offset=0.015, thick=0.014)
    shell(f'volt_heel_{side}', feet | {side + 'Leg'}, M_YELLOW,
          planes=[(Vector((0, 0.035, 0)), Y), (Vector((0, 0, 0.03)), Z), (Vector((0, 0, 0.125)), -Z)],
          offset=0.018, thick=0.006)

# Pastille bleue sur chaque épaule (rigide, os Arm)
for side, s in SIDES:
    sh = joint(side + 'Arm')
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=32, radius1=0.026, radius2=0.024, depth=0.008)
    bmesh.ops.translate(bm, vec=sh + Vector((s * 0.004, 0.044, 0.052)), verts=bm.verts)
    bm.transform(MW.inverted())
    me = bpy.data.meshes.new(f'volt_badge_{side}')
    bm.to_mesh(me); bm.free()
    me.materials.append(M_BLUE)
    o = bpy.data.objects.new(me.name, me)
    bpy.context.scene.collection.objects.link(o)
    g = o.vertex_groups.new(name=PRE + side + 'Arm')
    g.add(list(range(len(me.vertices))), 1.0, 'REPLACE')
    finish(o, 35)


# ------------------------------------------------------------------ casque rigide (os Head)
HEAD = PRE + 'Head'
HC = Vector((0.0, 0.0, 1.692))      # centre du casque
HR = Vector((0.122, 0.138, 0.140))   # demi-axes x, y (profondeur), z


def rigid(name, bm, material, smooth_angle=40):
    """Mesh rigide (monde) -> objet skinné à 100 % sur Head."""
    bm.transform(MW.inverted())
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    g = obj.vertex_groups.new(name=HEAD)
    g.add(list(range(len(me.vertices))), 1.0, 'REPLACE')
    return finish(obj, smooth_angle)


def ellipsoid(scale, center, segs=40, rings=28):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    bmesh.ops.scale(bm, vec=scale, verts=bm.verts)
    bmesh.ops.translate(bm, vec=center, verts=bm.verts)
    return bm


def angles(p):
    """Azimut (0 = face avant, -Y) et élévation d'un point vu depuis le centre du casque."""
    d = Vector(((p.x - HC.x) / HR.x, (p.y - HC.y) / HR.y, (p.z - HC.z) / HR.z))
    return math.degrees(math.atan2(d.x, -d.y)), math.degrees(math.asin(max(-1, min(1, d.z / d.length))))


# Coque du casque, ouverte en bas pour le cou
bm = ellipsoid(HR, HC)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if angles(f.calc_center_median())[1] < -52], context='FACES')
rigid('volt_helmet', bm, M_WHITE, smooth_angle=80)

# Visière noire : fenêtre avant d'un ellipsoïde à peine plus grand
VR = HR * 1.035
bm = ellipsoid(VR, HC + Vector((0, -0.002, 0)), segs=64, rings=40)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if not (abs(angles(f.calc_center_median())[0]) < 58
                 and -38 < angles(f.calc_center_median())[1] < 26)], context='FACES')
bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.004)
rigid('volt_visor', bm, M_VISOR, smooth_angle=60)


def on_visor(az, el, out=0.006):
    """Point de la visière à l'azimut / élévation donnés, et sa normale."""
    a, e = math.radians(az), math.radians(el)
    d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    p = HC + Vector((d.x * VR.x, d.y * VR.y, d.z * VR.z))
    n = Vector((d.x / VR.x, d.y / VR.y, d.z / VR.z)).normalized()
    return p + n * out, n


# Yeux LED : deux arcs « ^ ^ » (demi-tores aplatis) posés sur la visière
for s in (1, -1):
    p, n = on_visor(s * 21, 2, out=0.003)
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=False, radius=1.0, segments=24)
    # demi-anneau épais : on garde le haut du cercle et on le gonfle en tube
    bm.free()
    bm = bmesh.new()
    pts = []
    for i in range(17):
        t = math.pi * i / 16
        pts.append(Vector((math.cos(t) * 0.024, 0, math.sin(t) * 0.017 - 0.004)))
    prev = None
    rings = []
    for q in pts:
        ring = []
        for k in range(8):
            a = 2 * math.pi * k / 8
            ring.append(bm.verts.new(q + Vector((0, math.sin(a) * 0.004, math.cos(a) * 0.0045))))
        rings.append(ring)
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(8):
            bm.faces.new((r0[k], r0[(k + 1) % 8], r1[(k + 1) % 8], r1[k]))
    for ring in (rings[0], rings[-1]):
        bm.faces.new(ring)
    bm.normal_update()
    rot = Vector((0, -1, 0)).rotation_difference(n).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation(p) @ rot, verts=bm.verts)
    rigid(f'volt_eye_{"L" if s > 0 else "R"}', bm, M_LED, smooth_angle=89)

# Oreillettes : disque bleu + capuchon blanc + anneau LED, de chaque côté
for s in (1, -1):
    base = HC + Vector((s * (HR.x - 0.006), 0.012, -0.004))
    rot = Vector((0, 0, 1)).rotation_difference(Vector((s, 0, 0))).to_matrix().to_4x4()
    for (r, depth, off, m, nm) in ((0.044, 0.024, 0.010, M_BLUE, 'pod'), (0.030, 0.012, 0.026, M_WHITE, 'cap'),
                                   (0.012, 0.006, 0.034, M_LED, 'led')):
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=32, radius1=r, radius2=r * 0.93, depth=depth)
        bmesh.ops.transform(bm, matrix=Matrix.Translation(base + Vector((s * off, 0, 0))) @ rot, verts=bm.verts)
        rigid(f'volt_ear_{nm}_{"L" if s > 0 else "R"}', bm, m, smooth_angle=35)

# Antenne : tige grise et boule LED, sur le haut du casque côté gauche
top = HC + Vector((0.045, 0.02, HR.z * 0.93))
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.0045, radius2=0.0035, depth=0.11)
tilt = Matrix.Rotation(math.radians(-12), 4, 'Y')
bmesh.ops.transform(bm, matrix=Matrix.Translation(top + Vector((0.008, 0, 0.05))) @ tilt, verts=bm.verts)
rigid('volt_antenna', bm, M_JOINT, smooth_angle=60)
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=12, radius=0.016)
bmesh.ops.translate(bm, vec=top + Vector((0.020, 0, 0.108)), verts=bm.verts)
rigid('volt_antenna_tip', bm, M_LED, smooth_angle=89)

# ------------------------------------------------------------------ fusion et export
# Un seul mesh skinné par matériau serait le plus léger ; on fusionne tout en un objet (une draw call par matériau).
bpy.ops.object.select_all(action='DESELECT')
parts = [o for o in bpy.data.objects if o.type == 'MESH']
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = SURF
bpy.ops.object.join()
SURF.name = SURF.data.name = 'Volt'
tris = sum(len(p.vertices) - 2 for p in SURF.data.polygons)
print(f'[volt] {len(SURF.data.vertices)} sommets, {tris} triangles, {len(SURF.data.materials)} matériaux')

if BLEND:
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_animations=False, export_skins=True,
                          export_apply=False, export_yup=True)
print('[volt] écrit', OUT)
