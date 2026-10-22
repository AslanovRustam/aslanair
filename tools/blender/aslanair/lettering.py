"""'AslanAir' on both sides of the upper fuselage, reading left-to-right from each side."""
import bmesh
import bpy

from . import context as ctx
from .geometry import L, X, hull_half_width_at
from .livery import NAVY
from .mesh import material

LETTERING = {
    'text': 'AslanAir',
    'station': 12.5,   # centre of the word
    'z': 1.2,          # above the window line, below the crown
    'size': 0.85,      # Blender text size; cap height ≈ 0.6 m with the built-in font
    'offset': 0.01,    # standoff from the skin
    'max_edge': 0.05,  # longer edges sag under the curved hull, so they are split
}


def _text_mesh(name):
    """Flat text mesh in local XY (reading along +X), finely triangulated so it can follow the hull."""
    curve = bpy.data.curves.new(name + 'Text', 'FONT')
    curve.body = LETTERING['text']
    curve.size = LETTERING['size']
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    curve.resolution_u = 3
    curve.offset = 0.008       # a touch bolder; larger offsets self-intersect the glyph fill
    curve.space_character = 1.05
    tmp = bpy.data.objects.new(name + 'Tmp', curve)
    bpy.context.scene.collection.objects.link(tmp)
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(tmp)
    bpy.data.curves.remove(curve)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    for _ in range(8):
        long_edges = [e for e in bm.edges if e.calc_length() > LETTERING['max_edge']]
        if not long_edges:
            break
        bmesh.ops.subdivide_edges(bm, edges=long_edges, cuts=1)
        bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.name = name
    return me


def make_lettering(side, mat):
    """side +1 = port (+Y), -1 = starboard. Reading direction is −X on port, +X on starboard."""
    name = 'Lettering_L' if side > 0 else 'Lettering_R'
    me = _text_mesh(name)
    local_x = [v.co.x for v in me.vertices]
    first = min(range(len(local_x)), key=local_x.__getitem__)
    last = max(range(len(local_x)), key=local_x.__getitem__)
    for v in me.vertices:
        x = X(LETTERING['station']) - side * v.co.x
        z = LETTERING['z'] + v.co.y
        v.co = (x, side * (hull_half_width_at(L / 2 - x, z) + LETTERING['offset']), z)
    me.update()
    if sum(p.normal.y for p in me.polygons) * side < 0:   # face outwards
        for p in me.polygons:
            p.flip()
        me.update()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    ob['first_glyph_vertex'] = first
    ob['last_glyph_vertex'] = last
    bpy.context.scene.collection.objects.link(ob)
    ctx.PARTS.append(ob)
    return ob


def build_lettering():
    mat = material('Lettering', NAVY, rough=0.32, coat=0.6, double=True)
    return [make_lettering(side, mat) for side in (1, -1)]
