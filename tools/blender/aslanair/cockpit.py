"""Cockpit glazing as geometry on the nose skin: dark glass panes in a dark frame, both sides.

Painted into the livery it pixelates (≈1.8 cm per pixel once the texture is capped at 2048 px).
Panes are built on a grid in (station, arc-from-crown) space, clipped to the outline, then put on the skin.
"""
from .clip import close_t_junctions, intersect_convex, offset_convex, subtract_convex
from .geometry import COCKPIT_PANES, hull_normal, hull_point
from .mesh import material, object_from_polys

GLAZING = {'frame': 0.03, 'standoff': 0.003, 'cell': 0.06}


def _cells(outline, cell):
    s0, s1 = min(p[0] for p in outline), max(p[0] for p in outline)
    a0, a1 = min(p[1] for p in outline), max(p[1] for p in outline)
    ns, na = int((s1 - s0) / cell) + 1, int((a1 - a0) / cell) + 1
    return [[(s0 + i * cell, a0 + j * cell), (s0 + (i + 1) * cell, a0 + j * cell),
             (s0 + (i + 1) * cell, a0 + (j + 1) * cell), (s0 + i * cell, a0 + (j + 1) * cell)]
            for i in range(ns) for j in range(na)]


def _on_skin(polys, side):
    """(s, a) polygons → records just off the skin on one side, wound to face outwards."""
    off = GLAZING['standoff']
    out = []
    for poly in polys:
        recs = []
        for s, a, *_ in poly:
            p, n = hull_point(s, a, side), hull_normal(s, a, side)
            recs.append((s, a, *(pi + off * ni for pi, ni in zip(p, n)), s, a))
        out.append(recs if side > 0 else recs[::-1])
    return out


def build_cockpit_glazing():
    glass, frame = [], []
    for pane in COCKPIT_PANES:
        ring = offset_convex(pane, GLAZING['frame'])
        cells = _cells(ring, GLAZING['cell'])
        g = [p for c in cells if (p := intersect_convex(c, pane))]
        f = close_t_junctions([q for c in cells if (p := intersect_convex(c, ring)) for q in subtract_convex(p, pane)])
        for side in (1, -1):
            glass += _on_skin(g, side)
            frame += _on_skin(f, side)
    parts = (object_from_polys('CockpitGlass', glass, material('CockpitGlass', '#0b0f17', rough=0.06, coat=0.8, double=True)),
             object_from_polys('CockpitFrame', frame, material('CockpitFrame', '#101319', rough=0.4, double=True)))
    for ob in parts:
        ob['decal'] = True
    return parts
