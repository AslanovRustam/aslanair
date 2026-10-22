"""Mutable build state shared by the builder modules."""
import time

T0 = time.time()
OUT = '.'
PARTS = []


def log(*a):
    print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)
