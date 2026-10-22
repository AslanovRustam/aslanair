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
PLINTH = {'height': 0.09, 'inset': 0.004}   # dark skirting band along both walls at floor level
FLOOR_TUCK = 0.005  # the floor runs this far under the wall, so compression never opens a seam there


def floor_half_width(s):
    return liner_half_width_at(s, FLOOR_Z) + FLOOR_TUCK


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


# Cabin kit seat, in metres: heights above the floor, x along the seat's facing (+X = nose).
# The backrest front runs from (x -0.1775, z 0.45) reclined 11° to its top front edge at back_front_top_x.
SEAT_KIT = {'depth': 0.5, 'width': 0.44, 'pan_top': 0.45, 'arm_top': 0.65, 'height': 1.08, 'back_front_top_x': -0.30,
            'cover_drop': 0.24, 'arm_width': 0.05}

# Seat upholstery profiles. Backrest: across the width at height fraction t, as (lateral, depth) with depth measured
# forward from a plane BACK_DISH behind the backrest's front line, so the bolster crests reach the front line.
BACK_DISH = 0.045
BACK_HALF = (SEAT_KIT['width'] - 0.02) / 2
CUSHION = {'back_x': -0.19, 'front_x': 0.24, 'thick': 0.10, 'sag': 0.012, 'lip': 0.035}


def lumbar(t):
    """Forward bulge of the backrest centre at height fraction t: a soft hump low on the back."""
    return 0.025 * math.exp(-((t - 0.3) / 0.15) ** 2)


def _smoothstep(a, b, x):
    u = min(max((x - a) / (b - a), 0.0), 1.0)
    return u * u * (3 - 2 * u)


def backrest_depth(y, t):
    """Forward depth of the backrest front at lateral y and height fraction t: side bolsters reach the front line
    (BACK_DISH), the centre sits back in a dish with the lumbar hump; the bolsters soften towards the top."""
    bolster = BACK_DISH * (1 - 0.25 * _smoothstep(0.85, 1.0, t))
    side = _smoothstep(0.55, 0.95, abs(y) / BACK_HALF)
    centre = lumbar(t) * math.cos(min(abs(y) / (0.7 * BACK_HALF), 1.0) * math.pi / 2) ** 2
    return centre + (bolster - centre) * side


def backrest_section(t, n=11):
    """Front surface of the backrest across its width at height fraction t ∈ [0, 1], as (lateral, depth)."""
    ys = [-BACK_HALF + 2 * BACK_HALF * i / (n - 1) for i in range(n)]
    return [(round(y, 5), round(backrest_depth(y, t), 5)) for y in ys]


def cushion_section(u):
    """Seat pan top along its depth at lateral fraction u (0 centre, 1 side), as (x, height above pan_top):
    a shallow dish in the middle, then a rolled lip falling away at the front."""
    c = CUSHION
    lip_x = c['front_x'] - c['lip']
    pts = []
    for k in range(7):
        x = c['back_x'] + (lip_x - c['back_x']) * k / 6
        dish = c['sag'] * (1 - u * u) * math.sin(math.pi * k / 6) ** 0.7
        pts.append((x, -dish))
    for k in range(1, 5):                           # quarter-round over the lip down the front face
        a = math.pi / 2 * k / 4
        pts.append((lip_x + c['lip'] * math.sin(a), -c['lip'] * (1 - math.cos(a))))
    return [(round(x, 5), round(z, 5)) for x, z in pts]

# Overhead bin, one row long; three.js y / |z|. The outer side follows the constant-section liner
# (in the tail taper it slips behind the liner but stays inside the hull).
BIN = {'length': 0.76, 'bottom_y': 1.10, 'top_y': 1.72, 'aisle_z': 0.98, 'wall_gap': 0.02, 'door_bulge': 0.03}


def bin_profile():
    """Port bin cross-section as (|z|, y): up the bulging aisle door, then down along the wall."""
    b = BIN
    door = [(b['aisle_z'] - b['door_bulge'] * math.sin(math.pi * k / 6), b['bottom_y'] + (b['top_y'] - b['bottom_y']) * k / 6)
            for k in range(7)]
    steps = int(round((b['top_y'] - b['bottom_y']) / 0.1))
    wall_y = [b['top_y'] - (b['top_y'] - b['bottom_y']) * k / steps for k in range(steps + 1)]
    wall = [(liner_half_width_at(15.0, y) - b['wall_gap'], y) for y in wall_y]
    return [(round(z, 4), round(y, 4)) for z, y in door + wall]

# Entry zone (three.js y and |z|). The galley sits on the starboard side opposite door 1L, its outer side on the liner;
# the curtain hangs drawn open from a ceiling track on both sides; exit signs hang over the aisle centreline.
GALLEY = {'s0': 4.05, 's1': 5.75, 'inner_z': 0.32, 'top_y': 1.40, 'worktop_y': 0.10}
CURTAIN = {'station': 6.45, 'inner_z': 0.62, 'outer_z': 0.95, 'bottom_y': -0.25}
EXIT_SIGN = {'w': 0.30, 'h': 0.11, 'd': 0.05, 'y': 1.58, 'placements': [[16.45, 'aft'], [16.45, 'fore'], [30.25, 'fore']]}

# Nose (three.js y and signed z, port negative): the flight-deck door on the front bulkhead, set to port so it clears
# the galley; a folded attendant jump seat beside it, facing aft; an arrowed exit sign over the aisle at door 1L, hung
# lower than the others because the ceiling dips towards the nose.
COCKPIT_DOOR = {'station': 4.0, 'width': 0.80, 'height': 1.90, 'z': -0.10}
JUMP_SEAT = {'station': 4.02, 'z': -0.75, 'width': 0.45, 'height': 1.05}
EXIT_ARROWS = {'station': 4.40, 'y': 1.43, 'w': 0.42}

# Tail (three.js y and |z|): a galley across the aisle end, between two lavatories that run out to the liner, their
# bi-fold doors facing forward; one trolley stands pulled out of its bay into the aisle (station = its centre).
AFT_GALLEY = {'s0': 29.85, 's1': 30.45, 'half_width': 0.70, 'top_y': 1.40}
LAVATORY = {'s0': 29.85, 's1': 30.45, 'inner_z': 0.70}
GALLEY_CART = {'station': 29.55, 'width': 0.30, 'depth': 0.40, 'height': 1.03}


def lavatory_door():
    """The bi-fold door on a lavatory's forward face, as |z| and three.js y: inner edge, fold line, the outer edge
    sampled up the door as (y, |z|), and the occupancy sign above it as (z0, z1, y0, y1)."""
    s0 = LAVATORY['s0']
    inner, width = LAVATORY['inner_z'] + 0.04, 0.62
    bottom, top = FLOOR_Z + 0.02, FLOOR_Z + 1.82
    heights = [bottom + (top - bottom) * k / 8 for k in range(9)]
    fold = inner + width / 2
    # the tail narrows overhead: the outer leaf follows the wall where the wall comes closer than a full-width door
    outer = [(y, min(inner + width, liner_half_width_at(s0, y) - 0.03)) for y in heights]
    return {'inner': inner, 'fold': fold, 'bottom': bottom, 'top': top, 'outer': outer,
            'sign': (fold - 0.07, fold + 0.07, top + 0.06, top + 0.12)}


def lavatory_outline(s):
    """A lavatory's cross-section at station s as (|z|, y): up its inner side, then down along the liner. In the tail
    the liner curves in under the ceiling, so the block stops where the liner meets its inner side."""
    top = ceiling_z(s) - 0.01
    while liner_half_width_at(s, top) - 0.02 < LAVATORY['inner_z'] + 0.01:
        top -= 0.005
    wall_y = [top - (top - FLOOR_Z) * k / 10 for k in range(11)]
    return [(LAVATORY['inner_z'], FLOOR_Z), (LAVATORY['inner_z'], top)] + [(liner_half_width_at(s, y) - 0.02, y) for y in wall_y]
