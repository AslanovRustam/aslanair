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

def split_faces(obj, inside, name):
    """Moves faces whose centre satisfies inside(Vector) into a new open-surface object."""
    patch_me = obj.data.copy()
    for me, keep_inside in ((patch_me, True), (obj.data, False)):
        bm = bmesh.new(); bm.from_mesh(me)
        doomed = [f for f in bm.faces if inside(f.calc_center_median()) != keep_inside]
        bmesh.ops.delete(bm, geom=doomed, context='FACES')
        bm.to_mesh(me); bm.free()
    patch = bpy.data.objects.new(name, patch_me)
    bpy.context.scene.collection.objects.link(patch)
    return patch


def merge_into(obj, patch):
    """Appends patch's geometry to obj, welds the shared seam, deletes patch."""
    bm = bmesh.new(); bm.from_mesh(obj.data); bm.from_mesh(patch.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(obj.data); bm.free()
    obj.data.shade_smooth()
    me = patch.data
    bpy.data.objects.remove(patch)
    bpy.data.meshes.remove(me)


def face_records(me):
    """Faces as lists of (x, z, X, Y, Z, u, v) records for clip.py (projection onto XZ)."""
    uv = me.uv_layers.active.data
    for poly in me.polygons:
        recs = []
        for li, vi in zip(poly.loop_indices, poly.vertices):
            co = me.vertices[vi].co
            recs.append((co.x, co.z, co.x, co.y, co.z, uv[li].uv.x, uv[li].uv.y))
        yield recs


def mesh_from_polys(me, polys):
    """Rebuilds me from clipped records, welding vertices that share a position."""
    verts, index, faces, uvs = [], {}, [], []
    for rec in polys:
        face, face_uv = [], []
        for r in rec:
            key = (round(r[2], 6), round(r[3], 6), round(r[4], 6))
            if key not in index:
                index[key] = len(verts)
                verts.append((r[2], r[3], r[4]))
            if face and face[-1] == index[key]:
                continue
            face.append(index[key])
            face_uv.append((r[5], r[6]))
        if len(face) > 1 and face[0] == face[-1]:
            face.pop(); face_uv.pop()
        if len(set(face)) >= 3:
            faces.append(face)
            uvs.extend(face_uv)
    materials = list(me.materials)
    me.clear_geometry()
    me.from_pydata(verts, [], faces)
    for m in materials:
        if m.name not in [x.name for x in me.materials]:
            me.materials.append(m)
    layer = me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap')
    layer.data.foreach_set('uv', np.array([c for uv in uvs for c in uv], dtype=np.float32))
    me.shade_smooth()


def rounded_rect_xz(x0, x1, z0, z1, r, seg=8):
    pts = []
    for cx, cz, a0 in ((x1 - r, z0 + r, -90), (x1 - r, z1 - r, 0), (x0 + r, z1 - r, 90), (x0 + r, z0 + r, 180)):
        for k in range(seg + 1):
            a = math.radians(a0 + 90 * k / seg)
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return pts


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
