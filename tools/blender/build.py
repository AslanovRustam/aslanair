"""AslanAir airliner build (run inside Blender).

blender -b --factory-startup -P tools/blender/build.py -- --out DIR [--renders hero,side,window,engine,nose] [--samples N] [--no-clouds]
"""
import argparse
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from aslanair import context as ctx  # noqa: E402
from aslanair.export import export_glb  # noqa: E402
from aslanair.cabin import wall_corner_normal  # noqa: E402
from aslanair.geometry import FLOOR_Z, L, hull_half_width_at  # noqa: E402
from aslanair.hull import build_aircraft  # noqa: E402
from aslanair.render import render  # noqa: E402


def verify_lettering():
    """Each side must read left-to-right for a viewer standing on that side.

    Port viewer (+Y) has the nose (+X) on the left: the first glyph has the larger X.
    Starboard viewer (−Y) has the nose on the right: the first glyph has the smaller X.
    """
    for name, side in (('Lettering_L', 1), ('Lettering_R', -1)):
        ob = bpy.data.objects.get(name)
        if ob is None:
            sys.exit(f'lettering check failed: {name} is missing')
        first = ob.data.vertices[ob['first_glyph_vertex']].co.x
        last = ob.data.vertices[ob['last_glyph_vertex']].co.x
        if (first > last) != (side > 0):
            sys.exit(f'lettering check failed: {name} reads backwards')
    ctx.log('lettering reads left-to-right on both sides')


def verify_cabin_shell():
    """No cracks: the shell's only open edges run along the floor and round the hull end of the reveals."""
    me = bpy.data.objects['CabinShell'].data
    uses = {}
    for p in me.polygons:
        for e in p.edge_keys:
            uses[e] = uses.get(e, 0) + 1

    def rim(i):
        co = me.vertices[i].co
        return abs(co.z - FLOOR_Z) < 1e-4 or abs(abs(co.y) - hull_half_width_at(L / 2 - co.x, co.z)) < 1e-4

    cracks = [e for e, n in uses.items() if n == 1 and not (rim(e[0]) and rim(e[1]))]
    if cracks:
        a = me.vertices[cracks[0][0]].co
        sys.exit(f'cabin shell check failed: {len(cracks)} open edges, e.g. at ({a.x:.3f}, {a.y:.3f}, {a.z:.3f})')
    ctx.log('cabin shell is crack-free')


def verify_cabin_shading():
    """Wall corners shade with the liner's own normal, so the clipped slivers round the openings don't streak."""
    me = bpy.data.objects['CabinShell'].data
    corner = me.corner_normals
    off = 0
    for p in me.polygons:
        for li in p.loop_indices:
            want = wall_corner_normal(me.vertices[me.loops[li].vertex_index].co, p.normal)
            if want is not None and corner[li].vector.dot(want) < 0.99985:   # 1°
                off += 1
    if off:
        sys.exit(f'cabin shading check failed: {off} wall corners off the liner normal')
    ctx.log('cabin wall shades with the liner normal')


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser(prog='build.py')
    parser.add_argument('--out', required=True)
    parser.add_argument('--renders', default='')
    parser.add_argument('--samples', type=int, default=96)
    parser.add_argument('--no-clouds', action='store_true')
    args = parser.parse_args(argv)

    ctx.OUT = os.path.abspath(args.out)
    os.makedirs(os.path.join(ctx.OUT, 'renders'), exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)

    root = build_aircraft()
    verify_lettering()
    verify_cabin_shell()
    verify_cabin_shading()
    export_glb(root)
    shots = [s for s in args.renders.split(',') if s]
    if shots:
        render(shots, args.samples, not args.no_clouds)


main()
