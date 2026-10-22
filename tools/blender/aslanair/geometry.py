"""Pure aircraft geometry (Blender coordinates: X = L/2 - s, +Y port, Z up). No bpy."""
import math

# ---------------------------------------------------------------- dimensions (m)
L = 37.6                    # length
RW, RT, RB = 1.975, 2.10, 2.04
NOSE_Z = -0.55
TAIL0 = 27.8                # start of tail cone (keeps rows 27-30 inside the full section)
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


def hull_point(s, a, side):
    """Point on the hull at station s, surface coordinate a = |θ|·h from the crown, on side +1 (port, +Y) or -1."""
    w, zc, h = section(s)
    t = -side * a / h
    return (X(s), -w * math.sin(t), zc + h * math.cos(t))


def hull_normal(s, a, side, e=1e-4):
    """Outward unit normal of the hull at (s, a) on the given side."""
    p = hull_point(s, a, side)
    ds = [q - r for q, r in zip(hull_point(s + e, a, side), hull_point(s - e, a, side))]
    da = [q - r for q, r in zip(hull_point(s, a + e, side), hull_point(s, a - e, side))]
    n = (ds[1] * da[2] - ds[2] * da[1], ds[2] * da[0] - ds[0] * da[2], ds[0] * da[1] - ds[1] * da[0])
    _, zc, _ = section(s)
    if n[1] * p[1] + n[2] * (p[2] - zc) < 0:
        n = tuple(-c for c in n)
    length = sum(c * c for c in n) ** 0.5
    return tuple(c / length for c in n)


def crown_arc(s, z):
    """Surface coordinate a = |θ|·h (the livery's arc from the crown) of height z at station s."""
    w, zc, h = section(s)
    return math.acos(max(-1.0, min(1.0, (z - zc) / h))) * h


# cockpit glazing in (s, a), mirrored on both sides: windshield (0.14 m centre post), sliding window, rear side window
COCKPIT_PANES = [
    [(2.06, 0.07), (2.72, 0.07), (3.06, crown_arc(3.06, 1.0)), (2.50, crown_arc(2.50, 0.58))],
    [(3.26, crown_arc(3.26, 1.00)), (3.92, crown_arc(3.92, 0.92)), (3.92, crown_arc(3.92, 0.58)), (3.26, crown_arc(3.26, 0.58))],
    [(4.02, crown_arc(4.02, 0.90)), (4.40, crown_arc(4.40, 0.80)), (4.40, crown_arc(4.40, 0.58)), (4.02, crown_arc(4.02, 0.58))],
]

FLOOR_Z = -0.45
LINER_INSET = 0.10           # cabin shell sits this far inside the hull
FIN_ROOT_INSET = 0.08        # fin root is buried this far below the hull top


def liner_half_width_at(s, z):
    return max(0.0, hull_half_width_at(s, z) - LINER_INSET)


def liner_normal(s, z, side, h=1e-4):
    """Unit normal of the liner surface y = side·w(s, z), pointing back into the cabin (Blender X, Y, Z)."""
    dw_dx = -(liner_half_width_at(s + h, z) - liner_half_width_at(s - h, z)) / (2 * h)   # X runs nose-ward
    dw_dz = (liner_half_width_at(s, z + h) - liner_half_width_at(s, z - h)) / (2 * h)
    n = (side * dw_dx, -1.0, side * dw_dz)   # (1, side·w_x, 0) × (0, side·w_z, 1), then made inward
    n = (-n[0], n[1] * side, -n[2]) if side < 0 else n
    length = sum(c * c for c in n) ** 0.5
    return tuple(c / length for c in n)


def fin_root_z(s):
    return hull_top(s) - FIN_ROOT_INSET


# Door 1L (port, Blender +Y): plug door from the cabin floor, hinged on its forward edge.
DOOR_1L = {'station': 4.9, 'width': 0.82, 'height': 1.85, 'sill': FLOOR_Z + 0.05, 'radius': 0.15, 'side': 1}
# Plug door opening, like the real thing: out from the skin, then forward, staying parallel to the hull.
DOOR_OPEN = {'outward': 0.35, 'forward': 1.0}


def door_rect():
    """(s_min, s_max, z_min, z_max) of the doorway."""
    d = DOOR_1L
    return d['station'] - d['width'] / 2, d['station'] + d['width'] / 2, d['sill'], d['sill'] + d['height']


def door_hinge():
    """Hinge point in Blender coordinates: forward edge, mid height, on the hull surface."""
    s0, _, z0, z1 = door_rect()
    hz = (z0 + z1) / 2
    return X(s0), DOOR_1L['side'] * hull_half_width_at(s0, hz), hz


WINDOW = {'z': 0.62, 'first': 6.55, 'pitch': 0.533, 'last': 29.0, 'w': 0.23, 'h': 0.33, 'r': 0.09}


def window_stations():
    out, k = [], 0
    while WINDOW['first'] + k * WINDOW['pitch'] < WINDOW['last']:
        out.append(WINDOW['first'] + k * WINDOW['pitch'])
        k += 1
    return out


def window_centres():
    """(station, z, side) for every cabin window; side +1 = port (+Y), -1 = starboard."""
    return [(s, WINDOW['z'], side) for side in (1, -1) for s in window_stations()]


# Cabin shell: from just ahead of door 1L to just behind row 30. The crown only reaches full
# height aft of ~5 m, so the ceiling drops to stay CEILING_HULL_CLEARANCE under the hull there.
CABIN = {'front_station': 4.0, 'aft_station': 30.5}
CEILING_Z = 1.75
CEILING_HULL_CLEARANCE = 0.15


def ceiling_z(s):
    return min(CEILING_Z, hull_top(s) - CEILING_HULL_CLEARANCE)


def cabin_wall_inner(s):
    """Inner wall |y| at window height."""
    return liner_half_width_at(s, WINDOW['z'])


SHELL_STEP = 0.25   # station spacing of the shell grid


def shell_stations():
    """Stations of the shell grid, front to aft bulkhead."""
    out, s = [], CABIN['front_station']
    while s < CABIN['aft_station'] - 1e-9:
        out.append(s)
        s += SHELL_STEP
    out.append(CABIN['aft_station'])
    return out


def liner_grid():
    """Liner half-width on the shell stations × heights (three.js y = Blender Z) from the floor to the ceiling, every 0.1 m."""
    heights = [round(FLOOR_Z + 0.1 * j, 4) for j in range(int(round((CEILING_Z - FLOOR_Z) / 0.1)) + 1)]
    stations = shell_stations()
    return {'stations': [round(s, 4) for s in stations], 'heights': heights,
            'halfWidth': [[round(liner_half_width_at(s, z), 4) for z in heights] for s in stations]}


# over-wing emergency exits (painted outlines), beside rows 13 and 14
OVERWING_EXITS = [16.05, 16.80]

