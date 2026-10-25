import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from aslanair.geometry import (  # noqa: E402
    CABIN,
    COCKPIT_PANES,
    CEILING_Z,
    DOOR_OPEN,
    FLOOR_Z,
    LINER_INSET,
    OVERWING_EXITS,
    TAIL0,
    X,
    backrest_section,
    cabin_wall_inner,
    cushion_section,
    ceiling_z,
    door_hinge,
    door_rect,
    door_skin_grid,
    lumbar,
    fin_root_z,
    hull_half_width_at,
    hull_normal,
    hull_point,
    hull_top,
    floor_half_width,
    liner_grid,
    liner_half_width_at,
    liner_normal,
    section,
    window_centres,
    window_stations,
)


class FuselageSectionTest(unittest.TestCase):
    def test_stations_map_to_x_with_the_nose_forward(self):
        self.assertAlmostEqual(X(0), 18.8)

    def test_constant_section_mid_cabin(self):
        w, zc, h = section(15.0)
        self.assertAlmostEqual(w, 1.975)
        self.assertAlmostEqual(zc, 0.03)
        self.assertAlmostEqual(h, 2.07)
        self.assertAlmostEqual(hull_top(15.0), 2.10)

    def test_half_width_at_height(self):
        self.assertAlmostEqual(hull_half_width_at(15.0, 0.03), 1.975)
        self.assertEqual(hull_half_width_at(15.0, 3.0), 0.0)


class TailAndFinTest(unittest.TestCase):
    def test_tail_cone_starts_behind_the_cabin(self):
        self.assertAlmostEqual(TAIL0, 27.8)

    def test_the_floor_tucks_under_the_wall_but_stays_inside_the_hull(self):
        for s in (5.0, 15.0, 29.5):
            gap = floor_half_width(s) - liner_half_width_at(s, FLOOR_Z)
            self.assertGreater(gap, 0.0)
            self.assertLess(gap, LINER_INSET / 4)

    def test_overwing_exits_are_beside_rows_13_and_14(self):
        rows = [round((s - 7.0) / 0.76) + 1 for s in OVERWING_EXITS]
        self.assertEqual(rows, [13, 14])

    def test_liner_grid_matches_the_liner(self):
        g = liner_grid()
        self.assertAlmostEqual(g['heights'][0], FLOOR_Z)
        i, j = g['stations'].index(15.0), 11
        self.assertAlmostEqual(g['halfWidth'][i][j], round(liner_half_width_at(15.0, g['heights'][j]), 4))

    def test_fin_root_stays_inside_the_skin_above_the_cabin_ceiling(self):
        for s in (28.2, 29.0, 30.0, 31.0, 33.0, 35.0):
            self.assertLess(fin_root_z(s), hull_top(s))
            self.assertGreater(fin_root_z(s), hull_top(s) - LINER_INSET)


class DoorTest(unittest.TestCase):
    def test_door_rect_sits_on_the_cabin_floor(self):
        s0, s1, z0, z1 = door_rect()
        self.assertAlmostEqual(s1 - s0, 0.82)
        self.assertAlmostEqual(z1 - z0, 1.85)
        self.assertAlmostEqual(z0, FLOOR_Z + 0.05)

    def test_open_door_clears_the_hull(self):
        # spec r5 §7: the door stands off the skin by DOOR_OPEN['clear'] all the way forward (the web side follows the
        # skin, aircraftAnimation.doorPose); its 0.06 m panel's inner face keeps at least 2 cm of air, and the forward
        # move takes it clear of the doorway
        s0, s1, _, _ = door_rect()
        self.assertGreaterEqual(DOOR_OPEN['clear'] - 0.06, 0.02)
        self.assertLessEqual(DOOR_OPEN['clear'] - 0.06, 0.12)
        self.assertGreater(DOOR_OPEN['forward'], s1 - s0 + 0.1)

    def test_door_skin_grid_is_the_hull_round_the_door(self):
        s0, s1, z0, z1 = door_rect()
        grid = door_skin_grid()
        self.assertLessEqual(grid['stations'][0], s0 - 1.25)
        self.assertGreaterEqual(grid['stations'][-1], round(s1, 4))
        self.assertLessEqual(grid['heights'][0], z0)
        self.assertGreaterEqual(grid['heights'][-1], round(z1, 4))  # the grid's values are rounded to 0.1 mm
        self.assertEqual(len(grid['halfWidth']), len(grid['stations']))
        for i, j in [(0, 0), (len(grid['stations']) // 2, len(grid['heights']) // 2), (-1, -1)]:
            s, z = grid['stations'][i], grid['heights'][j]
            self.assertAlmostEqual(grid['halfWidth'][i][j], hull_half_width_at(s, z), places=4)

    def test_hinge_is_on_the_forward_edge_at_the_hull_surface(self):
        s0, s1, z0, z1 = door_rect()
        hx, hy, hz = door_hinge()
        self.assertAlmostEqual(hx, X(s0))
        self.assertAlmostEqual(hz, (z0 + z1) / 2)
        self.assertAlmostEqual(hy, hull_half_width_at(s0, hz), places=3)


class CabinShellTest(unittest.TestCase):
    def test_windows_on_both_sides_at_one_height(self):
        self.assertEqual(len(window_centres()), 86)
        self.assertTrue(all(abs(z - 0.62) < 1e-9 for _, z, _ in window_centres()))

    def test_wall_sits_one_inset_inside_the_hull_at_window_height(self):
        self.assertAlmostEqual(cabin_wall_inner(15.0), hull_half_width_at(15.0, 0.62) - 0.10, places=6)
        self.assertGreater(cabin_wall_inner(15.0), 1.75)
        self.assertLess(cabin_wall_inner(15.0), 1.85)

    def test_ceiling_stays_under_the_hull_and_over_the_doors(self):
        self.assertAlmostEqual(ceiling_z(15.0), CEILING_Z)
        for i in range(41):
            s = CABIN['front_station'] + (CABIN['aft_station'] - CABIN['front_station']) * i / 40
            self.assertLessEqual(ceiling_z(s), hull_top(s) - 0.15 + 1e-9)
        s0, s1, z0, z1 = door_rect()
        self.assertGreater(min(ceiling_z(s0), ceiling_z(s1)), z1)
        self.assertGreater(ceiling_z(CABIN['front_station']), FLOOR_Z + 1.9)   # cockpit door fits


class WindowTest(unittest.TestCase):
    def test_window_stations_match_the_livery(self):
        self.assertEqual(len(window_stations()), 43)
        self.assertAlmostEqual(window_stations()[0], 6.55)


class LinerNormalTest(unittest.TestCase):
    def _tangents(self, s, z, side, h=1e-4):
        p = lambda ss, zz: (X(ss), side * liner_half_width_at(ss, zz), zz)
        along = [b - a for a, b in zip(p(s - h, z), p(s + h, z))]
        up = [b - a for a, b in zip(p(s, z - h), p(s, z + h))]
        return along, up

    def test_unit_length_perpendicular_to_the_wall_and_pointing_into_the_cabin(self):
        for s, z, side in ((15.0, 0.62, 1), (15.0, -0.3, -1), (29.5, 0.62, 1), (29.5, 1.2, -1)):
            n = liner_normal(s, z, side)
            self.assertAlmostEqual(sum(c * c for c in n), 1.0)
            for t in self._tangents(s, z, side):
                self.assertAlmostEqual(sum(a * b for a, b in zip(n, t)) / sum(c * c for c in t) ** 0.5, 0.0, places=4)
            self.assertLess(n[1] * side, 0)   # back towards the aisle

    def test_no_fore_aft_tilt_in_the_constant_section(self):
        self.assertAlmostEqual(liner_normal(15.0, 0.62, 1)[0], 0.0)


class HullSurfaceTest(unittest.TestCase):
    def test_points_lie_on_the_hull_port_for_positive_side(self):
        for s, a in ((2.5, 0.6), (4.0, 1.2), (15.0, 2.0)):
            x, y, z = hull_point(s, a, 1)
            self.assertAlmostEqual(x, X(s))
            self.assertGreater(y, 0)
            self.assertAlmostEqual(y, hull_half_width_at(s, z), places=6)
            self.assertAlmostEqual(hull_point(s, a, -1)[1], -y)

    def test_normal_is_unit_and_points_outwards(self):
        for s, a, side in ((2.5, 0.6, 1), (3.5, 1.1, -1), (15.0, 2.0, 1)):
            n = hull_normal(s, a, side)
            self.assertAlmostEqual(sum(c * c for c in n), 1.0)
            x, y, z = hull_point(s, a, side)
            _, zc, _ = section(s)
            self.assertGreater(n[1] * y + n[2] * (z - zc), 0)


class CockpitPanesTest(unittest.TestCase):
    def _signed(self, poly):
        return sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(poly, poly[1:] + poly[:1])) / 2

    def test_panes_are_convex_and_counter_clockwise_in_station_arc_space(self):
        for pane in COCKPIT_PANES:
            self.assertGreater(self._signed(pane), 0)
            for i in range(len(pane)):
                (ax, az), (bx, bz), (cx, cz) = pane[i], pane[(i + 1) % len(pane)], pane[(i + 2) % len(pane)]
                self.assertGreaterEqual((bx - ax) * (cz - bz) - (bz - az) * (cx - bx), 0)

    def test_windshield_halves_leave_a_centre_post(self):
        self.assertAlmostEqual(min(a for _, a in COCKPIT_PANES[0]), 0.07)

    def test_glazing_and_its_frame_stay_ahead_of_door_1l(self):
        s0 = door_rect()[0]
        self.assertLess(max(s for pane in COCKPIT_PANES for s, _ in pane) + 0.035, s0)


if __name__ == '__main__':
    unittest.main()


class SeatProfileTest(unittest.TestCase):
    def test_bolsters_stand_proud_of_the_centre(self):
        for t in (0.2, 0.5, 0.8):
            sec = backrest_section(t)
            centre = min(sec, key=lambda p: abs(p[0]))[1]
            self.assertGreater(max(sec[0][1], sec[-1][1]) - centre, 0.025)

    def test_lumbar_bulges_low_on_the_back(self):
        self.assertGreater(lumbar(0.3), 0.02)
        self.assertGreater(lumbar(0.3), lumbar(0.8))

    def test_cushion_has_a_rolled_front_lip(self):
        front = cushion_section(1.0)
        self.assertLess(front[-1][1], front[-2][1])   # the top falls away at the lip
