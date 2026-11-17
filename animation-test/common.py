import bpy
def load(path="chicken.fbx"):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=path)
    return [o for o in bpy.data.objects if o.type=='ARMATURE'][0]
JOINTS=["Hips","Spine","Spine2","Neck","Head","HeadTop_End","LeftShoulder","LeftArm","LeftForeArm","LeftHand","LeftHandMiddle1","RightShoulder","RightArm","RightForeArm","RightHand","RightHandMiddle1","LeftUpLeg","LeftLeg","LeftFoot","LeftToeBase","RightUpLeg","RightLeg","RightFoot","RightToeBase"]
def dump(arm, f0, f1, step=1):
    import numpy as np
    sc=bpy.context.scene; out=[]
    for f in range(f0,f1+1,step):
        sc.frame_set(f); fr=[]
        for j in JOINTS:
            pb=arm.pose.bones["mixamorig:"+j]
            fr.append(list(arm.matrix_world @ pb.head))
        out.append(fr)
    return np.array(out)
