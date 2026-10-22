import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from aslanair.geometry import X, hull_half_width_at, hull_top, section, window_stations  # noqa: E402


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


class WindowTest(unittest.TestCase):
    def test_window_stations_match_the_livery(self):
        self.assertEqual(len(window_stations()), 43)
        self.assertAlmostEqual(window_stations()[0], 6.55)


if __name__ == '__main__':
    unittest.main()
