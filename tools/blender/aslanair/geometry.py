"""Pure aircraft geometry (Blender coordinates: X = L/2 - s, +Y port, Z up). No bpy."""
import math

# ---------------------------------------------------------------- dimensions (m)
L = 37.6                    # length
RW, RT, RB = 1.975, 2.10, 2.04
NOSE_Z = -0.55
TAIL0 = 25.5                # start of tail cone
def X(s): return L / 2 - s  # s = distance from nose; nose points to +X, left wing to +Y

def ease(t, p):
    t = min(max(t, 0.0), 1.0)
    return (1 - (1 - t) ** p) ** (1 / p)

def section(s):
    """half width, centre z, half height of the fuselage at station s"""
    if s <= TAIL0:
        w = RW * ease(s / 6.2, 2.15)
        zt = NOSE_Z + (RT - NOSE_Z) * ease(s / 7.8, 1.75)
        zb = NOSE_Z + (-RB - NOSE_Z) * ease(s / 5.4, 2.1)
    else:
        u = min((s - TAIL0) / (L - TAIL0), 1.0)
        w = RW * (1 - 0.86 * u ** 1.5)
        zt = RT - 0.95 * u ** 1.7
        zb = -RB + 2.70 * u ** 1.3
    return w, (zt + zb) / 2, (zt - zb) / 2


def hull_top(s):
    w, zc, h = section(s)
    return zc + h


def hull_half_width_at(s, z):
    """Half width of the hull at station s and height z (0.0 outside the section)."""
    w, zc, h = section(s)
    k = (z - zc) / h if h > 0 else 2.0
    return w * math.sqrt(1 - k * k) if abs(k) < 1 else 0.0


WINDOW = {'z': 0.62, 'first': 6.55, 'pitch': 0.533, 'last': 29.0, 'w': 0.23, 'h': 0.33, 'r': 0.09}


def window_stations():
    out, k = [], 0
    while WINDOW['first'] + k * WINDOW['pitch'] < WINDOW['last']:
        out.append(WINDOW['first'] + k * WINDOW['pitch'])
        k += 1
    return out
