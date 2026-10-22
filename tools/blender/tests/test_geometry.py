import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from aslanair.geometry import (  # noqa: E402
    LINER_INSET,
    TAIL0,
    X,
    fin_root_z,
    hull_half_width_at,
    hull_top,
    liner_half_width_at,
    section,
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


class WindowTest(unittest.TestCase):
    def test_window_stations_match_the_livery(self):
        self.assertEqual(len(window_stations()), 43)
        self.assertAlmostEqual(window_stations()[0], 6.55)


if __name__ == '__main__':
    unittest.main()
