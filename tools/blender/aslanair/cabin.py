"""Cabin shell inside the hull: walls and ceiling with window/door openings, reveals,
bulkheads (with a cockpit door) and the floor."""
import math

from .door import door_outline
from .geometry import CABIN, FLOOR_Z, L, X, ceiling_z, hull_half_width_at, liner_half_width_at, window_centres
from .mesh import make_mesh, material, object_from_polys
from .openings import _bbox, cut_outlines, window_outline, window_outlines

STEP_S = 0.25         # station spacing of the shell grid
WALL_ROWS = 30        # rows from the floor up to the ceiling edge on each side
CEILING_COLUMNS = 12
AISLE_HALF_WIDTH = 0.25
COCKPIT_DOOR = {'width': 0.8, 'height': 1.9}


def _stations():
    out, s = [], CABIN['front_station']
    while s < CABIN['aft_station'] - 1e-9:
        out.append(s)
        s += STEP_S
    out.append(CABIN['aft_station'])
    return out


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
    rows = [[(X(s), y, z) for y, z in shell_profile(s)] for s in _stations()]
    faces = []
    for a, b in zip(rows, rows[1:]):
        for j in range(len(a) - 1):
            faces.append([_record(*a[j]), _record(*b[j]), _record(*b[j + 1]), _record(*a[j + 1])])
    return faces


def _reveal(outline, side):
    """Tube from the shell opening out to the hull opening along one outline."""
    hull = [(x, side * hull_half_width_at(L / 2 - x, z), z) for x, z in outline]
    shell = [(x, side * liner_half_width_at(L / 2 - x, z), z) for x, z in outline]
    n = len(outline)
    return [[_record(*shell[i]), _record(*shell[(i + 1) % n]), _record(*hull[(i + 1) % n]), _record(*hull[i])] for i in range(n)]


def _bulkhead(s):
    return [[_record(X(s), y, z) for y, z in shell_profile(s)]]


def build_cabin():
    wall = material('CabinWall', '#ebe7de', rough=0.85, double=True)
    outlines = window_outlines()
    door = door_outline()
    outlines[1].append((door, _bbox(door)))

    walls = [f for f in _grid_faces() if all(abs(r[3]) > 0.6 for r in f)]
    ceiling = [f for f in _grid_faces() if not all(abs(r[3]) > 0.6 for r in f)]
    polys = cut_outlines(walls, outlines) + ceiling
    for s, z, side in window_centres():
        polys += _reveal(window_outline(s, z), side)
    polys += _reveal(door, 1)
    polys += _bulkhead(CABIN['front_station']) + _bulkhead(CABIN['aft_station'])
    shell = object_from_polys('CabinShell', polys, wall)

    # cockpit door on the front bulkhead, just aft of it
    x = X(CABIN['front_station']) - 0.01
    hw, top = COCKPIT_DOOR['width'] / 2, FLOOR_Z + COCKPIT_DOOR['height']
    make_mesh('CockpitDoor', [(x, -hw, FLOOR_Z), (x, hw, FLOOR_Z), (x, hw, top), (x, -hw, top)], [(0, 1, 2, 3)], None,
              material('CockpitDoor', '#cfcac0', rough=0.6, double=True), recalc=False, sharp=None)
    _floor()
    return shell


def _floor():
    carpet = material('Carpet', '#7d8590', rough=0.95)
    aisle = material('AisleCarpet', '#5e6a7a', rough=0.95)
    verts, faces, aisle_faces = [], [], []
    stations = _stations()
    for s in stations:
        w = liner_half_width_at(s, FLOOR_Z)
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
