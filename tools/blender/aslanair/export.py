"""GLB export."""
import os

import bpy

from . import context as ctx


def export_glb(root):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in ctx.PARTS + [root]: ob.select_set(True)
    glb = os.path.join(ctx.OUT, 'airliner.glb')
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_apply=True, export_yup=True)
    ctx.log('exported', glb, f'{os.path.getsize(glb) / 1e6:.1f} MB')
    return glb
