"""GLB export and the meta file the site's geometry.ts is checked against."""
import json
import os

import bpy

from . import context as ctx
from .geometry import (CABIN, CEILING_Z, DOOR_1L, DOOR_OPEN, FLOOR_Z, LINER_INSET, OVERWING_EXITS, TAIL0, WINDOW, cabin_wall_inner,
                       door_hinge, door_rect, liner_grid)


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
