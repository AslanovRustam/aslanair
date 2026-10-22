"""Cabin window openings in the hull, the glass panes, and the outlines the cabin shell reuses."""
import bpy

from .clip import subtract_convex
from .geometry import L, WINDOW, X, hull_half_width_at, window_centres
from .mesh import face_records, make_mesh, material, merge_into, mesh_from_polys, pbsdf, rounded_rect_xz, setin, split_faces

GLASS_INSET = 0.03   # panes sit this far inside the hull surface


def window_outline(s, z):
    """Window outline in Blender (X, Z), counter-clockwise."""
    w, h, r = WINDOW['w'], WINDOW['h'], WINDOW['r']
    return rounded_rect_xz(X(s) - w / 2, X(s) + w / 2, z - h / 2, z + h / 2, r)


def _bbox(points):
    xs = [p[0] for p in points]
    zs = [p[1] for p in points]
    return min(xs), max(xs), min(zs), max(zs)


def window_outlines():
    """{side: [(outline, bbox)]} for both sides."""
    out = {1: [], -1: []}
    for s, z, side in window_centres():
        o = window_outline(s, z)
        out[side].append((o, _bbox(o)))
    return out


def cut_outlines(faces, outlines_by_side):
    """Subtracts every overlapping outline (same side) from each face record list."""
    polys = []
    for f in faces:
        side = 1 if sum(r[3] for r in f) > 0 else -1
        fx0, fx1, fz0, fz1 = _bbox(f)
        pieces = [f]
        for outline, (ox0, ox1, oz0, oz1) in outlines_by_side.get(side, []):
            if ox1 < fx0 or ox0 > fx1 or oz1 < fz0 or oz0 > fz1:
                continue
            pieces = [q for p in pieces for q in subtract_convex(p, outline)]
            if not pieces:
                break
        polys.extend(pieces)
    return polys


def _window_band(v):
    s = L / 2 - v.x
    return abs(v.y) > 0.5 and 0.2 < v.z < 1.05 and WINDOW['first'] - 0.6 < s < WINDOW['last'] + 0.3


def cut_hull_windows(fuselage):
    region = split_faces(fuselage, _window_band, 'WindowBand')
    mesh_from_polys(region.data, cut_outlines(face_records(region.data), window_outlines()))
    merge_into(fuselage, region)


def make_window_glass():
    verts, faces = [], []
    for s, z, side in window_centres():
        y = side * (hull_half_width_at(s, z) - GLASS_INSET)
        outline = window_outline(s, z)
        base = len(verts)
        verts += [(x, y, zz) for x, zz in outline]
        faces.append(tuple(range(base, base + len(outline))))
    mat = material('WindowGlass', '#9fb3c8', rough=0.05, double=True)
    setin(pbsdf(mat), 'Alpha', 0.25)
    for attr, value in (('surface_render_method', 'BLENDED'), ('blend_method', 'BLEND')):
        try:
            setattr(mat, attr, value)
        except (AttributeError, TypeError):
            pass
    return make_mesh('WindowGlass', verts, faces, None, mat, recalc=False, sharp=None)
