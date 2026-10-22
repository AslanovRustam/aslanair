"""Exact polygon clipping against a convex outline (pure Python, no bpy).

Vertices are tuples (x, z, *payload). Clipping happens in the (x, z) projection; the payload
(3D position, UV, …) is interpolated linearly along the clipped edges. Outlines are lists of
(x, z) in counter-clockwise order.
"""


def area(poly):
    s = 0.0
    for i in range(len(poly)):
        x0, z0 = poly[i][0], poly[i][1]
        x1, z1 = poly[(i + 1) % len(poly)][0], poly[(i + 1) % len(poly)][1]
        s += x0 * z1 - x1 * z0
    return abs(s) / 2


def _side(a, b, p):
    return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])


def _lerp(p, q, t):
    return tuple(pi + (qi - pi) * t for pi, qi in zip(p, q))


def clip_halfplane(poly, a, b, keep_inside=True):
    """Keeps the part of poly left of a→b (inside a CCW outline), or right of it."""
    out = []
    n = len(poly)
    for i in range(n):
        cur, nxt = poly[i], poly[(i + 1) % n]
        dc, dn = _side(a, b, cur), _side(a, b, nxt)
        if not keep_inside:
            dc, dn = -dc, -dn
        if dc >= 0:
            out.append(cur)
        if (dc >= 0) != (dn >= 0):
            out.append(_lerp(cur, nxt, dc / (dc - dn)))
    return out if len(out) >= 3 and area(out) > 1e-12 else []


def _edges(outline):
    return [(outline[i], outline[(i + 1) % len(outline)]) for i in range(len(outline))]


def intersect_convex(poly, outline):
    for a, b in _edges(outline):
        poly = clip_halfplane(poly, a, b, True)
        if not poly:
            return []
    return poly


def subtract_convex(poly, outline):
    """poly minus the convex outline, as disjoint convex pieces (poly assumed convex)."""
    pieces, remaining = [], poly
    for a, b in _edges(outline):
        outside = clip_halfplane(remaining, a, b, False)
        if outside:
            pieces.append(outside)
        remaining = clip_halfplane(remaining, a, b, True)
        if not remaining:
            break
    return pieces
