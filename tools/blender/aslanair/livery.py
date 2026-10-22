"""Fuselage livery texture."""
import math

import numpy as np

from .geometry import *  # noqa: F401,F403
from .mesh import hex2srgb, image_from, smoothstep

# ---------------------------------------------------------------- livery colours
WHITE, NAVY, ACCENT = '#f1f0ec', '#1b2541', '#d4683a'

# ---------------------------------------------------------------- fuselage livery texture
def poly_sdf(P0, P1, poly):
    pts = np.array(poly, dtype=float)
    area = np.sum(pts[:, 0] * np.roll(pts[:, 1], -1) - np.roll(pts[:, 0], -1) * pts[:, 1])
    if area < 0: pts = pts[::-1]
    d = np.full(P0.shape, -1e9)
    for i in range(len(pts)):
        p, q = pts[i], pts[(i + 1) % len(pts)]
        e = q - p; n = np.array([e[1], -e[0]]) / np.hypot(*e)
        d = np.maximum(d, (P0 - p[0]) * n[0] + (P1 - p[1]) * n[1])
    return d

def paint_livery(W=4096, H=1024):
    s = (np.arange(W) + 0.5) / W * L
    th = (np.arange(H) + 0.5) / H * 2 * np.pi - np.pi        # v=0.5 -> top (theta 0)
    sec = np.array([section(x) for x in s])
    w, zc, h = (sec[:, k][None, :] for k in range(3))
    TH = th[:, None]
    Z = zc + h * np.cos(TH)
    SIDE = np.abs(np.sin(TH))
    S = np.broadcast_to(s[None, :], Z.shape)
    A = np.abs(TH) * h                                        # surface arc from the crown
    img = np.broadcast_to(hex2srgb(WHITE), (H, W, 3)).copy()
    glass = np.zeros((H, W))
    px = 0.011
    def blend(mask, col):
        mask = np.clip(mask, 0, 1)[..., None]; img[:] = img * (1 - mask) + np.asarray(col) * mask
    cov = lambda sdf: np.clip(0.5 - sdf / px, 0, 1)

    # belly + rising cheatline
    zl = -0.78 + 2.05 * smoothstep(17.0, L, S) ** 1.5
    blend(cov(Z - zl), hex2srgb(NAVY))
    blend(cov(zl - Z) * cov(Z - (zl + 0.13)), hex2srgb(ACCENT))

    # panel lines
    seam = np.abs(((S - 3.0) % 2.13) - 1.065) > 1.061
    blend(seam * 0.07 * (S > 2.5) * (S < 34), (0, 0, 0))
    for zz in (1.45, -0.35):
        blend(cov(np.abs(Z - zz) - 0.003) * 0.06 * (SIDE > 0.3), (0, 0, 0))

    def rrect(cs, cz, hw, hh, r, Sv=S):
        qx = np.abs(Sv - cs) - hw + r; qz = np.abs(Z - cz) - hh + r
        return np.hypot(np.maximum(qx, 0), np.maximum(qz, 0)) + np.minimum(np.maximum(qx, qz), 0) - r

    # subtle weathering so the paint does not read as plastic
    rng_ = np.random.default_rng(3)
    lo = rng_.standard_normal((H // 64 + 2, W // 64 + 2))
    yi = np.linspace(0, lo.shape[0] - 1.001, H); xi = np.linspace(0, lo.shape[1] - 1.001, W)
    y0, x0 = yi.astype(int)[:, None], xi.astype(int)[None, :]
    fy, fx = (yi % 1)[:, None], (xi % 1)[None, :]
    mott = (lo[y0, x0] * (1 - fx) * (1 - fy) + lo[y0, x0 + 1] * fx * (1 - fy) + lo[y0 + 1, x0] * (1 - fx) * fy + lo[y0 + 1, x0 + 1] * fx * fy)
    img *= (1 + 0.018 * mott)[..., None]
    grime = np.exp(-(((S - 3.0) % 2.13) / 0.35)) * 0.025 * (S > 3) * (S < 34)
    img *= (1 - grime)[..., None]

    # doors (outline + door window)
    ds0, ds1, dz0, dz1 = door_rect()
    doors = [((ds0 + ds1) / 2, (dz0 + dz1) / 2, (ds1 - ds0) / 2, (dz1 - dz0) / 2, DOOR_1L['radius']), (31.0, 0.35, 0.38, 0.88, 0.16),
             (16.05, 0.40, 0.25, 0.50, 0.10), (16.80, 0.40, 0.25, 0.50, 0.10),
             (8.6, -1.15, 0.9, 0.62, 0.10), (24.3, -1.2, 0.9, 0.62, 0.10)]
    for cs, cz, hw, hh, r in doors:
        d = rrect(cs, cz, hw, hh, r)
        blend(cov(np.abs(d) - 0.006) * 0.55 * (SIDE > 0.55), (0.12, 0.12, 0.13))
    for cs, cz in ((31.0, 0.78),):   # door 1L's window is geometry (door.py)
        d = rrect(cs, cz, 0.11, 0.15, 0.08)
        blend(cov(d - 0.025) * (SIDE > 0.55), (0.78, 0.79, 0.8))
        blend(cov(d) * (SIDE > 0.55), (0.04, 0.05, 0.07)); glass = np.maximum(glass, cov(d) * (SIDE > 0.55))

    # cabin windows: periodic in s
    pitch, s0, s1 = 0.533, 6.55, 29.0
    sm = ((S - s0 + pitch / 2) % pitch) - pitch / 2
    rng = (S > s0 - pitch / 2) & (S < s1)
    d = rrect(0.0, 0.62, 0.115, 0.165, 0.09, Sv=sm)
    blend(cov(d - 0.028) * rng * (SIDE > 0.6), (0.80, 0.81, 0.82))
    # cabin windows are real openings now (openings.py); only the frame ring is painted

    # nose gear doors on the belly
    AB = (np.pi - np.abs(TH)) * h
    q1, q2 = np.abs(S - 3.85) - 0.85, AB - 0.40
    dng = np.hypot(np.maximum(q1, 0), np.maximum(q2, 0)) + np.minimum(np.maximum(q1, q2), 0)
    blend(cov(np.abs(dng) - 0.005) * 0.5, (0.06, 0.07, 0.1))
    blend(cov(AB - 0.004) * (np.abs(S - 3.85) < 0.85) * 0.5, (0.06, 0.07, 0.1))

    # cockpit glazing is geometry (cockpit.py)
    rough = 0.32 - 0.27 * glass
    return image_from('livery', img), image_from('livery_rough', np.repeat(rough[..., None], 3, axis=2))
