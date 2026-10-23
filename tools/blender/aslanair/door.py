"""Door 1L: a doorway cut into the hull and a hinged panel made from the same skin.

Both are exact polygon clips of the hull faces around the door (see clip.py), done in the
XZ projection, which is single-valued on the port side of the hull.
"""
import math

import bpy
from mathutils import Matrix, Vector

from . import context as ctx
from .clip import close_t_junctions, intersect_convex, subtract_convex
from .geometry import DOOR_1L, L, X, door_hinge, door_rect, hull_half_width_at
from .mesh import face_records, material, merge_into, mesh_from_polys, object_from_polys, rounded_rect_xz, split_faces

# The closed panel fills the doorway exactly (a gap showed the panel's light rim and the dark inside); the seam is a
# fine painted line on the skin around it instead.
SEAM = 0.006
PANEL_THICKNESS = 0.06
# the door's window is geometry: painted into the 2048 px livery it pixelates right where the camera flies in
DOOR_WINDOW = {'below_top': 0.45, 'w': 0.22, 'h': 0.30, 'r': 0.08, 'frame': 0.025, 'standoff': 0.003, 'cell': 0.03}


def _door_region(v):
    s = L / 2 - v.x
    s0, s1, z0, z1 = door_rect()
    return v.y * DOOR_1L['side'] > 0.3 and s0 - 0.6 < s < s1 + 0.6 and z0 - 0.6 < v.z < z1 + 0.6


def door_outline(inset=0.0):
    """Door outline in Blender (X, Z), counter-clockwise."""
    s0, s1, z0, z1 = door_rect()
    return rounded_rect_xz(X(s1) + inset, X(s0) - inset, z0 + inset, z1 - inset, DOOR_1L['radius'] - inset)


def _thicken(panel, inner_mat):
    panel.data.materials.append(inner_mat)
    solid = panel.modifiers.new('thickness', 'SOLIDIFY')
    solid.thickness = PANEL_THICKNESS
    solid.offset = -1.0
    solid.material_offset = 1
    solid.material_offset_rim = 1
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(panel.evaluated_get(dg))
    panel.modifiers.clear()
    old = panel.data
    panel.data = me
    bpy.data.meshes.remove(old)
    _smooth_by_angle(panel.data, math.radians(30))


def _smooth_by_angle(me, angle):
    """Smooth shading across gentle edges, sharp where faces meet at more than `angle`: averaged with the rim, the
    skin's edge normals made the closed panel read as a pillow standing out of the hull."""
    me.shade_smooth()
    sharp = me.attributes.get('sharp_edge') or me.attributes.new('sharp_edge', 'BOOLEAN', 'EDGE')
    faces_of = {}
    for poly in me.polygons:
        for key in poly.edge_keys:
            faces_of.setdefault(key, []).append(poly.index)
    limit = math.cos(angle)
    for e in me.edges:
        fs = faces_of.get(e.key, [])
        sharp.data[e.index].value = len(fs) == 2 and me.polygons[fs[0]].normal.dot(me.polygons[fs[1]].normal) < limit


def _on_skin(polys, origin):
    """(x, z) records → points just off the hull skin, relative to `origin`."""
    side, off = DOOR_1L['side'], DOOR_WINDOW['standoff']
    out = []
    for poly in polys:
        out.append([(x, z, x - origin.x, side * (hull_half_width_at(L / 2 - x, z) + off) - origin.y, z - origin.z, x, z)
                    for x, z, *_ in poly])
    return out


def _door_window(panel, origin):
    """Dark pane and light frame ring on the panel's skin, children of the panel so they ride with it."""
    w, h, r, f, cell = (DOOR_WINDOW[k] for k in ('w', 'h', 'r', 'frame', 'cell'))
    xc, zc = X(DOOR_1L['station']), door_rect()[3] - DOOR_WINDOW['below_top']
    pane = rounded_rect_xz(xc - w / 2, xc + w / 2, zc - h / 2, zc + h / 2, r)
    ring = rounded_rect_xz(xc - w / 2 - f, xc + w / 2 + f, zc - h / 2 - f, zc + h / 2 + f, r + f)
    n = int((w + 2 * f) / cell) + 2, int((h + 2 * f) / cell) + 2
    x0, z0 = xc - n[0] * cell / 2, zc - n[1] * cell / 2
    cells = [[(x0 + i * cell, z0 + j * cell), (x0 + (i + 1) * cell, z0 + j * cell),
              (x0 + (i + 1) * cell, z0 + (j + 1) * cell), (x0 + i * cell, z0 + (j + 1) * cell)]
             for i in range(n[0]) for j in range(n[1])]
    glass = [p for c in cells if (p := intersect_convex(c, pane))]
    frame = close_t_junctions([q for c in cells if (p := intersect_convex(c, ring)) for q in subtract_convex(p, pane)])
    parts = (object_from_polys('Door1LWindow', _on_skin(glass, origin),
                               material('DoorWindowGlass', '#0b0f17', rough=0.08, coat=0.6, double=True)),
             object_from_polys('Door1LWindowFrame', _on_skin(frame, origin),
                               material('DoorWindowFrame', '#c9ccd0', rough=0.45, double=True)))
    for ob in parts:
        ob.parent = panel
        ob['decal'] = True


def _door_seam(faces):
    """A dark ring just outside the doorway, a decal on the hull: reads as the door's seam, opened or closed."""
    outer, hole = door_outline(-SEAM), door_outline()
    ring = close_t_junctions([q for f in faces if (p := intersect_convex(f, outer)) for q in subtract_convex(p, hole)])
    seam = object_from_polys('Door1LSeam', _on_skin(ring, Vector((0.0, 0.0, 0.0))), material('DoorSeam', '#1d2433', rough=0.6, double=True))
    seam['decal'] = True


def make_door_1l(fuselage):
    """Cuts the doorway out of `fuselage` and returns the Door1L panel (origin on the hinge)."""
    region = split_faces(fuselage, _door_region, 'DoorRegion')
    faces = list(face_records(region.data))

    panel = bpy.data.objects.new('Door1L', region.data.copy())
    bpy.context.scene.collection.objects.link(panel)
    full = door_outline()
    mesh_from_polys(panel.data, [p for f in faces if (p := intersect_convex(f, full))])
    mesh_from_polys(region.data, [piece for f in faces for piece in subtract_convex(f, full)])
    merge_into(fuselage, region)
    _door_seam(faces)

    _thicken(panel, material('DoorInner', '#d9d6cf', rough=0.7))

    # origin on the hinge: rotating the object's Z (three.js Y) swings the panel
    hinge = Vector(door_hinge())
    panel.data.transform(Matrix.Translation(-hinge))
    panel.location = hinge
    ctx.PARTS.append(panel)
    _door_window(panel, hinge)
    ctx.log('door 1L: hinge', tuple(round(c, 4) for c in hinge))
    return panel
