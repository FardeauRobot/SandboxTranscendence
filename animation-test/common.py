"""Outils communs : chargement du FBX Mixamo et relevé des positions des articulations (pour comparer deux danses)."""
import bpy

# Articulations relevées par dump(), noms Mixamo sans le préfixe 'mixamorig:'.
JOINTS = ["Hips", "Spine", "Spine2", "Neck", "Head", "HeadTop_End",
          "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand", "LeftHandMiddle1",
          "RightShoulder", "RightArm", "RightForeArm", "RightHand", "RightHandMiddle1",
          "LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase", "RightUpLeg", "RightLeg", "RightFoot", "RightToeBase"]


def load(path="chicken.fbx"):
    """Vide la scène, importe le FBX et renvoie son armature."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=path)
    return [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]


def dump(arm, f0, f1, step=1):
    """Positions monde de la tête de chaque os de JOINTS, images f0..f1 : tableau (images, JOINTS, 3)."""
    import numpy as np
    sc = bpy.context.scene
    out = []
    for f in range(f0, f1 + 1, step):
        sc.frame_set(f)
        out.append([list(arm.matrix_world @ arm.pose.bones["mixamorig:" + j].head) for j in JOINTS])
    return np.array(out)
