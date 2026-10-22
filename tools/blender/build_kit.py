"""AslanAir cabin kit build (run inside Blender).

blender -b --factory-startup -P tools/blender/build_kit.py -- --out DIR [--renders seat] [--samples N]
"""
import argparse
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from aslanair import context as ctx  # noqa: E402
from aslanair.export import export_kit_glb  # noqa: E402
from aslanair.kit import build_bins, build_curtain, build_exit_sign, build_galley, build_seat_parts, render_seat, triangles  # noqa: E402

SEAT_BUDGET = 3000


def verify_kit(seat_parts):
    total = sum(triangles(ob) for ob in seat_parts)
    if total > SEAT_BUDGET:
        sys.exit(f'kit check failed: one seat is {total} triangles (budget {SEAT_BUDGET})')
    ctx.log(f'one seat is {total} triangles')


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser(prog='build_kit.py')
    parser.add_argument('--out', required=True)
    parser.add_argument('--renders', default='')
    parser.add_argument('--samples', type=int, default=64)
    args = parser.parse_args(argv)

    ctx.OUT = os.path.abspath(args.out)
    os.makedirs(os.path.join(ctx.OUT, 'renders'), exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)

    seat = build_seat_parts()
    verify_kit(seat)
    build_bins()
    build_galley()
    build_curtain()
    build_exit_sign()
    export_kit_glb(ctx.PARTS)
    if 'seat' in args.renders.split(','):
        render_seat(seat, args.samples)


main()
