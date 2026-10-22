"""GLB export and the meta file the site's geometry.ts is checked against."""
import json
import os

import bpy

from . import context as ctx
from .geometry import (BIN, CURTAIN, EXIT_SIGN, GALLEY, SEAT_KIT, CABIN, CEILING_Z, DOOR_1L, DOOR_OPEN, FLOOR_Z, LINER_INSET, OVERWING_EXITS, TAIL0, WINDOW, cabin_wall_inner,
                       bin_profile, door_hinge, door_rect, liner_grid)


def _three(v):
    """Blender (X, Y, Z) → three.js (x, y, z) = (X, Z, −Y), rounded."""
    x, y, z = v
    return [round(x, 4), round(z, 4), round(-y, 4) + 0.0]


def triangle_count():
    return sum(len(p.vertices) - 2 for ob in ctx.PARTS if ob.type == 'MESH' for p in ob.data.polygons)


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
                   'sillY': round(z0, 4), 'hinge': _three(door_hinge()),
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
