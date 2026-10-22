"""GLB export and the meta file the site's geometry.ts is checked against."""
import json
import os

import bpy

from . import context as ctx
from .geometry import (AFT_GALLEY, BIN, COCKPIT_DOOR, CURTAIN, EXIT_ARROWS, EXIT_SIGN, GALLEY, GALLEY_CART, JUMP_SEAT, LAVATORY, SEAT_KIT, CABIN, CEILING_Z, DOOR_1L, DOOR_OPEN, FLOOR_Z, LINER_INSET, OVERWING_EXITS, TAIL0, WINDOW, cabin_wall_inner,
                       bin_profile, door_hinge, door_rect, hull_half_width_at, lavatory_outline, liner_grid)


def _three(v):
    """Blender (X, Y, Z) → three.js (x, y, z) = (X, Z, −Y), rounded."""
    x, y, z = v
    return [round(x, 4), round(z, 4), round(-y, 4) + 0.0]


def triangle_count():
    return sum(len(p.vertices) - 2 for ob in ctx.PARTS if ob.type == 'MESH' for p in ob.data.polygons)


def panel_max_half_width():
    """Widest hull half-width over the door rectangle: how far out the closed panel reaches."""
    s0, s1, z0, z1 = door_rect()
    return round(max(hull_half_width_at(s0 + (s1 - s0) * i / 20, z0 + (z1 - z0) * j / 20) for i in range(21) for j in range(21)), 4)


def meta():
    _, _, z0, _ = door_rect()
    return {
        'units': 'm',
        'axes': 'three.js: Y up, nose +X, port -Z',
        'floorY': round(FLOOR_Z, 4),
        'ceilingY': round(CEILING_Z, 4),
        'cabinWallZ': round(cabin_wall_inner(15.0), 4),
        'cabin': {'frontStation': CABIN['front_station'], 'aftStation': CABIN['aft_station'], 'liner': liner_grid()},
        'linerInset': LINER_INSET,
        'overwingExits': OVERWING_EXITS,
        'window': {'y': WINDOW['z'], 'firstStation': WINDOW['first'], 'pitch': WINDOW['pitch'],
                   'lastStation': WINDOW['last'], 'w': WINDOW['w'], 'h': WINDOW['h']},
        'door1L': {'station': DOOR_1L['station'], 'width': DOOR_1L['width'], 'height': DOOR_1L['height'],
                   'sillY': round(z0, 4), 'hinge': _three(door_hinge()), 'panelMaxHalfWidth': panel_max_half_width(),
                   'open': {'outward': DOOR_OPEN['outward'], 'forward': DOOR_OPEN['forward']}},
        'tail0': TAIL0,
        'triangles': triangle_count(),
    }


def export_glb(root):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in ctx.PARTS + [root]:
        ob.select_set(True)
    glb = os.path.join(ctx.OUT, 'airliner.glb')
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_extras=True)   # 'decal' flags → userData
    with open(os.path.join(ctx.OUT, 'airliner.meta.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(meta(), f, indent=2, sort_keys=True)
        f.write('\n')
    ctx.log('exported', glb, f'{os.path.getsize(glb) / 1e6:.1f} MB')
    return glb


def kit_meta(parts):
    return {
        'units': 'm',
        'seat': {'depth': SEAT_KIT['depth'], 'width': SEAT_KIT['width'], 'panTop': SEAT_KIT['pan_top'], 'armTop': SEAT_KIT['arm_top'],
                 'height': SEAT_KIT['height'], 'backFrontTopX': SEAT_KIT['back_front_top_x']},
        'bin': {'length': BIN['length'], 'bottomY': BIN['bottom_y'], 'aisleZ': BIN['aisle_z'], 'profile': bin_profile()},
        'galley': {'s0': GALLEY['s0'], 's1': GALLEY['s1'], 'innerZ': GALLEY['inner_z'], 'topY': GALLEY['top_y'], 'worktopY': GALLEY['worktop_y']},
        'curtain': {'station': CURTAIN['station'], 'innerZ': CURTAIN['inner_z'], 'outerZ': CURTAIN['outer_z'], 'bottomY': CURTAIN['bottom_y']},
        'exitSign': {'w': EXIT_SIGN['w'], 'h': EXIT_SIGN['h'], 'd': EXIT_SIGN['d'], 'y': EXIT_SIGN['y'], 'placements': EXIT_SIGN['placements']},
        'cockpitDoor': dict(COCKPIT_DOOR),
        'jumpSeat': dict(JUMP_SEAT),
        'exitArrows': dict(EXIT_ARROWS),
        'aftGalley': {'s0': AFT_GALLEY['s0'], 's1': AFT_GALLEY['s1'], 'halfWidth': AFT_GALLEY['half_width'], 'topY': AFT_GALLEY['top_y']},
        'galleyCart': dict(GALLEY_CART),
        'lavatory': {'s0': LAVATORY['s0'], 's1': LAVATORY['s1'], 'innerZ': LAVATORY['inner_z'],
                     'outline': [[s, [[round(z, 4), round(y, 4)] for z, y in lavatory_outline(s)]] for s in (LAVATORY['s0'], LAVATORY['s1'])]},
        'triangles': {ob.name: sum(len(p.vertices) - 2 for p in ob.data.polygons) for ob in parts},
    }


def export_kit_glb(parts):
    """Geometry-only GLB (the site assigns materials) + cabin-kit.meta.json."""
    bpy.ops.object.select_all(action='DESELECT')
    for ob in parts:
        ob.select_set(True)
    glb = os.path.join(ctx.OUT, 'cabin-kit.glb')
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_materials='NONE')
    with open(os.path.join(ctx.OUT, 'cabin-kit.meta.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(kit_meta(parts), f, indent=2, sort_keys=True)
        f.write('\n')
    ctx.log('exported', glb, f'{os.path.getsize(glb) / 1e3:.0f} KB')
    return glb
