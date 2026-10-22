"""Exact polygon clipping against a convex outline (pure Python, no bpy).

Vertices are tuples (x, z, *payload). Clipping happens in the (x, z) projection; the payload
(3D position, UV, …) is interpolated linearly along the clipped edges. Outlines are lists of
(x, z) in counter-clockwise order.
"""
import math


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


def _on_segment(a, b, p, eps):
    """Parameter t of p along a→b when p lies on the open segment (within eps), else None."""
    dx, dz = b[0] - a[0], b[1] - a[1]
    length = (dx * dx + dz * dz) ** 0.5
    if length < eps:
        return None
    t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (length * length)
    if t * length <= eps or (1 - t) * length <= eps:
        return None
    return t if abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / length < eps else None


def close_t_junctions(polys, eps=1e-9, cell=0.25):
    """Inserts into every edge the vertices of other polygons lying on it, so neighbours share every
    vertex along a common edge. Sequential subtraction leaves such T-junctions, which rasterise as cracks."""
    key = lambda p: (round(p[0], 9), round(p[1], 9))
    grid, seen = {}, set()
    for poly in polys:
        for p in poly:
            if key(p) not in seen:
                seen.add(key(p))
                grid.setdefault((int(p[0] // cell), int(p[1] // cell)), []).append(p)
    out = []
    for poly in polys:
        closed = []
        for i in range(len(poly)):
            a, b = poly[i], poly[(i + 1) % len(poly)]
            closed.append(a)
            on_edge = {}
            for cx in range(int((min(a[0], b[0]) - eps) // cell), int((max(a[0], b[0]) + eps) // cell) + 1):
                for cz in range(int((min(a[1], b[1]) - eps) // cell), int((max(a[1], b[1]) + eps) // cell) + 1):
                    for p in grid.get((cx, cz), ()):
                        t = _on_segment(a, b, p, eps)
                        if t is not None:
                            on_edge[key(p)] = (t, p)
            closed.extend(p for _, p in sorted(on_edge.values()))
        out.append(closed)
    return out


def boundary_ring(points, outline, eps=1e-9):
    """The points lying on the outline's rim, once each, in the outline's (counter-clockwise) order from its first vertex."""
    edges = _edges(outline)
    lengths = [((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5 for a, b in edges]
    total = sum(lengths)
    x0, x1 = min(p[0] for p in outline) - eps, max(p[0] for p in outline) + eps
    z0, z1 = min(p[1] for p in outline) - eps, max(p[1] for p in outline) + eps
    ring = {}
    for p in points:
        if not (x0 <= p[0] <= x1 and z0 <= p[1] <= z1):
            continue
        start = 0.0
        for (a, b), length in zip(edges, lengths):
            if abs(p[0] - a[0]) <= eps and abs(p[1] - a[1]) <= eps:
                ring.setdefault((round(p[0], 9), round(p[1], 9)), (start, p))
                break
            t = _on_segment(a, b, p, eps)
            if t is not None:
                ring.setdefault((round(p[0], 9), round(p[1], 9)), ((start + t * length) % total, p))
                break
            start += length
    return [p for _, p in sorted(ring.values(), key=lambda e: e[0])]


def offset_convex(poly, d, seg=6):
    """The convex polygon grown by d with rounded corners (seg steps per quarter turn), counter-clockwise, (x, z) only."""
    steps = 4 * seg
    pts = sorted({(p[0] + d * math.cos(2 * math.pi * k / steps), p[1] + d * math.sin(2 * math.pi * k / steps))
                  for p in poly for k in range(steps)})

    def chain(points):
        out = []
        for p in points:
            while len(out) >= 2 and _side(out[-2], out[-1], p) <= 0:
                out.pop()
            out.append(p)
        return out[:-1]
    return chain(pts) + chain(pts[::-1])
