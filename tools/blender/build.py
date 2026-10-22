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
    export_glb(root)
    shots = [s for s in args.renders.split(',') if s]
    if shots:
        render(shots, args.samples, not args.no_clouds)


main()
