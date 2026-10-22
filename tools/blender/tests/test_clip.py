import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from aslanair.clip import area, intersect_convex, subtract_convex  # noqa: E402

SQUARE = [(0.0, 0.0, 0.0), (4.0, 0.0, 1.0), (4.0, 4.0, 2.0), (0.0, 4.0, 1.0)]  # (x, z, payload)
HOLE = [(1.0, 1.0), (3.0, 1.0), (3.0, 3.0), (1.0, 3.0)]                        # convex, counter-clockwise


class ClipTest(unittest.TestCase):
    def test_intersection_keeps_only_the_inside(self):
        inside = intersect_convex(SQUARE, HOLE)
        self.assertAlmostEqual(area(inside), 4.0)

    def test_subtraction_tiles_the_rest_without_overlap(self):
        pieces = subtract_convex(SQUARE, HOLE)
        self.assertAlmostEqual(sum(area(p) for p in pieces), 12.0)

    def test_disjoint_shapes_pass_through(self):
        far = [(10.0, 10.0), (11.0, 10.0), (11.0, 11.0), (10.0, 11.0)]
        self.assertEqual(intersect_convex(SQUARE, far), [])
        pieces = subtract_convex(SQUARE, far)
        self.assertEqual(len(pieces), 1)
        self.assertAlmostEqual(area(pieces[0]), 16.0)

    def test_payload_is_interpolated_along_edges(self):
        inside = intersect_convex(SQUARE, [(2.0, -1.0), (5.0, -1.0), (5.0, 5.0), (2.0, 5.0)])
        corner = min(inside, key=lambda p: (p[0], p[1]))   # the new vertex at (2, 0)
        self.assertAlmostEqual(corner[0], 2.0)
        self.assertAlmostEqual(corner[2], 0.5)              # halfway between payload 0 and 1


if __name__ == '__main__':
    unittest.main()
