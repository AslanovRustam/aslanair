"""Cabin shell inside the hull: walls and ceiling with window/door openings, reveals,
bulkheads, the floor and its skirting. The cockpit door is furnishing (the cabin kit)."""
import math

from mathutils import Vector

from .clip import boundary_ring, close_t_junctions
from .door import door_outline
from .geometry import (CABIN, FLOOR_Z, L, PLINTH, X, ceiling_z, door_rect, floor_half_width, hull_half_width_at, liner_half_width_at,
                       liner_normal, shell_stations)
from .mesh import make_mesh, material, object_from_polys
from .openings import _bbox, cut_outlines, window_outlines

WALL_ROWS = 30        # rows from the floor up to the ceiling edge on each side
CEILING_COLUMNS = 12
AISLE_HALF_WIDTH = 0.25


def shell_profile(s):
    """(y, z) from the port floor edge, up the port wall, across the ceiling, down to the starboard floor edge."""
    zc = ceiling_z(s)
    port = [(liner_half_width_at(s, FLOOR_Z + (zc - FLOOR_Z) * i / WALL_ROWS), FLOOR_Z + (zc - FLOOR_Z) * i / WALL_ROWS)
            for i in range(WALL_ROWS + 1)]
    yc = port[-1][0]
    ceiling = [(yc - 2 * yc * k / CEILING_COLUMNS, zc) for k in range(1, CEILING_COLUMNS)]
    return port + ceiling + [(-y, z) for y, z in reversed(port)]


def _record(x, y, z):
    return (x, z, x, y, z, (L / 2 - x) / L, z)


def _grid_faces():
    rows = [[(X(s), y, z) for y, z in shell_profile(s)] for s in shell_stations()]
    faces = []
    for a, b in zip(rows, rows[1:]):
        for j in range(len(a) - 1):
            faces.append([_record(*a[j]), _record(*b[j]), _record(*b[j + 1]), _record(*a[j + 1])])
    return faces


def wall_corner_normal(co, face_normal):
    """The liner normal (on the face's side) for a corner of a wall face, None for any other corner."""
    s = L / 2 - co.x
    if not FLOOR_Z - 1e-6 <= co.z <= ceiling_z(s) + 1e-6 or abs(abs(co.y) - liner_half_width_at(s, co.z)) > 1e-5:
        return None
    n = Vector(liner_normal(s, co.z, 1 if co.y > 0 else -1))
    d = n.dot(face_normal)
    return None if abs(d) < 0.9 else (n if d > 0 else -n)


def _shade_walls(shell):
    """Wall corners take the liner normal; bulkhead corners their flat face normal; the rest stay smooth."""
    me = shell.data
    normals = [tuple(c.vector) for c in me.corner_normals]
    ends = (X(CABIN['front_station']), X(CABIN['aft_station']))
    for p in me.polygons:
        if any(all(abs(me.vertices[v].co.x - x) < 1e-4 for v in p.vertices) for x in ends):
            for li in p.loop_indices:
                normals[li] = tuple(p.normal)
            continue
        for li in p.loop_indices:
            n = wall_corner_normal(me.vertices[me.loops[li].vertex_index].co, p.normal)
            if n is not None:
                normals[li] = tuple(n)
    me.normals_split_custom_set(normals)


def _is_ceiling(face):
    return all(abs(r[1] - ceiling_z(L / 2 - r[0])) < 1e-9 for r in face)


def _on_liner(r, side):
    return _record(r[0], side * liner_half_width_at(L / 2 - r[0], r[1]), r[1])


def _side_wall(faces, outlines, side):
    """One side's wall with its openings cut, crack-free: T-junctions closed, then every vertex put back on the
    liner surface (clipping interpolates along chords). Returns the faces and the shell rim of each opening."""
    cut = close_t_junctions(cut_outlines(faces, {side: outlines}))
    cut = [[_on_liner(r, side) for r in face] for face in cut]
    points = [r for face in cut for r in face]
    return cut, [boundary_ring(points, outline) for outline, _ in outlines]


def _reveal(rim, side):
    """Tube from an opening's shell rim out to the hull."""
    hull = [_record(r[0], side * hull_half_width_at(L / 2 - r[0], r[1]), r[1]) for r in rim]
    n = len(rim)
    return [[rim[i], rim[(i + 1) % n], hull[(i + 1) % n], hull[i]] for i in range(n)]


def _bulkhead(s):
    return [[_record(X(s), y, z) for y, z in shell_profile(s)]]


def build_cabin():
    wall = material('CabinWall', '#ebe7de', rough=0.85, double=True)
    outlines = window_outlines()
    door = door_outline()
    outlines[1].append((door, _bbox(door)))

    grid = _grid_faces()
    polys = [f for f in grid if _is_ceiling(f)]
    for side in (1, -1):
        side_faces = [f for f in grid if not _is_ceiling(f) and (sum(r[3] for r in f) > 0) == (side > 0)]
        faces, rims = _side_wall(side_faces, outlines[side], side)
        polys += faces
        for rim in rims:
            polys += _reveal(rim, side)
    polys += _bulkhead(CABIN['front_station']) + _bulkhead(CABIN['aft_station'])
    shell = object_from_polys('CabinShell', polys, wall)
    shell.data.uv_layers.remove(shell.data.uv_layers['UVMap'])   # untextured: no UVs to ship
    _shade_walls(shell)

    _floor()
    _plinth()
    return shell


def _floor():
    """Carpet with an aisle runner (materials Carpet / AisleCarpet); the site maps its patterns on by position."""
    carpet = material('Carpet', '#7d8590', rough=0.95)
    aisle = material('AisleCarpet', '#5e6a7a', rough=0.95)
    verts, faces, aisle_faces = [], [], []
    stations = shell_stations()
    for s in stations:
        w = floor_half_width(s)
        verts += [(X(s), y, FLOOR_Z) for y in (-w, -AISLE_HALF_WIDTH, AISLE_HALF_WIDTH, w)]
    for i in range(len(stations) - 1):
        for k in range(3):
            a, b = 4 * i + k, 4 * (i + 1) + k
            faces.append((a, a + 1, b + 1, b))
            if k == 1:
                aisle_faces.append(len(faces) - 1)
    floor = make_mesh('CabinFloor', verts, faces, None, carpet, recalc=False, sharp=None)
    floor.data.materials.append(aisle)
    for i in aisle_faces:
        floor.data.polygons[i].material_index = 1
    up = sum(p.normal.z for p in floor.data.polygons)
    if up < 0:
        for p in floor.data.polygons:
            p.flip()
    return floor


def _plinth():
    """CabinPlinth: a dark skirting band along both walls, just inside the liner, with a lip back to the wall;
    it stops at door 1L, whose sill sits lower than the band's top."""
    s0, s1, _, _ = door_rect()
    h, inset = PLINTH['height'], PLINTH['inset']
    verts, faces = [], []
    for side in (1, -1):
        stations = shell_stations()
        for a, b in zip(stations, stations[1:]):
            if side == 1 and b > s0 and a < s1:
                continue
            base = len(verts)
            for s in (a, b):
                verts += [(X(s), side * (liner_half_width_at(s, FLOOR_Z) - inset), FLOOR_Z),
                          (X(s), side * (liner_half_width_at(s, FLOOR_Z + h) - inset), FLOOR_Z + h),
                          (X(s), side * liner_half_width_at(s, FLOOR_Z + h), FLOOR_Z + h)]
            quads = [(base, base + 1, base + 4, base + 3), (base + 1, base + 2, base + 5, base + 4)]   # face, lip
            faces += quads if side == 1 else [q[::-1] for q in quads]                                  # into the cabin, up
    return make_mesh('CabinPlinth', verts, faces, None, material('CabinPlinth', '#2e333c', rough=0.6), recalc=False, sharp=50)
