"""Cabin kit: furnishing geometry the site instances (seats now; bins, galley, curtain, signs later).

Geometry only — the site assigns its own materials. Seat parts are authored with the origin on the
floor under the seat centre, facing +X (the nose); Blender Y = port, so three.js z = -Y.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

from . import context as ctx
from .geometry import (AFT_GALLEY, BACK_DISH, BACK_HALF, BIN, BIN_LATCH, CEILING_Z, COCKPIT_DOOR, CURTAIN, CUSHION, EXIT_SIGN, FLOOR_Z, GALLEY,
                       GALLEY_CART, JUMP_SEAT, LAVATORY, SEAT_KIT, X, lavatory_door, lavatory_outline,
                       backrest_depth, backrest_section, bin_door_z, bin_latch, bin_profile, cushion_section, liner_half_width_at)

RECLINE = math.radians(-11.0)          # rotation about Y: the backrest top leans aft
BACK_FOOT = Vector((-0.1775, 0.0, SEAT_KIT['pan_top']))
BACK_UP = Matrix.Rotation(RECLINE, 3, 'Y') @ Vector((0, 0, 1))
BACK_LENGTH = (SEAT_KIT['height'] - SEAT_KIT['pan_top']) / BACK_UP.z


def _part(name, build):
    """Builds one named mesh object from a bmesh-filling callback; box-projected UVs in metres."""
    bm = bmesh.new()
    build(bm)
    uv = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        n = f.normal
        axis = max(range(3), key=lambda k: abs(n[k]))
        a, b = [k for k in range(3) if k != axis]
        for loop in f.loops:
            loop[uv].uv = (loop.vert.co[a], loop.vert.co[b])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ctx.PARTS.append(ob)
    return ob


def _add_box(bm, size, centre, bevel, segments, rotation=None):
    m = Matrix.Translation(centre) @ (rotation.to_4x4() if rotation else Matrix.Identity(4))
    before = set(bm.verts)
    bmesh.ops.create_cube(bm, size=1.0, matrix=m @ Matrix.Diagonal((*size, 1.0)))
    new = [v for v in bm.verts if v not in before]
    if bevel > 0:
        edges = list({e for v in new for e in v.link_edges})
        bmesh.ops.bevel(bm, geom=new + edges, offset=bevel, offset_type='OFFSET', segments=segments, profile=0.6, affect='EDGES')


def _back_frame(along, behind):
    """Point on the backrest: `along` metres up the recline line, `behind` metres aft of its front face."""
    aft = Matrix.Rotation(RECLINE, 3, 'Y') @ Vector((-1, 0, 0))
    return BACK_FOOT + BACK_UP * along + aft * behind


def _beam(bm, p0, p1, w):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    rot = d.to_track_quat('Z', 'Y').to_matrix()
    _add_box(bm, (w, w, d.length), (p0 + p1) / 2, 0.006, 1, rot)


def _rings(bm, rings, cap=True):
    """Skins consecutive closed rings of 3D points (same count) and caps both ends."""
    verts = [[bm.verts.new(p) for p in ring] for ring in rings]
    n = len(verts[0])
    for a, b in zip(verts, verts[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    if cap:
        bm.faces.new(verts[0])
        bm.faces.new(verts[-1][::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])


BACK_REAR = 0.09          # fabric thickness behind the front line; the shell starts here
SHELL = 0.024             # shell thickness at the centre of the back
TOP_R = 0.04              # rounding of the backrest top (along the recline line)


def _cushion_top(x, y):
    """Height of the seat-pan top above pan_top at (x, y), from the dish profile (lip excluded)."""
    prof = cushion_section(min(abs(y) / BACK_HALF, 1.0))
    for (x0, z0), (x1, z1) in zip(prof, prof[1:]):
        if x0 <= x <= x1:
            return z0 + (z1 - z0) * (x - x0) / (x1 - x0)
    return prof[0][1] if x < prof[0][0] else prof[-1][1]


def _backrest_ring(t, theta=0.0):
    """Closed (y, behind) outline of the backrest at height fraction t; theta rounds the top towards the midline."""
    front = [(y, BACK_DISH - d) for y, d in backrest_section(t)]
    hw = BACK_HALF
    ring = front + [(hw + 0.006, 0.03), (hw + 0.002, BACK_REAR - 0.014), (hw - 0.012, BACK_REAR),
                    (-hw + 0.012, BACK_REAR), (-hw - 0.002, BACK_REAR - 0.014), (-hw - 0.006, 0.03)]
    mid, c, k = (BACK_DISH + BACK_REAR) / 2, math.cos(theta), 1 - 0.08 * (1 - math.cos(theta))
    return [(y * k, mid + (b - mid) * c) for y, b in ring]


def _corner(y, half):
    """How far the rounded top corners of the backrest and its cover drop at lateral y."""
    return 0.035 * (max(abs(y) / half - 0.75, 0.0) / 0.25) ** 2


def _shell_back(y):
    return BACK_REAR + SHELL - 0.01 * (1 - math.cos(math.pi * y / (2 * (BACK_HALF + 0.01))))


def build_seat_parts():
    """Seat v2 after the reference photos: contoured backrest with bolsters and lumbar, cushion with a rolled lip,
    plastic rear shell with tray table and literature pocket, fabric headrest cover, rounded arms, belt and buckle."""
    rot = Matrix.Rotation(RECLINE, 3, 'Y')
    w = SEAT_KIT['width'] - 0.02
    top_t = (BACK_LENGTH - TOP_R) / BACK_LENGTH
    pan = SEAT_KIT['pan_top']

    def at(y, along, behind):
        p = _back_frame(along, behind)
        return (p.x, y, p.z)

    def fabric(bm):
        rings = []
        for k in range(10):                                         # backrest body, its foot sunk into the cushion
            t = -0.06 + (top_t + 0.06) * k / 9
            rings.append([at(y, t * BACK_LENGTH, b) for y, b in _backrest_ring(t)])
        for theta in (0.5, 0.95, 1.3):                              # rounded top, corners rounded too
            rings.append([at(y, BACK_LENGTH - TOP_R + (TOP_R - _corner(y, BACK_HALF)) * math.sin(theta), b)
                          for y, b in _backrest_ring(top_t, theta)])
        _rings(bm, rings)
        c = CUSHION
        rows = []
        for v in (-1, -0.97, -0.85, -0.5, 0, 0.5, 0.85, 0.97, 1):    # seat pan, lofted across the width
            loop = cushion_section(abs(v)) + [(c['front_x'] - 0.012, -c['thick']), (c['back_x'] + 0.01, -c['thick']),
                                              (c['back_x'], -0.04)]
            shrink = {1: 0.12, 0.97: 0.035}.get(abs(v), 0.0)
            xc, zc = (c['back_x'] + c['front_x']) / 2, -c['thick'] / 2
            rows.append([(xc + (x - xc) * (1 - shrink), v * BACK_HALF, pan + zc + (z - zc) * (1 - shrink)) for x, z in loop])
        _rings(bm, rows)
        _sharpen(bm, 60)

    def shell(bm):
        sw, rings = BACK_HALF + 0.008, []
        for k in range(8):
            along = -0.02 + (top_t * BACK_LENGTH - 0.004 + 0.02) * k / 7
            back = [(sw - 2 * sw * i / 6, _shell_back(sw - 2 * sw * i / 6)) for i in range(7)]
            ring = [(-sw, BACK_REAR - 0.035), (-sw - 0.004, BACK_REAR + 0.004)] + back[::-1] + \
                   [(sw + 0.004, BACK_REAR + 0.004), (sw, BACK_REAR - 0.035), (sw - 0.008, BACK_REAR - 0.035),
                    (sw - 0.008, BACK_REAR + 0.002), (-sw + 0.008, BACK_REAR + 0.002), (-sw + 0.008, BACK_REAR - 0.035)]
            rings.append([at(y, along, b) for y, b in ring])
        _rings(bm, rings)
        _sharpen(bm, 50)
        back = _shell_back(0.0)
        _add_box(bm, (0.012, w - 0.08, 0.26), _back_frame(0.40, back + 0.004), 0.005, 1, rot)        # tray table
        _add_box(bm, (0.012, 0.045, 0.016), _back_frame(0.555, back + 0.004), 0, 0, rot)            # tray latch
        _add_box(bm, (0.016, w - 0.07, 0.15), _back_frame(0.13, back + 0.002), 0.006, 1, rot)        # literature pocket
        _add_box(bm, (0.46, w, 0.05), Vector((0.0, 0, pan - 0.135)), 0.01, 1)                         # pan frame

    def cover(bm):
        drop, gap, half = SEAT_KIT['cover_drop'], 0.006, BACK_HALF + 0.014      # wraps the shell's side trim
        mid = (BACK_DISH + BACK_REAR) / 2
        rows = []
        for i in range(9):
            y = -half + 2 * half * i / 8
            yy = min(abs(y), BACK_HALF)

            def front(along):
                return BACK_DISH - backrest_depth(yy, along / BACK_LENGTH) - gap
            row = [at(y, a, front(a)) for a in (BACK_LENGTH - drop, BACK_LENGTH - drop * 0.6, BACK_LENGTH - drop * 0.3)]
            fb, sb = front(BACK_LENGTH - TOP_R), _shell_back(yy) + gap
            for k in range(9):                                  # over the rounded top, front to back
                a = math.pi * k / 8
                along = BACK_LENGTH - TOP_R + (TOP_R + gap - _corner(y, half)) * math.sin(a)
                b = mid - (mid - fb) * math.cos(a) if a <= math.pi / 2 else mid - (sb - mid) * math.cos(a)
                row.append(at(y, along, b))
            row.append(at(y, BACK_LENGTH - 0.11, sb))
            rows.append([bm.verts.new(p) for p in row])
        for a, b in zip(rows, rows[1:]):
            for k in range(len(a) - 1):
                bm.faces.new((a[k], a[k + 1], b[k + 1], b[k]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])

    def arm(bm):
        aw, ah, r = SEAT_KIT['arm_width'] / 2, 0.022, 0.012
        zc = SEAT_KIT['arm_top'] - ah
        loop = []
        for cy, cz, a0 in ((aw - r, ah - r, 0), (-aw + r, ah - r, 90), (-aw + r, -ah + r, 180), (aw - r, -ah + r, 270)):
            loop += [(cy + r * math.cos(math.radians(a0 + 45 * j)), cz + r * math.sin(math.radians(a0 + 45 * j))) for j in range(3)]
        rings = []
        for x, s in ((-0.20, 0.8), (-0.195, 1.0), (-0.1, 1.0), (0.0, 1.0), (0.1, 1.0), (0.165, 1.0), (0.172, 1.07),
                     (0.19, 1.07), (0.198, 0.85)):                # pad, then a slightly proud end cap
            rings.append([(x, y * s, zc + z * s) for y, z in loop])
        _rings(bm, rings)
        _sharpen(bm, 50)
        _add_box(bm, (0.07, SEAT_KIT['arm_width'] - 0.012, 0.17), Vector((-0.16, 0, zc - ah - 0.085)), 0.008, 1)   # hinge block

    def legs(bm):
        for y in (-0.15, 0.15):
            _beam(bm, (0.18, y, 0.0), (0.12, y, 0.27), 0.03)
            _beam(bm, (-0.20, y, 0.0), (-0.10, y, 0.27), 0.03)
            _beam(bm, (0.17, y, 0.015), (-0.19, y, 0.015), 0.025)     # floor track foot
            for x in (0.18, -0.20):                                    # track fittings
                _add_box(bm, (0.06, 0.04, 0.012), Vector((x, y, 0.006)), 0, 0)
        _beam(bm, (0.10, -0.21, 0.29), (0.10, 0.21, 0.29), 0.035)      # front spreader
        _beam(bm, (-0.10, -0.21, 0.29), (-0.10, 0.21, 0.29), 0.035)    # rear spreader

    def belt(bm):
        bw, th = 0.042, 0.003
        for side in (1, -1):
            path = [(-0.19, 0.17, pan - 0.04), (-0.17, 0.165, None), (-0.11, 0.14, None), (-0.05, 0.10, None),
                    (0.0, 0.065, None), (0.02, 0.04, None)]
            pts = [Vector((x, side * y, z if z is not None else pan + _cushion_top(x, y) + th)) for x, y, z in path]
            rings = []
            for i, p in enumerate(pts):
                d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
                across = d.cross(Vector((0, 0, 1))).normalized() * (bw / 2)
                up = Vector((0, 0, th / 2))
                rings.append([tuple(p + across + up), tuple(p - across + up), tuple(p - across - up), tuple(p + across - up)])
            _rings(bm, rings)

    def buckle(bm):
        z = pan + _cushion_top(0.02, 0.0) + 0.006
        _add_box(bm, (0.05, 0.075, 0.008), Vector((0.02, 0, z)), 0.003, 1)           # buckle body
        _add_box(bm, (0.034, 0.05, 0.004), Vector((0.02, 0, z + 0.005)), 0, 0)       # lift latch

    return [_part('SeatFabric', fabric), _part('SeatShell', shell), _part('SeatCover', cover),
            _part('SeatArm', arm), _part('SeatLegs', legs), _part('SeatBelt', belt), _part('SeatBuckle', buckle)]


def build_bins():
    """BinPort / BinStarboard: one row of overhead bin (origin at the section centre), PSU lights underneath.
    Sections are 6 mm shorter than the row pitch, so neighbours leave a door seam."""
    prof = bin_profile()
    half = BIN['length'] / 2 - 0.003

    def body(bm, side):
        rings = [[bm.verts.new((x, side * z, y)) for z, y in prof] for x in (-half, half)]
        n = len(prof)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((rings[0][i], rings[0][j], rings[1][j], rings[1][i]))
        bm.faces.new(rings[0][::-1])
        bm.faces.new(rings[1])
        for z in (1.10, 1.25, 1.40, 1.03):          # three reading lights and a vent under the bin
            r = 0.012 if z == 1.03 else 0.025
            bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=r, radius2=r, depth=0.008,
                                  matrix=Matrix.Translation((0.0, side * z, BIN['bottom_y'] - 0.004)))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        for e in bm.edges:                          # crisp box edges, soft door curve
            if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(40):
                e.smooth = False

    return [_part('BinPort', lambda bm: body(bm, 1)), _part('BinStarboard', lambda bm: body(bm, -1))]


def build_bin_trim():
    """BinTrimPort / BinTrimStarboard, in the bin section's frame (origin at its centre) so they instance with the bins:
    the door's latch — a rounded plate with a grip bar across its top — and the seam line where this door meets the
    next one (a thin ribbon just proud of the door face along its curve)."""
    w, h, d = BIN_LATCH['width'], BIN_LATCH['height'], BIN_LATCH['depth']
    y, z = bin_latch()
    seam_x, seam_w = BIN['length'] / 2, 0.008

    def trim(bm, side):
        _add_box(bm, (w, d, h), Vector((0.0, side * z, y)), 0.004, 1)                                  # plate
        _add_box(bm, (w * 0.72, d * 0.8, h * 0.28), Vector((0.0, side * (z - d * 0.45), y + h * 0.22)), 0.0, 0)  # grip
        door = [(bin_door_z(BIN['bottom_y'] + (BIN['top_y'] - BIN['bottom_y']) * k / 6) - 0.0015,
                 BIN['bottom_y'] + (BIN['top_y'] - BIN['bottom_y']) * k / 6) for k in range(7)]
        rows = [[bm.verts.new((seam_x + dx, side * dz, dy)) for dx in (-seam_w / 2, seam_w / 2)] for dz, dy in door]
        for a, b in zip(rows, rows[1:]):
            f = bm.faces.new((a[0], a[1], b[1], b[0]))
            f.normal_update()
            if f.normal.y * side > 0:                 # face the aisle
                f.normal_flip()
        _sharpen(bm)

    return [_part('BinTrimPort', lambda bm: trim(bm, 1)), _part('BinTrimStarboard', lambda bm: trim(bm, -1))]


def _sharpen(bm, degrees=40):
    for e in bm.edges:
        if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(degrees):
            e.smooth = False


def _loft(bm, stations, profile):
    """Closed profile (|z|, y) per station, lofted along X; Blender Y = -|z| (starboard). Caps at both ends."""
    rings = [[bm.verts.new((X(s), -z, y)) for z, y in profile(s)] for s in stations]
    n = len(rings[0])
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(rings[0])
    bm.faces.new(rings[-1][::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])


def build_galley():
    """GalleyPanels (body: lower units, worktop recess, upper units, outer side on the liner), GalleySteel (cart
    doors, oven fronts, handles), GalleyWorktop — in cabin coordinates, starboard, opposite door 1L."""
    g, gap, iz = GALLEY, 0.02, GALLEY['inner_z']
    recess_top, recess_depth = 0.55, 0.30
    stations = [g['s0'] + (g['s1'] - g['s0']) * k / 6 for k in range(7)]
    wall_y = [g['top_y'] - (g['top_y'] - FLOOR_Z) * k / 8 for k in range(9)]

    def profile(s):
        front = [(iz, FLOOR_Z), (iz, g['worktop_y']), (iz + recess_depth, g['worktop_y']), (iz + recess_depth, recess_top),
                 (iz + 0.05, recess_top), (iz + 0.05, g['top_y'])]
        return front + [(liner_half_width_at(s, y) - gap, y) for y in wall_y]

    def panels(bm):
        _loft(bm, stations, profile)
        _sharpen(bm)

    def steel(bm):
        length = g['s1'] - g['s0']
        for k in range(4):                                      # four full-size carts under the worktop
            s = g['s0'] + length * (k + 0.5) / 4
            h = g['worktop_y'] - 0.04 - (FLOOR_Z + 0.02)
            _add_box(bm, (length / 4 - 0.03, 0.012, h), Vector((X(s), -(iz - 0.006), FLOOR_Z + 0.02 + h / 2)), 0.004, 1)
            _add_box(bm, (0.12, 0.02, 0.02), Vector((X(s), -(iz - 0.02), g['worktop_y'] - 0.10)), 0.006, 1)
        for k in range(2):                                      # ovens / coffee makers in the upper units
            s = g['s0'] + length * (k + 0.75) / 2.5
            _add_box(bm, (0.36, 0.012, 0.30), Vector((X(s), -(iz + 0.05 - 0.006), 0.95)), 0.004, 1)
        _sharpen(bm)

    def worktop(bm):
        length = g['s1'] - g['s0']
        _add_box(bm, (length, recess_depth + 0.03, 0.03), Vector((X((g['s0'] + g['s1']) / 2), -(iz - 0.03 + (recess_depth + 0.03) / 2), g['worktop_y'] + 0.015)), 0.005, 1)
        _sharpen(bm)

    return [_part('GalleyPanels', panels), _part('GalleySteel', steel), _part('GalleyWorktop', worktop)]


def build_curtain():
    """Curtain: drapes drawn open and bunched on both sides of the aisle, pleated, from the ceiling track down."""
    c = CURTAIN
    x0 = X(c['station'])
    cols, rows, folds = 24, 8, 5

    def drapes(bm):
        for side in (1, -1):
            grid = []
            for j in range(rows + 1):
                y = c['bottom_y'] + (CEILING_Z - 0.01 - c['bottom_y']) * j / rows
                row = []
                for i in range(cols + 1):
                    u = i / cols
                    z = c['inner_z'] + (c['outer_z'] - c['inner_z']) * u
                    row.append(bm.verts.new((x0 + 0.05 * math.sin(2 * math.pi * folds * u), side * z, y)))
                grid.append(row)
            for a, b in zip(grid, grid[1:]):
                for i in range(cols):
                    bm.faces.new((a[i], a[i + 1], b[i + 1], b[i]))

    return [_part('Curtain', drapes)]


def build_cockpit_door():
    """CockpitDoor (frame and reinforced leaf on the front bulkhead) and CockpitDoorHardware (lever handle, peephole,
    placard, and the entry keypad on the galley's side wall next to the door) — cabin coordinates. The cabin lies aft
    of the bulkhead, towards lower X; Blender Y = -three.js z."""
    d = COCKPIT_DOOR
    x0, yc = X(d['station']), -d['z']
    half, height, frame = d['width'] / 2, d['height'], 0.04
    leaf_w, leaf_h = d['width'] - 2 * frame, height - frame - 0.01
    port = yc + half - frame                           # the leaf's port edge (Blender +Y)

    def door(bm):
        for y in (yc - half + frame / 2, yc + half - frame / 2):                       # jambs
            _add_box(bm, (0.03, frame, height), Vector((x0 - 0.015, y, FLOOR_Z + height / 2)), 0.004, 1)
        _add_box(bm, (0.03, d['width'], frame), Vector((x0 - 0.015, yc, FLOOR_Z + height - frame / 2)), 0.004, 1)
        _add_box(bm, (0.02, leaf_w, leaf_h), Vector((x0 - 0.01, yc, FLOOR_Z + 0.01 + leaf_h / 2)), 0.003, 1)
        for zc in (FLOOR_Z + 0.48, FLOOR_Z + 1.30):                                    # raised armour panels
            _add_box(bm, (0.008, leaf_w - 0.12, 0.66), Vector((x0 - 0.022, yc, zc)), 0.003, 1)
        _sharpen(bm)

    def hardware(bm):
        _add_box(bm, (0.012, 0.05, 0.13), Vector((x0 - 0.026, port - 0.09, FLOOR_Z + 1.02)), 0.004, 1)        # handle plate
        _add_box(bm, (0.03, 0.13, 0.024), Vector((x0 - 0.045, port - 0.13, FLOOR_Z + 1.05)), 0.008, 1)       # lever
        bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.014, radius2=0.012, depth=0.02,
                              matrix=Matrix.Translation((x0 - 0.03, yc, FLOOR_Z + 1.55)) @ Matrix.Rotation(math.pi / 2, 4, 'Y'))
        _add_box(bm, (0.006, 0.24, 0.06), Vector((x0 - 0.027, yc, FLOOR_Z + 1.74)), 0.002, 1)                # placard
        gx = X(d['station'] + 0.12)                                                     # keypad on the galley wall
        _add_box(bm, (0.075, 0.018, 0.12), Vector((gx, -(GALLEY['inner_z'] - 0.009), FLOOR_Z + 1.25)), 0.004, 1)
        _sharpen(bm)

    return [_part('CockpitDoor', door), _part('CockpitDoorHardware', hardware)]


def build_jump_seat():
    """JumpSeat (backrest, headrest and the seat pan folded up in front of it) and JumpSeatFrame (side rails, base
    bracket, shoulder harness and buckle) on the front bulkhead, port of the cockpit door, facing aft — cabin
    coordinates."""
    j = JUMP_SEAT
    xb, yc, w, h = X(j['station']), -j['z'], j['width'], j['height']

    def cushions(bm):
        _add_box(bm, (0.06, w - 0.05, 0.56), Vector((xb - 0.03, yc, FLOOR_Z + 0.68)), 0.02, 2)       # backrest 0.40–0.96
        _add_box(bm, (0.055, w - 0.14, 0.11), Vector((xb - 0.03, yc, FLOOR_Z + h - 0.065)), 0.02, 2)  # headrest
        _add_box(bm, (0.07, w - 0.05, 0.42), Vector((xb - 0.095, yc, FLOOR_Z + 0.63)), 0.02, 2)       # seat pan, stowed
        _sharpen(bm, 60)

    def frame(bm):
        for side in (-1, 1):
            y = yc + side * (w / 2 - 0.012)
            _add_box(bm, (0.04, 0.024, 0.98), Vector((xb - 0.02, y, FLOOR_Z + 0.49)), 0.004, 1)          # side rail
            _add_box(bm, (0.004, 0.04, 0.50), Vector((xb - 0.132, yc + side * 0.09, FLOOR_Z + 0.66)), 0, 0)  # harness
        _add_box(bm, (0.10, w, 0.035), Vector((xb - 0.05, yc, FLOOR_Z + 0.38)), 0.006, 1)                 # base bracket
        _add_box(bm, (0.012, 0.075, 0.05), Vector((xb - 0.137, yc, FLOOR_Z + 0.55)), 0.004, 1)            # buckle
        _sharpen(bm)

    return [_part('JumpSeat', cushions), _part('JumpSeatFrame', frame)]


def build_aft_galley():
    """AftGalley (body: trolley bays below, a worktop recess, ovens and stowage above), AftGalleySteel (trolley doors,
    oven and drawer fronts), AftGalleyWorktop (worktop, latches, handles; the empty bay's dark back) across the aisle
    end, front face forward — cabin coordinates."""
    g = AFT_GALLEY
    xf, xb, hw = X(g['s0']), X(g['s1']), g['half_width']
    worktop, recess_top, recess = FLOOR_Z + 1.05, FLOOR_Z + 1.40, 0.28
    top = g['top_y']
    bays = [-0.46, 0.0, 0.46]                                              # three trolley bays
    empty = bays[1]                                                        # the pulled-out trolley's bay

    def body(bm):
        _add_box(bm, (xf - xb, 2 * hw, worktop - FLOOR_Z), Vector(((xf + xb) / 2, 0, (FLOOR_Z + worktop) / 2)), 0.006, 1)
        _add_box(bm, (xf - xb - recess, 2 * hw, recess_top - worktop), Vector(((xf - recess + xb) / 2, 0, (worktop + recess_top) / 2)), 0, 0)
        _add_box(bm, (xf - xb, 2 * hw, top - recess_top), Vector(((xf + xb) / 2, 0, (recess_top + top) / 2)), 0.006, 1)
        _sharpen(bm)

    def steel(bm):
        for y in bays:
            if y != empty:
                _add_box(bm, (0.012, 0.42, 0.98), Vector((xf + 0.004, y, FLOOR_Z + 0.52)), 0.004, 1)       # trolley doors
        for y in bays:
            _add_box(bm, (0.012, 0.42, 0.26), Vector((xf + 0.004, y, recess_top + 0.16)), 0.004, 1)     # ovens / boilers
            _add_box(bm, (0.012, 0.42, 0.12), Vector((xf + 0.004, y, top - 0.08)), 0.004, 1)           # drawers
        _sharpen(bm)

    def trim(bm):
        _add_box(bm, (recess + 0.03, 2 * hw, 0.03), Vector((xf - recess / 2 + 0.015, 0, worktop + 0.015)), 0.005, 1)   # worktop
        _add_box(bm, (0.006, 0.40, 0.96), Vector((xf - 0.42, empty, FLOOR_Z + 0.5)), 0, 0)                   # empty bay back
        for y in bays:
            if y != empty:
                _add_box(bm, (0.02, 0.06, 0.03), Vector((xf + 0.016, y, FLOOR_Z + 0.95)), 0.006, 1)            # bay latch
        for y in bays:
            _add_box(bm, (0.02, 0.22, 0.02), Vector((xf + 0.016, y, recess_top + 0.04)), 0.006, 1)             # oven handle
        _sharpen(bm)

    return [_part('AftGalley', body), _part('AftGalleySteel', steel), _part('AftGalleyWorktop', trim)]


def build_lavatories():
    """Lavatories (two blocks from the galley out to the liner), LavatoryDoors (the bi-fold doors facing forward, two
    leaves with a fold gap) and LavatoryTrim (occupancy signs and fold handles) — cabin coordinates."""
    lv = LAVATORY
    stations = [lv['s0'] + (lv['s1'] - lv['s0']) * k / 4 for k in range(5)]
    xf = X(lv['s0'])

    door = lavatory_door()

    def blocks(bm):
        for side in (1, -1):
            _rings(bm, [[(X(s), side * z, y) for z, y in lavatory_outline(s)] for s in stations])
        _sharpen(bm)

    def doors(bm):
        b, t, fold = door['bottom'], door['top'], door['fold']
        inner_leaf = [(door['inner'], b), (fold - 0.004, b), (fold - 0.004, t), (door['inner'], t)]
        outer_leaf = [(fold + 0.004, b)] + [(z, y) for y, z in door['outer']] + [(fold + 0.004, t)]
        for side in (1, -1):
            for leaf in (inner_leaf, outer_leaf):                          # the two leaves, a fold gap between
                _rings(bm, [[(x, side * z, y) for z, y in leaf] for x in (xf - 0.001, xf + 0.013)])
        _sharpen(bm)

    def trim(bm):
        z0, z1, y0, y1 = door['sign']
        for side in (1, -1):
            yc = side * door['fold']
            _add_box(bm, (0.02, z1 - z0, y1 - y0), Vector((xf + 0.012, side * (z0 + z1) / 2, (y0 + y1) / 2)), 0.004, 1)  # occupancy sign
            _add_box(bm, (0.03, 0.025, 0.14), Vector((xf + 0.022, yc, FLOOR_Z + 1.0)), 0.006, 1)               # fold handle
        _sharpen(bm)

    return [_part('Lavatories', blocks), _part('LavatoryDoors', doors), _part('LavatoryTrim', trim)]


def build_cart():
    """GalleyCart: a full-size trolley pulled out of its bay into the aisle — rounded steel box, door panels, rim,
    brake pedal and four castors — cabin coordinates (station = its centre)."""
    c = GALLEY_CART
    xc, w, d, h = X(c['station']), c['width'], c['depth'], c['height']
    base = FLOOR_Z + 0.05

    def cart(bm):
        _add_box(bm, (d, w, h - 0.05), Vector((xc, 0, base + (h - 0.05) / 2)), 0.015, 2)
        for dx in (-1, 1):                                                # door panels on both ends
            _add_box(bm, (0.006, w - 0.05, h - 0.2), Vector((xc + dx * (d / 2 + 0.002), 0, base + (h - 0.05) / 2)), 0.003, 1)
        _add_box(bm, (d + 0.01, w + 0.01, 0.02), Vector((xc, 0, FLOOR_Z + h - 0.01)), 0.006, 1)              # top rim
        for dx in (-1, 1):
            for dy in (-1, 1):
                bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=0.025, radius2=0.025, depth=0.02,
                                      matrix=Matrix.Translation((xc + dx * (d / 2 - 0.05), dy * (w / 2 - 0.04), FLOOR_Z + 0.025))
                                      @ Matrix.Rotation(math.pi / 2, 4, 'X'))
        _add_box(bm, (0.05, 0.08, 0.012), Vector((xc + d / 2 - 0.02, 0, FLOOR_Z + 0.06)), 0.003, 1)          # brake pedal
        _sharpen(bm)

    return [_part('GalleyCart', cart)]


def build_exit_sign():
    """ExitSign housing in its own frame (faces ±X carry the lettering on the site)."""
    e = EXIT_SIGN
    return [_part('ExitSign', lambda bm: _add_box(bm, (e['d'], e['w'], e['h']), Vector((0, 0, 0)), 0.008, 2))]


def triangles(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def render_seat(parts, samples):
    """Studio review renders of one seat (front 3/4 and rear 3/4); preview materials are never exported."""
    import os

    from .mesh import material
    looks = {'SeatFabric': material('PrevFabric', '#3d4658', rough=0.95), 'SeatShell': material('PrevShell', '#e9e6df', rough=0.5),
             'SeatCover': material('PrevCover', '#3aa6a0', rough=0.9, double=True), 'SeatArm': material('PrevArm', '#5b6070', rough=0.45),
             'SeatLegs': material('PrevLegs', '#9aa0a8', rough=0.3, metal=0.8),
             'SeatBelt': material('PrevBelt', '#9a2f35', rough=0.8), 'SeatBuckle': material('PrevBuckle', '#c8ccd2', rough=0.25, metal=1.0)}
    scene = bpy.context.scene
    for ob in scene.collection.objects:
        ob.hide_render = ob not in parts
    for ob in parts:
        ob.data.materials.append(looks[ob.name])
    arm = next(ob for ob in parts if ob.name == 'SeatArm')
    twin = arm.copy()
    twin.location.y = -SEAT_KIT['width'] / 2 - 0.01
    scene.collection.objects.link(twin)
    arm.location.y = SEAT_KIT['width'] / 2 + 0.01
    floor = bpy.data.objects.new('PrevFloor', bpy.data.meshes.new('PrevFloor'))
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=3)
    bm.to_mesh(floor.data)
    bm.free()
    floor.data.materials.append(material('PrevCarpet', '#7d8590', rough=0.95))
    scene.collection.objects.link(floor)

    scene.render.engine = 'CYCLES'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'OPTIX'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = d.type == 'OPTIX'
        scene.cycles.device = 'GPU'
    except Exception as e:
        ctx.log('render on CPU', e)
    scene.render.resolution_x, scene.render.resolution_y = 1200, 900
    scene.view_settings.view_transform = 'AgX'
    world = bpy.data.worlds.new('Studio')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.8, 0.82, 0.85, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
    sun = bpy.data.objects.new('Key', bpy.data.lights.new('Key', 'SUN'))
    sun.data.energy = 3.0
    sun.rotation_euler = (math.radians(50), 0, math.radians(30))
    scene.collection.objects.link(sun)
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
    cam.data.lens = 50
    scene.collection.objects.link(cam)
    scene.camera = cam
    for name, pos in (('seat-front', (1.7, -1.1, 1.2)), ('seat-rear', (-1.6, 1.1, 1.25))):
        cam.location = pos
        cam.rotation_euler = (Vector((0.0, 0.0, 0.55)) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = os.path.join(ctx.OUT, 'renders', name + '.png')
        bpy.ops.render.render(write_still=True)
        ctx.log('rendered', scene.render.filepath)
