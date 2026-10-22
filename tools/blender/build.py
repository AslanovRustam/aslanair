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
    export_glb(root)
    shots = [s for s in args.renders.split(',') if s]
    if shots:
        render(shots, args.samples, not args.no_clouds)


main()
