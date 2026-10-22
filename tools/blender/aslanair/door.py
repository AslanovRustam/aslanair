"""Door 1L: a doorway cut into the hull and a hinged panel made from the same skin.

Both are exact polygon clips of the hull faces around the door (see clip.py), done in the
XZ projection, which is single-valued on the port side of the hull.
"""
import bpy
from mathutils import Matrix, Vector

from . import context as ctx
from .clip import intersect_convex, subtract_convex
from .geometry import DOOR_1L, L, X, door_hinge, door_rect
from .mesh import face_records, material, merge_into, mesh_from_polys, rounded_rect_xz, split_faces

PANEL_GAP = 0.012     # visible seam between panel and frame
PANEL_THICKNESS = 0.06


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
    panel.data.shade_smooth()


def make_door_1l(fuselage):
    """Cuts the doorway out of `fuselage` and returns the Door1L panel (origin on the hinge)."""
    region = split_faces(fuselage, _door_region, 'DoorRegion')
    faces = list(face_records(region.data))

    panel = bpy.data.objects.new('Door1L', region.data.copy())
    bpy.context.scene.collection.objects.link(panel)
    small = door_outline(PANEL_GAP)
    mesh_from_polys(panel.data, [p for f in faces if (p := intersect_convex(f, small))])

    full = door_outline()
    mesh_from_polys(region.data, [piece for f in faces for piece in subtract_convex(f, full)])
    merge_into(fuselage, region)

    _thicken(panel, material('DoorInner', '#d9d6cf', rough=0.7))

    # origin on the hinge: rotating the object's Z (three.js Y) swings the panel
    hinge = Vector(door_hinge())
    panel.data.transform(Matrix.Translation(-hinge))
    panel.location = hinge
    ctx.PARTS.append(panel)
    ctx.log('door 1L: hinge', tuple(round(c, 4) for c in hinge))
    return panel
