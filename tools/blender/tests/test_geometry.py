import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from aslanair.geometry import (  # noqa: E402
    CABIN,
    CEILING_Z,
    DOOR_OPEN,
    FLOOR_Z,
    LINER_INSET,
    TAIL0,
    X,
    cabin_wall_inner,
    ceiling_z,
    door_hinge,
    door_rect,
    fin_root_z,
    hull_half_width_at,
    hull_top,
    liner_half_width_at,
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

    def test_last_rows_fit_inside_the_liner_at_seat_height(self):
        for s in (27.58, 28.36, 29.14, 29.92, 30.17):
            self.assertGreater(liner_half_width_at(s, 0.0), 1.42 + 0.23, msg=f'station {s}')

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
        # plug door: out by DOOR_OPEN['outward'], then forward along the hull by DOOR_OPEN['forward']
        s0, s1, z0, z1 = door_rect()
        for i in range(9):
            s = s0 + (s1 - s0) * i / 8
            for j in range(9):
                z = z0 + (z1 - z0) * j / 8
                inner_face = hull_half_width_at(s, z) + DOOR_OPEN['outward'] - 0.06
                self.assertGreater(inner_face, hull_half_width_at(s - DOOR_OPEN['forward'], z) + 0.02, msg=f'{s:.2f},{z:.2f}')

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


if __name__ == '__main__':
    unittest.main()
