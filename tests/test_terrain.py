"""No upstream elevation request in CI. Terrain math and protections are deterministic."""
import unittest
from app.api.terrain_routes import sampling_points,summarize_elevation


class TerrainTests(unittest.TestCase):
    def test_five_samples_centered_on_point(self):
        p=sampling_points(-13.32175,-71.95605)
        self.assertEqual(len(p),5)
        self.assertAlmostEqual(p[0][0],-13.32175)
        self.assertGreater(p[1][0],p[0][0])
        self.assertLess(p[2][0],p[0][0])

    def test_no_global_projection_outside_srtm_coverage(self):
        for lat in (65,-67):
            with self.assertRaises(ValueError):
                sampling_points(lat,10)

    def test_gradient_is_only_coarse_context(self):
        p=sampling_points(-13.32,-71.96)
        rows=[{"dataset":"srtm90m","elevation":v} for v in [3100,3110,3090,3100,3100]]
        out=summarize_elevation({"results":rows},p)
        self.assertEqual(out["elevation_m"],3100)
        self.assertGreater(out["approximate_gradient_degrees"],0)
        self.assertFalse(out["can_decide_field_slope"])
        self.assertEqual(out["representation"],"five_DEM_samples_around_query_point_not_property")

    def test_missing_dem_samples_fail_closed(self):
        p=sampling_points(0,0)
        with self.assertRaises(ValueError):
            summarize_elevation({"results":[{"dataset":"srtm90m","elevation":100}]*4},p)
        with self.assertRaises(ValueError):
            summarize_elevation({"results":[{"dataset":"srtm90m","elevation":None}]*5},p)
