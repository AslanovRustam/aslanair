"""bpy helpers: meshes, materials, images."""
import math
import os

import bmesh
import bpy
import numpy as np
from mathutils import Vector

from . import context as ctx

# ---------------------------------------------------------------- helpers
def hex2lin(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)
def hex2srgb(h):
    h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])

def make_mesh(name, verts, faces, uvs=None, mat=None, recalc=True, sharp=35):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    if uvs is not None:
        uvl = me.uv_layers.new(name='UVMap')
        uvl.data.foreach_set('uv', np.array([c for f in uvs for uv in f for c in uv], dtype=np.float32))
    if recalc:
        bm = bmesh.new(); bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me); bm.free()
    me.shade_smooth()
    if sharp: me.set_sharp_from_angle(angle=math.radians(sharp))
    if mat: me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ctx.PARTS.append(ob)
    return ob

def pbsdf(m):
    return next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
def setin(node, key, val):
    if key in node.inputs: node.inputs[key].default_value = val

def material(name, color='#ffffff', rough=0.4, metal=0.0, coat=0.0, image=None, double=False, rough_image=None, emit=0.0):
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except Exception: pass
    b = pbsdf(m)
    setin(b, 'Base Color', (*hex2lin(color), 1.0))
    setin(b, 'Roughness', rough); setin(b, 'Metallic', metal)
    setin(b, 'Coat Weight', coat); setin(b, 'Coat Roughness', 0.05)
    if image is not None:
        t = m.node_tree.nodes.new('ShaderNodeTexImage'); t.image = image
        m.node_tree.links.new(t.outputs['Color'], b.inputs['Base Color'])
    if rough_image is not None:
        rough_image.colorspace_settings.name = 'Non-Color'
        t = m.node_tree.nodes.new('ShaderNodeTexImage'); t.image = rough_image
        m.node_tree.links.new(t.outputs['Color'], b.inputs['Roughness'])
    if emit:
        setin(b, 'Emission Color', (*hex2lin(color), 1.0)); setin(b, 'Emission Strength', emit)
    m.use_backface_culling = not double
    return m

def image_from(name, rgb):
    h, w, _ = rgb.shape
    img = bpy.data.images.new(name, w, h, alpha=False)
    px = np.concatenate([np.clip(rgb, 0, 1), np.ones((h, w, 1))], axis=2).astype(np.float32)
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw = os.path.join(ctx.OUT, name + '.png'); img.file_format = 'PNG'; img.save()
    return img

def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
