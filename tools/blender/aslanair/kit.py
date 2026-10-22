"""Cabin kit: furnishing geometry the site instances (seats now; bins, galley, curtain, signs later).

Geometry only — the site assigns its own materials. Seat parts are authored with the origin on the
floor under the seat centre, facing +X (the nose); Blender Y = port, so three.js z = -Y.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

from . import context as ctx
from .geometry import SEAT_KIT

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


def build_seat_parts():
    rot = Matrix.Rotation(RECLINE, 3, 'Y')
    w = SEAT_KIT['width'] - 0.02
    lower, upper, thick = 0.36, BACK_LENGTH - 0.37, 0.085

    def fabric(bm):
        _add_box(bm, (0.44, w, 0.11), Vector((0.02, 0, SEAT_KIT['pan_top'] - 0.055)), 0.035, 3)
        _add_box(bm, (thick, w, lower), _back_frame(lower / 2, thick / 2), 0.03, 3, rot)
        _add_box(bm, (thick, w - 0.02, upper), _back_frame(BACK_LENGTH - upper / 2, thick / 2), 0.035, 3, rot)

    def shell(bm):
        _add_box(bm, (0.03, w + 0.01, BACK_LENGTH - 0.02), _back_frame(BACK_LENGTH / 2 - 0.01, thick + 0.015), 0.012, 2, rot)
        _add_box(bm, (0.012, w - 0.06, 0.26), _back_frame(0.38, thick + 0.034), 0.004, 1, rot)   # tray table
        _add_box(bm, (0.46, w, 0.05), Vector((0.0, 0, SEAT_KIT['pan_top'] - 0.135)), 0.01, 1)     # pan frame

    def cover(bm):
        # drape over the top: down the front `cover_drop`, over the cushion top and down the back of the shell
        drop, t, half = SEAT_KIT['cover_drop'], thick / 2 + 0.006, (w - 0.03) / 2
        cx, rx, rz = -0.015, thick / 2 + 0.021, 0.045        # arc from the front face (+t) to behind the shell
        prof = [(t, -drop), (t, -rz)]
        prof += [(cx + rx * math.cos(a), -rz + rz * math.sin(a)) for a in [i * math.pi / 8 for i in range(1, 8)]]
        prof += [(cx - rx, -rz), (cx - rx, -0.11)]
        rows = []
        for y in (-half, 0.0, half):
            row = []
            for px, pz in prof:
                p = _back_frame(BACK_LENGTH + pz, thick / 2 - px)
                row.append(bm.verts.new((p.x, y, p.z)))
            rows.append(row)
        for a, b in zip(rows, rows[1:]):
            for i in range(len(prof) - 1):
                bm.faces.new((a[i], a[i + 1], b[i + 1], b[i]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])

    def arm(bm):
        top = SEAT_KIT['arm_top']
        _add_box(bm, (0.40, SEAT_KIT['arm_width'], 0.05), Vector((0.0, 0, top - 0.025)), 0.018, 2)
        _add_box(bm, (0.07, SEAT_KIT['arm_width'] - 0.01, 0.16), Vector((-0.16, 0, top - 0.13)), 0.01, 1)

    def legs(bm):
        for y in (-0.15, 0.15):
            _beam(bm, (0.18, y, 0.0), (0.12, y, 0.27), 0.03)
            _beam(bm, (-0.20, y, 0.0), (-0.10, y, 0.27), 0.03)
            _beam(bm, (0.17, y, 0.015), (-0.19, y, 0.015), 0.025)     # floor track foot
        _beam(bm, (0.10, -0.21, 0.29), (0.10, 0.21, 0.29), 0.035)      # front spreader
        _beam(bm, (-0.10, -0.21, 0.29), (-0.10, 0.21, 0.29), 0.035)    # rear spreader

    return [_part('SeatFabric', fabric), _part('SeatShell', shell), _part('SeatCover', cover),
            _part('SeatArm', arm), _part('SeatLegs', legs)]


def triangles(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def render_seat(parts, samples):
    """Studio review renders of one seat (front 3/4 and rear 3/4); preview materials are never exported."""
    import os

    from .mesh import material
    looks = {'SeatFabric': material('PrevFabric', '#3d4658', rough=0.95), 'SeatShell': material('PrevShell', '#e9e6df', rough=0.5),
             'SeatCover': material('PrevCover', '#3aa6a0', rough=0.9, double=True), 'SeatArm': material('PrevArm', '#5b6070', rough=0.45),
             'SeatLegs': material('PrevLegs', '#9aa0a8', rough=0.3, metal=0.8)}
    scene = bpy.context.scene
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
