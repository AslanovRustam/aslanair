"""Aircraft parts: fuselage, wings, tail, engines, details."""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector

from . import context as ctx
from .geometry import *  # noqa: F401,F403
from .livery import ACCENT, NAVY, WHITE, paint_livery
from .mesh import *  # noqa: F401,F403
from .cabin import build_cabin
from .door import make_door_1l
from .openings import cut_hull_windows, make_window_glass

# ---------------------------------------------------------------- fuselage
def fuselage(mat):
    S = [6.2 * (i / 60) ** 1.8 for i in range(1, 61)]
    S += list(np.arange(6.45, TAIL0, 0.25)) + [TAIL0 + (L - TAIL0) * i / 90 for i in range(1, 91)]
    segs = 96
    verts = [(X(0.0), 0.0, NOSE_Z)]
    for s in S:
        w, zc, h = section(s)
        for j in range(segs):
            t = 2 * math.pi * j / segs
            verts.append((X(s), -w * math.sin(t), zc + h * math.cos(t)))
    vv = lambda j: (2 * math.pi * j / segs + math.pi) / (2 * math.pi)
    R = lambda i, j: 1 + i * segs + (j % segs)
    faces, fuv = [], []
    for j in range(segs):
        faces.append((0, R(0, j), R(0, j + 1)))
        fuv.append([(0, vv(j + 0.5)), (S[0] / L, vv(j)), (S[0] / L, vv(j + 1))])
    for i in range(len(S) - 1):
        a, b = S[i] / L, S[i + 1] / L
        for j in range(segs):
            faces.append((R(i, j), R(i + 1, j), R(i + 1, j + 1), R(i, j + 1)))
            fuv.append([(a, vv(j)), (b, vv(j)), (b, vv(j + 1)), (a, vv(j + 1))])
    _, zc, _ = section(L)
    verts.append((X(L + 0.2), 0.0, zc)); c = len(verts) - 1
    n = len(S) - 1
    for j in range(segs):
        faces.append((R(n, j), c, R(n, j + 1)))
        fuv.append([(1, vv(j)), (1, vv(j + 0.5)), (1, vv(j + 1))])
    return make_mesh('Fuselage', verts, faces, fuv, mat, sharp=None)

# ---------------------------------------------------------------- lifting surfaces
def airfoil(t, m=0.02, p=0.4, n=40):
    xs = [0.5 * (1 - math.cos(math.pi * i / n)) for i in range(n + 1)]
    yt = lambda x: 5 * t * (0.2969 * math.sqrt(x) - 0.1260 * x - 0.3516 * x ** 2 + 0.2843 * x ** 3 - 0.1036 * x ** 4)
    yc = lambda x: 0.0 if m == 0 else ((m / p ** 2) * (2 * p * x - x * x) if x < p else (m / (1 - p) ** 2) * ((1 - 2 * p) + 2 * p * x - x * x))
    up = [(x, yc(x) + yt(x)) for x in xs]
    lo = [(x, yc(x) - yt(x)) for x in xs]
    return up[::-1] + lo[1:-1]

def place(af, le, c, ndir, tau=0.0):
    cdir = Vector((-1, 0, 0)); out = []
    for x, z in af:
        dx = x - 0.25
        xr = 0.25 + dx * math.cos(tau) - z * math.sin(tau)
        zr = dx * math.sin(tau) + z * math.cos(tau)
        out.append(le + cdir * (xr * c) + ndir * (zr * c))
    return out

def loft(name, sections, mat, uv=False):
    K = len(sections[0]); verts = [tuple(p) for sec in sections for p in sec]
    faces, fuv = [], []
    ns = len(sections)
    for i in range(ns - 1):
        for j in range(K):
            faces.append((i * K + j, i * K + (j + 1) % K, (i + 1) * K + (j + 1) % K, (i + 1) * K + j))
            fuv.append([(j / K, i / (ns - 1)), ((j + 1) / K, i / (ns - 1)), ((j + 1) / K, (i + 1) / (ns - 1)), (j / K, (i + 1) / (ns - 1))])
    faces.append(tuple(range(K))[::-1]); fuv.append([(0.5, 0.0)] * K)
    faces.append(tuple(range((ns - 1) * K, ns * K))); fuv.append([(0.5, 1.0)] * K)
    return make_mesh(name, verts, faces, fuv if uv else None, mat)

def nvec(sy, phi):  # thickness direction for a surface with local dihedral phi
    return Vector((0, -sy * math.sin(phi), math.cos(phi)))

WING_DIH = math.radians(5)
def le_s(y): return 13.4 + (y - 1.9) * math.tan(math.radians(27))
def te_s(y): return 20.4 + (y - 1.9) * math.tan(math.radians(5)) if y <= 6.3 else 20.785 + (y - 6.3) * 0.166
def zst(y): return -1.25 + (y - 1.9) * math.tan(WING_DIH)

def wing(sy, mat):
    secs = []
    for y in WING_Y:
        c = te_s(y) - le_s(y)
        t = float(np.interp(y, [1.0, 6.3, 16.9], [0.15, 0.13, 0.105]))
        tau = math.radians(float(np.interp(y, [1.0, 16.9], [-2.0, 1.2])))
        secs.append(place(airfoil(t), Vector((X(le_s(y)), sy * y, zst(y))), c, nvec(sy, WING_DIH), tau))
    # blended winglet: arc then straight, swept back
    y0, z0, R = 16.9, zst(16.9), 0.5
    cy, cz = y0 - R * math.sin(WING_DIH), z0 + R * math.cos(WING_DIH)
    path = []
    for k in range(1, 9):
        phi = WING_DIH + (math.radians(76) - WING_DIH) * k / 8
        path.append((cy + R * math.sin(phi), cz - R * math.cos(phi), phi))
    ye, ze, pe = path[-1]
    for k in range(1, 5):
        d = 2.0 * k / 4
        path.append((ye + d * math.cos(pe), ze + d * math.sin(pe), pe))
    total = len(path)
    for k, (yy, zz, phi) in enumerate(path, 1):
        g = k / total
        c = 1.5 - 0.95 * g
        les = le_s(16.9) + 2.0 * g ** 1.2
        secs.append(place(airfoil(0.105 - 0.025 * g), Vector((X(les), sy * yy, zz)), c, nvec(sy, phi), math.radians(1.2)))
    return loft('Wing_' + ('L' if sy > 0 else 'R'), secs, mat, uv=True)

STAB_Y = [0.3, 0.9, 2.5, 4.3, 6.2]
def paint_stab(N=1024):
    u = (np.arange(N) + 0.5) / N; v = (np.arange(N) + 0.5) / N
    xc = 0.5 * (1 - np.cos(np.pi * (1 - 2 * u)))[None, :]
    y = np.interp(v * (len(STAB_Y) - 1), np.arange(len(STAB_Y)), STAB_Y)[:, None]
    C = np.interp(y, [0.3, 0.9, 6.2], [4.2, 3.9, 1.35])
    img = np.broadcast_to(hex2srgb('#c4c8cd'), (N, N, 3)).copy()
    def blend(mask, col):
        mask = np.clip(mask, 0, 1)[..., None]; img[:] = img * (1 - mask) + np.asarray(col) * mask
    blend((xc < 0.05) * np.ones_like(y), hex2srgb('#a9aeb5'))
    blend(np.clip(0.5 - (np.abs(xc - 0.72) * C - 0.006) / 0.004, 0, 1) * ((y > 1.0) & (y < 6.1)) * 0.45, (0.22, 0.23, 0.25))
    for yy in (1.0, 3.6, 6.1):
        blend(np.clip(0.5 - (np.abs(y - yy) - 0.006) / 0.006, 0, 1) * (xc > 0.72) * 0.45, (0.22, 0.23, 0.25))
    return image_from('stab_livery', img)

def hstab(sy, mat):
    dih = math.radians(6); secs = []
    for y in STAB_Y:
        les = 31.0 + (y - 0.9) * math.tan(math.radians(32))
        c = float(np.interp(y, [0.3, 0.9, 6.2], [4.2, 3.9, 1.35]))
        t = float(np.interp(y, [0.3, 6.2], [0.10, 0.09]))
        secs.append(place(airfoil(t, m=0), Vector((X(les), sy * y, 0.55 + (y - 0.9) * math.tan(dih))), c, nvec(sy, dih)))
    return loft('HStab_' + ('L' if sy > 0 else 'R'), secs, mat, uv=True)

FIN_Z = [1.2, 1.9, 3.5, 5.5, 7.8]
def fin_le(z): return 28.6 + (z - 1.9) * math.tan(math.radians(35))
def fin_c(z): return float(np.interp(z, [1.2, 1.9, 7.8], [6.8, 6.4, 2.1]))
FIN_ROOT_PLANFORM_Z = 1.6  # chord/LE of the root section; its points then drop onto fin_root_z
def vfin(mat):
    root = place(airfoil(0.11, m=0), Vector((X(fin_le(FIN_ROOT_PLANFORM_Z)), 0, 0)), fin_c(FIN_ROOT_PLANFORM_Z), Vector((0, 1, 0)))
    root = [Vector((p.x, p.y, fin_root_z(L / 2 - p.x))) for p in root]
    secs = [root] + [place(airfoil(0.11, m=0), Vector((X(fin_le(z)), 0, z)), fin_c(z), Vector((0, 1, 0))) for z in FIN_Z[1:]]
    return loft('Fin', secs, mat, uv=True)

def paint_fin(N=1024):
    u = (np.arange(N) + 0.5) / N; v = (np.arange(N) + 0.5) / N
    xc = 0.5 * (1 - np.cos(np.pi * (1 - 2 * u)))[None, :]
    z = np.interp(v, np.linspace(0, 1, len(FIN_Z)), FIN_Z)[:, None]
    S = (28.6 + (z - 1.9) * math.tan(math.radians(35))) + xc * np.interp(z, [1.2, 1.9, 7.8], [6.8, 6.4, 2.1])
    Z = np.broadcast_to(z, S.shape)
    img = np.broadcast_to(hex2srgb(NAVY), (N, N, 3)).copy()
    px = 0.012
    def blend(mask, col):
        mask = np.clip(mask, 0, 1)[..., None]; img[:] = img * (1 - mask) + np.asarray(col) * mask
    cs, cz, r = 32.55, 4.55, 1.15
    disk = np.hypot(S - cs, Z - cz) - r
    blend(np.clip(0.5 - disk / px, 0, 1), hex2srgb(ACCENT))
    for zz, hh in ((cz - 0.30, 0.07), (cz - 0.62, 0.07)):
        band = np.abs(Z - zz) - hh
        blend(np.clip(0.5 - band / px, 0, 1) * np.clip(0.5 - (disk - 0.0) / px, 0, 1), hex2srgb(NAVY))
    Cz = np.interp(z, [1.2, 1.9, 7.8], [6.8, 6.4, 2.1])
    rud = np.clip(0.5 - (np.abs(xc - 0.70) * Cz - 0.006) / px, 0, 1) * ((Z > 1.95) & (Z < 7.7))
    blend(rud * 0.45, (0.04, 0.06, 0.1))
    return image_from('fin_livery', img)

WING_Y = [1.0, 1.9, 3.2, 4.6, 6.3, 8.0, 10.0, 12.0, 14.0, 15.6, 16.9]
N_WL = 12
def paint_wing(NU=2048, NV=2048):
    u = (np.arange(NU) + 0.5) / NU; v = (np.arange(NV) + 0.5) / NV
    ns = len(WING_Y) + N_WL
    idx = v * (ns - 1)
    ys = np.interp(idx, np.arange(len(WING_Y)), WING_Y)
    Y = ys[:, None]; WL = (idx > len(WING_Y) - 1 + 0.2)[:, None]
    xc = 0.5 * (1 - np.cos(np.pi * (1 - 2 * u))); XC = xc[None, :]; UP = (u < 0.5)[None, :]
    C = np.array([te_s(y) - le_s(y) for y in ys])[:, None]
    PXC = np.maximum(C * np.pi * np.abs(np.sin(np.pi * (1 - 2 * u)))[None, :] / NU, 0.002)
    PXS = np.maximum(np.gradient(ys) , 1e-4)[:, None]
    img = np.broadcast_to(hex2srgb('#c4c8cd'), (NV, NU, 3)).copy()
    def blend(mask, col):
        mask = np.clip(mask, 0, 1)[..., None]; img[:] = img * (1 - mask) + np.asarray(col) * mask
    blend((XC < 0.05) * ~WL, hex2srgb('#a9aeb5'))
    def along(xc0, y0, y1, a=0.45, w=0.012, up=None):
        m = np.clip(0.5 - (np.abs(XC - xc0) * C - w / 2) / PXC, 0, 1) * ((Y >= y0) & (Y <= y1)) * ~WL
        if up is not None: m = m * (UP if up else ~UP)
        blend(m * a, (0.22, 0.23, 0.25))
    def across(yy, xc0, xc1, a=0.45, w=0.012, up=None):
        m = np.clip(0.5 - (np.abs(Y - yy) - w / 2) / PXS, 0, 1) * ((XC >= xc0) & (XC <= xc1)) * ~WL
        if up is not None: m = m * (UP if up else ~UP)
        blend(m * a, (0.22, 0.23, 0.25))
    along(0.12, 2.6, 16.6)
    for yy in (2.6, 6.0, 8.6, 11.0, 13.4, 15.2, 16.6): across(yy, 0.0, 0.12)
    along(0.76, 2.0, 15.9)
    for yy in (2.0, 6.3, 13.1, 15.9): across(yy, 0.76, 1.0)
    along(0.60, 3.0, 12.6, up=True)
    for yy in (3.0, 4.6, 6.3, 7.9, 9.5, 11.0, 12.6): across(yy, 0.60, 0.76, up=True)
    along(0.35, 1.9, 16.6, a=0.12, w=0.008)
    blend(WL * np.ones_like(XC), hex2srgb(NAVY))
    return image_from('wing_livery', img)

# ---------------------------------------------------------------- engines
def lathe(name, prof, axis, front_s, mat, segs=64):
    ay, az = axis; verts, faces = [], []
    for xl, r in prof:
        r = max(r, 0.001)
        for j in range(segs):
            a = 2 * math.pi * j / segs
            verts.append((X(front_s + xl), ay + r * math.cos(a), az + r * math.sin(a)))
    cum = np.concatenate([[0], np.cumsum(np.hypot(np.diff([p[0] for p in prof]), np.diff([p[1] for p in prof])))])
    vs = cum / max(cum[-1], 1e-6); fuv = []
    for i in range(len(prof) - 1):
        for j in range(segs):
            a, b = i * segs + j, i * segs + (j + 1) % segs
            c, d = (i + 1) * segs + (j + 1) % segs, (i + 1) * segs + j
            faces.append((a, d, c, b))
            u0, u1 = j / segs, (j + 1) / segs
            fuv.append([(u0, vs[i]), (u0, vs[i + 1]), (u1, vs[i + 1]), (u1, vs[i])])
    return make_mesh(name, verts, faces, fuv, mat, recalc=False, sharp=50)

def prof_v(prof, xl):
    cum = np.concatenate([[0], np.cumsum(np.hypot(np.diff([p[0] for p in prof]), np.diff([p[1] for p in prof])))])
    return float(np.interp(xl, [p[0] for p in prof], cum / cum[-1]))

COWL = [(0.18, 1.045), (0.6, 1.08), (1.3, 1.09), (2.2, 1.04), (2.9, 0.92), (3.35, 0.79)]
SPIN = [(0.14, 0.001), (0.2, 0.1), (0.3, 0.2), (0.42, 0.27), (0.55, 0.30), (0.63, 0.30)]
def paint_cowl(N=1024):
    v = ((np.arange(N) + 0.5) / N)[:, None]; u = ((np.arange(N) + 0.5) / N)[None, :]
    img = np.broadcast_to(hex2srgb(NAVY), (N, N, 3)).copy()
    def blend(mask, col):
        mask = np.clip(mask, 0, 1)[..., None]; img[:] = img * (1 - mask) + np.asarray(col) * mask
    a0, a1 = prof_v(COWL, 0.32), prof_v(COWL, 0.42)
    blend(((v > a0) & (v < a1)) * np.ones_like(u), hex2srgb(ACCENT))
    for xl in (1.25, 2.35):
        blend(np.clip(0.5 - (np.abs(v - prof_v(COWL, xl)) - 0.0012) / 0.001, 0, 1) * 0.6 * np.ones_like(u), (0.03, 0.04, 0.07))
    for uu in (0.25, 0.75):
        blend(np.clip(0.5 - (np.abs(u - uu) - 0.0008) / 0.001, 0, 1) * (v > prof_v(COWL, 1.25)) * 0.5, (0.03, 0.04, 0.07))
    return image_from('cowl_livery', img)

def paint_spinner(N=512):
    v = ((np.arange(N) + 0.5) / N)[:, None]; u = ((np.arange(N) + 0.5) / N)[None, :]
    img = np.broadcast_to(hex2srgb('#20242b'), (N, N, 3)).copy()
    d = np.abs(((u + v * 0.9) % 1.0) - 0.5)
    m = np.clip(0.5 - (d - 0.06 * (0.3 + v)) / 0.004, 0, 1) * (v > 0.05)
    img = img * (1 - m[..., None]) + np.array([0.93, 0.93, 0.92]) * m[..., None]
    return image_from('spinner_livery', img)

def fan_blades(name, axis, front_s, mat, n=22):
    ay, az = axis; verts, faces = [], []
    radial = np.linspace(0.30, 0.83, 6)
    for b in range(n):
        base = 2 * math.pi * b / n
        for k, r in enumerate(radial):
            twist = math.radians(float(np.interp(r, [0.3, 0.83], [58, 28])))
            chord = float(np.interp(r, [0.3, 0.83], [0.22, 0.34]))
            for side in (-0.5, 0.5):
                da = side * chord * math.cos(twist) / r
                dx = side * chord * math.sin(twist)
                a = base + da
                verts.append((X(front_s + 0.5) + dx, ay + r * math.cos(a), az + r * math.sin(a)))
        o = b * len(radial) * 2
        for k in range(len(radial) - 1):
            i0 = o + 2 * k
            faces.append((i0, i0 + 1, i0 + 3, i0 + 2))
    return make_mesh(name, verts, faces, None, mat, recalc=False, sharp=None)

def rounded_section(sv, y, zb, zt, hw, n=4):
    pts = []; r = min(hw, (zt - zb) / 2) * 0.95
    for cx, cz, a0 in ((hw - r, zt - r, 0), (-hw + r, zt - r, 90), (-hw + r, zb + r, 180), (hw - r, zb + r, 270)):
        for k in range(n):
            a = math.radians(a0 + 90 * k / (n - 1))
            pts.append(Vector((X(sv), y + cx + r * math.cos(a), cz + r * math.sin(a))))
    return pts

def engine(sy, M):
    y, az, fs = sy * 5.75, -2.39, 12.6
    lathe(f'Inlet_{sy}', [(0.62, 0.84), (0.35, 0.855), (0.18, 0.875)], (y, az), fs, M['duct'])
    lathe(f'Lip_{sy}', [(0.18, 0.875), (0.05, 0.905), (0.0, 0.95), (0.03, 1.0), (0.18, 1.045)], (y, az), fs, M['lip'])
    lathe(f'Cowl_{sy}', COWL, (y, az), fs, M['cowl'])
    lathe(f'Bypass_{sy}', [(3.35, 0.79), (3.2, 0.76), (2.8, 0.74)], (y, az), fs, M['duct'])
    lathe(f'Core_{sy}', [(2.8, 0.62), (3.3, 0.64), (3.9, 0.52), (4.05, 0.49), (4.05, 0.37), (4.5, 0.2), (4.85, 0.03)], (y, az), fs, M['exhaust'])
    lathe(f'FanDisk_{sy}', [(0.64, 0.001), (0.64, 0.845)], (y, az), fs, M['duct'], segs=48)
    lathe(f'Spinner_{sy}', SPIN, (y, az), fs, M['spinner'], segs=48)
    fan_blades(f'Fan_{sy}', (y, az), fs, M['fan'])
    secs = [rounded_section(13.3, y, -1.33, -1.20, 0.13), rounded_section(14.3, y, -1.33, -0.95, 0.23),
            rounded_section(15.3, y, -1.33, -0.80, 0.25), rounded_section(16.2, y, -1.62, -0.85, 0.22),
            rounded_section(17.6, y, -1.78, -0.95, 0.16), rounded_section(19.0, y, -1.28, -1.02, 0.06)]
    loft(f'Pylon_{sy}', secs, M['navy'])

def ellipsoid(name, centre, scale, mat, u=48, v=24):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=1.0)
    for vert in bm.verts:
        vert.co = Vector((vert.co.x * scale[0] + centre[0], vert.co.y * scale[1] + centre[1], vert.co.z * scale[2] + centre[2]))
    bm.to_mesh(me); bm.free()
    me.shade_smooth(); me.materials.append(mat)
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob); ctx.PARTS.append(ob)
    return ob

def details(M):
    def blade(name, s, top, h=0.30, c=0.42):
        w, zc, hh = section(s); sgn = 1 if top else -1
        z0 = zc + sgn * (hh - 0.04)
        secs = [place(airfoil(0.14, m=0, n=12), Vector((X(s + 0.2 * k), 0, z0 + sgn * k * h)), c * (1 - 0.55 * k), Vector((0, 1, 0)))
                for k in (0.0, 1.0)]
        loft(name, secs, M['grey'])
    for i, s_ in enumerate((8.5, 14.0, 21.5)): blade(f'AntTop{i}', s_, True)
    for i, s_ in enumerate((6.0, 26.5)): blade(f'AntBot{i}', s_, False, h=0.22, c=0.35)
    w, zc, hh = section(17.5)
    ellipsoid('BeaconTop', (X(17.5), 0, zc + hh), (0.14, 0.14, 0.07), M['lamp_red'], 16, 8)
    ellipsoid('BeaconBot', (X(12.0), 0, -2.21), (0.14, 0.14, 0.07), M['lamp_red'], 16, 8)
    for sy, lamp in ((1, 'lamp_red'), (-1, 'lamp_green')):
        ellipsoid(f'Nav_{sy}', (X(le_s(16.9) - 0.05), sy * 16.98, zst(16.9) + 0.02), (0.14, 0.06, 0.06), M[lamp], 16, 8)
    _, zt, _ = section(L)
    ellipsoid('TailStrobe', (X(L + 0.05), 0, zt), (0.08, 0.08, 0.08), M['lamp_white'], 12, 6)
    lathe('APU', [(0.0, 0.215), (0.2, 0.205), (0.2, 0.15)], (0, zt), L - 0.12, M['exhaust'], segs=32)



def build_aircraft():
    """Builds every part; returns the root empty."""
    ctx.log('painting textures')
    LIV = paint_livery()
    M = {
        'livery': material('Livery', rough=0.3, coat=0.6, image=LIV[0], rough_image=LIV[1]),
        'stab': material('StabPaint', rough=0.42, metal=0.25, coat=0.3, image=paint_stab()),
        'cowl': material('CowlPaint', rough=0.32, coat=0.6, image=paint_cowl()),
        'lamp_red': material('LampRed', '#ff2a1e', rough=0.1, emit=4.0),
        'lamp_green': material('LampGreen', '#20ff6a', rough=0.1, emit=4.0),
        'lamp_white': material('LampWhite', '#ffffff', rough=0.1, emit=4.0),
        'fin': material('FinLivery', rough=0.3, coat=0.6, image=paint_fin()),
        'wing': material('WingPaint', rough=0.42, metal=0.25, coat=0.3, image=paint_wing()),
        'grey': material('Grey', '#c4c8cd', rough=0.42, metal=0.25, coat=0.3),
        'navy': material('Navy', NAVY, rough=0.32, coat=0.6),
        'lip': material('Lip', '#d9dbde', rough=0.16, metal=1.0),
        'duct': material('Duct', '#2a2d33', rough=0.55, metal=0.3, double=True),
        'fan': material('FanBlades', '#5c6168', rough=0.3, metal=0.9, double=True),
        'spinner': material('Spinner', rough=0.3, metal=0.6, image=paint_spinner()),
        'exhaust': material('Exhaust', '#4a4540', rough=0.5, metal=0.8, double=True),
    }
    for k in ('lip', 'navy'):
        pass
    ctx.log('building geometry')
    fus = fuselage(M['livery'])
    make_door_1l(fus)
    cut_hull_windows(fus)
    make_window_glass()
    build_cabin()
    for sy in (1, -1):
        wing(sy, M['wing']); hstab(sy, M['stab']); engine(sy, M)
        for y in (6.6, 10.0, 13.4):
            ellipsoid(f'Canoe_{sy}_{y}', (X(te_s(y) + 0.35), sy * y, zst(y) - 0.2), (1.9, 0.13, 0.19), M['grey'], 24, 12)
    vfin(M['fin'])
    details(M)
    ellipsoid('BellyFairing', (X(17.3), 0, -1.55), (7.4, 1.98, 0.95), M['navy'], 64, 32)
    root = bpy.data.objects.new('Airliner', None); bpy.context.scene.collection.objects.link(root)
    for ob in ctx.PARTS: ob.parent = root
    tris = sum(len(p.vertices) - 2 for ob in ctx.PARTS for p in ob.data.polygons)
    ctx.log(f'{len(ctx.PARTS)} parts, ~{tris} triangles')
    return root
