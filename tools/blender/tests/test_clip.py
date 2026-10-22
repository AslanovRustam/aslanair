import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from aslanair.clip import area, boundary_ring, close_t_junctions, intersect_convex, offset_convex, subtract_convex  # noqa: E402

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


def _open_edges(polys):
    """Undirected (x, z) edges used by exactly one polygon."""
    count = {}
    for poly in polys:
        for i in range(len(poly)):
            a, b = poly[i][:2], poly[(i + 1) % len(poly)][:2]
            key = tuple(sorted((tuple(round(c, 9) for c in a), tuple(round(c, 9) for c in b))))
            count[key] = count.get(key, 0) + 1
    return [e for e, n in count.items() if n == 1]


def _on_square_border(edge):
    (x0, z0), (x1, z1) = edge
    return (x0 == x1 and x0 in (0.0, 4.0)) or (z0 == z1 and z0 in (0.0, 4.0))


def _halves(outline):
    """SQUARE split at x = 2 into two quads, each minus the outline."""
    left = [(0.0, 0.0, 0.0), (2.0, 0.0, 0.5), (2.0, 4.0, 1.5), (0.0, 4.0, 1.0)]
    right = [(2.0, 0.0, 0.5), (4.0, 0.0, 1.0), (4.0, 4.0, 2.0), (2.0, 4.0, 1.5)]
    return subtract_convex(left, outline) + subtract_convex(right, outline)


class TJunctionTest(unittest.TestCase):
    def test_a_vertex_on_a_neighbour_edge_is_inserted_into_that_edge(self):
        left = [(0.0, 0.0, 0.0), (2.0, 0.0, 0.0), (2.0, 2.0, 0.0), (0.0, 2.0, 0.0)]
        lower = [(2.0, 0.0, 1.0), (4.0, 0.0, 1.0), (4.0, 1.0, 1.0), (2.0, 1.0, 7.0)]
        upper = [(2.0, 1.0, 7.0), (4.0, 1.0, 1.0), (4.0, 2.0, 1.0), (2.0, 2.0, 1.0)]
        closed = close_t_junctions([left, lower, upper])
        self.assertEqual(closed[0], [(0.0, 0.0, 0.0), (2.0, 0.0, 0.0), (2.0, 1.0, 7.0), (2.0, 2.0, 0.0), (0.0, 2.0, 0.0)])
        self.assertEqual(closed[1:], [lower, upper])

    def test_subtracting_a_hole_leaves_a_crack_free_tiling_once_closed(self):
        pieces = _halves(HOLE)
        self.assertTrue([e for e in _open_edges(pieces) if not _on_square_border(e)])   # T-junctions before
        closed = close_t_junctions(pieces)
        self.assertAlmostEqual(sum(area(p) for p in closed), 12.0)
        inner = sorted(e for e in _open_edges(closed) if not _on_square_border(e))
        hole_edges = sorted(tuple(sorted(e)) for e in [((1.0, 1.0), (2.0, 1.0)), ((2.0, 1.0), (3.0, 1.0)), ((3.0, 1.0), (3.0, 3.0)),
                                                       ((2.0, 3.0), (3.0, 3.0)), ((1.0, 3.0), (2.0, 3.0)), ((1.0, 1.0), (1.0, 3.0))])
        self.assertEqual(inner, hole_edges)   # only the hole's rim stays open


class BoundaryRingTest(unittest.TestCase):
    def test_ring_follows_the_outline_through_every_vertex_on_its_rim(self):
        points = [v for p in close_t_junctions(_halves(HOLE)) for v in p]
        ring = boundary_ring(points, HOLE)
        self.assertEqual([v[:2] for v in ring], [(1.0, 1.0), (2.0, 1.0), (3.0, 1.0), (3.0, 3.0), (2.0, 3.0), (1.0, 3.0)])

    def test_ring_keeps_the_payload_of_the_points(self):
        points = [(1.0, 1.0, 'a'), (3.0, 1.0, 'b'), (3.0, 3.0, 'c'), (1.0, 3.0, 'd'), (2.0, 2.0, 'inside'), (0.5, 1.0, 'off')]
        self.assertEqual([v[2] for v in boundary_ring(points, HOLE)], ['a', 'b', 'c', 'd'])


class OffsetTest(unittest.TestCase):
    def test_offset_grows_by_a_rounded_band(self):
        grown = offset_convex(HOLE, 0.1, seg=16)
        self.assertAlmostEqual(area(grown), 4.0 + 4 * 2 * 0.1 + 3.14159 * 0.01, places=2)

    def test_offset_is_counter_clockwise_and_contains_the_original(self):
        grown = offset_convex(HOLE, 0.1)
        signed = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(grown, grown[1:] + grown[:1]))
        self.assertGreater(signed, 0)
        self.assertAlmostEqual(area(intersect_convex([(x, z) for x, z in HOLE], grown)), 4.0)


if __name__ == '__main__':
    unittest.main()
