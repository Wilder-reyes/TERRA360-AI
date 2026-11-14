# AI-assisted: written with Claude Code (Anthropic) and reviewed by the TERRA360 team.
"""Field Shift rotation comparator: ET0, catalogue, engine, detection and API (no network)."""
import asyncio
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services import rotation_engine as E  # noqa: E402
from app.services.hls_history import FMASK_REJECT, detect_campaigns, hls_ndvi_from_arrays, suggest_crops  # noqa: E402
from app.services.power_climatology import build_monthly, et0_penman_monteith  # noqa: E402


def coastal_climate():
    """Synthetic but realistic coastal-Lima climatology (summer Jan-Mar warm)."""
    tmax = [26.6, 26.4, 26.4, 25.0, 23.9, 23.2, 22.7, 21.3, 21.8, 21.8, 22.8, 24.1]
    payload = {"header": {"range": "test 2001-2025"}, "geometry": {"coordinates": [-77.45, -11.48, 224.0]},
               "properties": {"parameter": {
                   "T2M_MAX": dict(zip(E.MONTH_EN, tmax)),
                   "T2M_MIN": dict(zip(E.MONTH_EN, [t - 7 for t in tmax])),
                   "T2M": dict(zip(E.MONTH_EN, [t - 3.5 for t in tmax])),
                   "RH2M": dict(zip(E.MONTH_EN, [78] * 12)),
                   "WS2M": dict(zip(E.MONTH_EN, [2.5] * 12)),
                   "ALLSKY_SFC_SW_DWN": dict(zip(E.MONTH_EN, [22.5, 22.3, 21.9, 20.3, 15.8, 11.9, 11.6, 13.2, 15.7, 19.0, 20.8, 21.4])),
                   "PRECTOTCORR": dict(zip(E.MONTH_EN, [0.1] * 12)),
               }}}
    payload["properties"]["parameter"] = {k: {kk.upper(): vv for kk, vv in v.items()} for k, v in payload["properties"]["parameter"].items()}
    clim = build_monthly(payload, -11.48, -77.45)
    clim["cell_adjustment"] = None
    return clim


class ET0Tests(unittest.TestCase):
    def test_fao56_example_17_bangkok_april(self):
        # FAO-56 Example 17: monthly ET0 = 5.72 mm/day (ea 2.85 kPa → RH ≈ 64.5 %).
        et0 = et0_penman_monteith(4, 13.73, 2, 34.8, 25.6, 64.5, 2.0, 22.65, t_prev=29.2, t_next=31.2)
        self.assertAlmostEqual(et0, 5.72, delta=0.35)

    def test_monthly_climate_and_relative_heat_months(self):
        clim = coastal_climate()
        self.assertEqual(len(clim["months"]), 12)
        self.assertEqual(clim["hot_months"], [1, 2, 3])
        jan, jul = clim["months"][0]["et0_mm_day"], clim["months"][6]["et0_mm_day"]
        self.assertGreater(jan, jul)  # summer demand > winter demand

    def test_missing_month_is_rejected_not_filled(self):
        payload = {"properties": {"parameter": {p: {m: 1.0 for m in E.MONTH_EN} for p in
                   ["T2M_MAX", "T2M_MIN", "T2M", "RH2M", "WS2M", "ALLSKY_SFC_SW_DWN", "PRECTOTCORR"]}}}
        payload["properties"]["parameter"]["T2M_MAX"]["JAN"] = -999
        with self.assertRaises(Exception):
            build_monthly({**payload, "geometry": {"coordinates": [0, 0, 0]}}, 0, 0)


class CatalogTests(unittest.TestCase):
    def test_team_catalogue_used_as_is(self):
        cat = E.load_catalog()
        self.assertEqual(len(cat["crops"]), 13)
        for c in cat["crops"].values():
            self.assertEqual(len(c["kc"]), 3)
            self.assertEqual(sum(c["stages_days"]), c["cycle_days"]) if c["cycle_days"] < 365 else None
            self.assertTrue(set(c["sowing_months_lima"]) <= set(range(1, 13)))
        self.assertEqual(cat["seasons"]["river_low_months"], [5, 6, 7, 8, 9, 10, 11])

    def test_kc_curve_follows_fao56_shape(self):
        mad = E.crop("maiz_amarillo_duro")
        curve = E.kc_curve(mad)
        self.assertEqual(len(curve), mad["cycle_days"])
        self.assertAlmostEqual(curve[0], 0.30)
        self.assertAlmostEqual(max(curve), 1.20)
        self.assertAlmostEqual(curve[-1], 0.35, places=2)


class EngineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.clim = coastal_climate()

    def sim(self, key):
        return E.simulate(E.normalize_plantings(E.TEMPLATES[key]), self.clim)["indicators"]

    def test_team_template_s1_uses_less_low_river_water_than_s0(self):
        self.assertLess(self.sim("water")["water_low_river_mm"], self.sim("current")["water_low_river_mm"])

    def test_team_template_s2_has_no_bare_months_and_two_legumes(self):
        s2 = self.sim("soil")
        self.assertEqual(s2["bare_months"], 0)
        self.assertEqual(s2["legume_plantings"], 2)  # 2 per 24 months in the team template
        self.assertEqual(s2["same_family_consecutive"], 0)

    def test_s0_maize_monoculture_flags_family_repeats(self):
        s0 = self.sim("current")
        self.assertEqual(s0["legume_plantings"], 0)
        self.assertGreater(s0["same_family_consecutive"], 0)
        self.assertEqual(s0["bare_months"], 4)

    def test_compare_generates_two_distinct_alternatives_with_five_sections(self):
        r = E.compare(E.TEMPLATES["current"], self.clim)
        self.assertEqual([s["id"] for s in r["strategies"]], ["S0", "S1", "S2"])
        s0, s1, s2 = r["strategies"]
        self.assertEqual(s1["origin"], "constrained_search")
        self.assertLess(s1["indicators"]["water_low_river_mm"], s0["indicators"]["water_low_river_mm"])
        self.assertLessEqual(s1["indicators"]["bare_months"], max(s0["indicators"]["bare_months"], 2))
        self.assertLess(s2["indicators"]["bare_months"], s0["indicators"]["bare_months"])
        self.assertGreaterEqual(s2["indicators"]["legume_plantings"], 2)
        self.assertNotEqual([(p["crop_id"], p["start_index"]) for p in s1["plantings"]],
                            [(p["crop_id"], p["start_index"]) for p in s2["plantings"]])
        for s in r["strategies"]:
            self.assertEqual(set(s["sections"]), {"why", "evidence", "benefits", "gaps", "risks"})
            for sec in s["sections"].values():
                self.assertTrue(sec["es"] and sec["en"])
            for p in s["plantings"][1:] if s["key"] != "current" else []:
                self.assertTrue(p["sowing_month_in_catalog"])
            self.assertIn("maiz_amarillo_duro", [p["crop_id"] for p in s["plantings"]])

    def test_alternatives_respect_sowing_months_and_no_back_to_back_crop(self):
        r = E.compare(E.TEMPLATES["current"], self.clim, priorities={"water": 2, "soil": 2})
        for s in r["strategies"][1:]:
            ids = [p["crop_id"] for p in s["plantings"]]
            self.assertTrue(all(a != b for a, b in zip(ids, ids[1:])))
            self.assertTrue(all(p["sowing_month_in_catalog"] for p in s["plantings"]))

    def test_invalid_inputs_are_rejected(self):
        with self.assertRaises(E.RotationError):
            E.normalize_plantings([{"crop_id": "palta", "start_index": 0}])
        with self.assertRaises(E.RotationError):
            E.normalize_plantings([{"crop_id": "camote", "start_index": 30}])
        with self.assertRaises(E.RotationError):
            E.compare(E.TEMPLATES["current"], self.clim, water_turn="mucho")

    def test_current_rotation_overlap_is_fitted_and_marked(self):
        plan = E.fit_to_cycle(E.normalize_plantings([{"crop_id": "maiz_amarillo_duro", "start_index": 0},
                                                     {"crop_id": "camote", "start_index": 3}]))
        self.assertTrue(plan[0]["adjusted_to_observed_gap"])
        E.simulate(plan, self.clim)  # no overlap error


class FarmerIncomePriorityTests(unittest.TestCase):
    def setUp(self):
        self.clim = coastal_climate()
        self.current = [
            {"crop_id": "maiz_amarillo_duro", "start_index": 0},
            {"crop_id": "camote", "start_index": 8},
            {"crop_id": "camote", "start_index": 16},
        ]

    def test_default_income_crop_is_most_frequent_not_always_maize(self):
        with patch.object(E, "search", return_value=None):
            r = E.compare(self.current, self.clim)
        self.assertEqual(r["income_crop"], "camote")
        self.assertEqual(r["income_crop_origin"], "most_frequent_in_current")

    def test_user_selected_income_crop_is_respected(self):
        with patch.object(E, "search", return_value=None):
            r = E.compare(self.current, self.clim, income_crop_id="maiz_amarillo_duro")
        self.assertEqual(r["income_crop"], "maiz_amarillo_duro")
        self.assertEqual(r["income_crop_origin"], "farmer_selected")

    def test_income_crop_must_be_in_current_rotation(self):
        with self.assertRaises(E.RotationError):
            E.compare(self.current, self.clim, income_crop_id="pallar")


class DetectionTests(unittest.TestCase):
    def months(self, values):
        out, y, m = [], 2021, 1
        for v in values:
            out.append({"month": f"{y}-{m:02d}", "ndvi": v})
            y, m = (y + 1, 1) if m == 12 else (y, m + 1)
        return out

    def test_two_campaigns_and_bare_period_without_interpolation(self):
        vals = [0.15, 0.18, 0.45, 0.7, 0.6, 0.25, 0.15, 0.12, None, 0.3, 0.65, 0.72, 0.4, 0.16, 0.14]
        d = detect_campaigns(self.months(vals))
        self.assertEqual(len(d["campaigns"]), 2)
        self.assertEqual(d["campaigns"][0]["peak_month"], "2021-04")
        self.assertEqual(d["states"][8], "unknown")
        self.assertTrue(any(p["months"] >= 2 for p in d["sustained_bare_periods"]))
        self.assertTrue(d["thresholds"]["heuristic"])

    def test_long_cloud_gap_keeps_peaks_separate(self):
        vals = [0.5, 0.8, 0.75, None, None, None, None, None, None, 0.5, 0.6, 0.62]
        self.assertEqual(len(detect_campaigns(self.months(vals))["campaigns"]), 2)

    def test_crop_suggestions_come_from_catalogue(self):
        c = {"start": "2023-09", "months": 3}
        ids = [x["crop_id"] for x in suggest_crops(c, list(E.load_catalog()["crops"].values()))]
        self.assertTrue(ids)
        self.assertTrue(set(ids) <= set(E.load_catalog()["crops"]))

    def test_hls_fmask_rejects_cloud_and_water(self):
        red = np.full((4, 4), 500, np.int16)
        nir = np.full((4, 4), 3000, np.int16)
        fmask = np.zeros((4, 4), np.uint8)
        fmask[0, :] = 1 << 1   # cloud
        fmask[1, :] = 1 << 5   # water
        inside = np.ones((4, 4), bool)
        r = hls_ndvi_from_arrays(red, nir, fmask, inside, 16 * 900, 900)
        self.assertEqual(r["valid_pixels"], 8)
        self.assertEqual(r["status"], "available")
        self.assertAlmostEqual(r["ndvi_median"], (0.3 - 0.05) / 0.35, places=3)
        self.assertTrue(FMASK_REJECT & (1 << 3))


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_zones_include_huaral_and_barranca_from_same_padron(self):
        z = self.client.get("/api/rotation/zones").json()["zones"]
        self.assertEqual({x["id"] for x in z}, {"huaral", "barranca"})
        self.assertEqual(len({x["source_url"] for x in z}), 1)
        self.assertEqual({x["sector"]["code"] for x in z}, {"15060105", "15020105"})

    def test_compare_abstains_without_current_rotation(self):
        r = self.client.post("/api/rotation/compare", json={"zone": "huaral", "current": []}).json()
        self.assertEqual(r["status"], "needs_current_rotation")
        self.assertEqual(r["strategies"], [])

    def test_compare_endpoint_with_mocked_power(self):
        clim = coastal_climate()

        async def fake(lat, lon, client=None, coastal=True):
            return clim
        with patch("app.api.rotation_routes.monthly_climate", fake):
            r = self.client.post("/api/rotation/compare", json={"zone": "barranca", "current": E.TEMPLATES["current"],
                                                                "water_turn": "escaso",
                                                                "current_source": "team_demo",
                                                                "use_team_templates_as_fallback": True})
        self.assertEqual(r.status_code, 200, r.text)
        body = r.json()
        self.assertEqual(len(body["strategies"]), 3)
        self.assertEqual(len(body["window"]["context"]), 24)
        self.assertTrue(body["method"]["relative_only"])

    def test_real_farm_mode_never_falls_back_to_team_templates(self):
        """An impossible constrained search abstains instead of inventing rotations."""
        clim = coastal_climate()

        async def fake(lat, lon, client=None, coastal=True):
            return clim

        with patch("app.api.rotation_routes.monthly_climate", fake), patch.object(E, "search", return_value=None):
            r = self.client.post("/api/rotation/compare", json={
                "zone": "huaral", "current": E.TEMPLATES["current"],
                "current_source": "farmer_declared",
            })
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()
        self.assertEqual(data["status"], "partial")
        self.assertEqual(len(data["strategies"]), 1)
        self.assertEqual(data["strategies"][0]["origin"], "farmer_declared")

    def test_demo_templates_are_explicitly_tagged(self):
        clim = coastal_climate()

        async def fake(lat, lon, client=None, coastal=True):
            return clim

        with patch("app.api.rotation_routes.monthly_climate", fake), patch.object(E, "search", return_value=None):
            r = self.client.post("/api/rotation/compare", json={
                "zone": "huaral", "current": E.TEMPLATES["current"],
                "current_source": "team_demo",
                "use_team_templates_as_fallback": True,
            })
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()
        self.assertEqual([s["origin"] for s in data["strategies"]],
                         ["team_demo", "team_template", "team_template"])

    def test_history_rejects_malformed_coordinates_as_422(self):
        for value in ({"type": "Polygon", "coordinates": [[["bad", -11], [-77, -11], [-77, -12]]]},
                      {"type": "Polygon", "coordinates": [[["NaN", -11], [-77, -11], [-77, -12]]]}):
            with self.subTest(value=value):
                r = self.client.post("/api/rotation/history", json={"polygon": value})
                self.assertEqual(r.status_code, 422, r.text)

    def test_history_rejects_non_polygon_geojson(self):
        r = self.client.post("/api/rotation/history", json={"polygon": {"type": "Point", "coordinates": [0, 0]}})
        self.assertEqual(r.status_code, 422)


class FarmerRecommendationTests(unittest.TestCase):
    """Objective-specific highlights are computed, not inferred from card order."""

    def setUp(self):
        self.plans = [
            {"id": "S0", "indicators": {"water_low_river_mm": 350, "bare_months": 18}},
            {"id": "S1", "indicators": {"water_low_river_mm": 100, "bare_months": 18}},
            {"id": "S2", "indicators": {"water_low_river_mm": 1100, "bare_months": 0}},
        ]

    def test_water_priority_prefers_genuine_lower_demand(self):
        r = E.highlight_for_farmer(self.plans, {"water": 2, "soil": 0})
        self.assertEqual(r["recommended_strategy_id"], "S1")
        self.assertIn("menos de agua", r["recommendation_reason_es"])

    def test_soil_priority_prefers_coverage_and_mentions_water_cost(self):
        r = E.highlight_for_farmer(self.plans, {"water": 0, "soil": 2})
        self.assertEqual(r["recommended_strategy_id"], "S2")
        self.assertIn("más agua", r["recommendation_reason_es"])

    def test_both_priorities_do_not_hide_major_water_penalty(self):
        r = E.highlight_for_farmer(self.plans, {"water": 2, "soil": 2})
        self.assertEqual(r["recommended_strategy_id"], "S1")

    def test_no_evidence_of_improvement_means_no_highlight(self):
        worse = [
            {"id": "S0", "indicators": {"water_low_river_mm": 100, "bare_months": 5}},
            {"id": "S1", "indicators": {"water_low_river_mm": 200, "bare_months": 7}},
        ]
        r = E.highlight_for_farmer(worse, {"water": 2, "soil": 2})
        self.assertIsNone(r["recommended_strategy_id"])

    def test_custom_location_has_no_invented_basin_rain(self):
        clim = coastal_climate()

        async def fake(lat, lon, client=None, coastal=True):
            return clim

        with patch("app.api.rotation_routes.monthly_climate", fake):
            res = TestClient(app).post("/api/rotation/compare", json={
                "latitude": -11.4, "longitude": -77.1, "current": E.TEMPLATES["current"],
            })
        self.assertEqual(res.status_code, 200, res.text)
        self.assertEqual(res.json()["upper_basin_rain"]["status"], "unavailable")


class MaizeLowRiverShareTests(unittest.TestCase):
    """Team verification note 09 (sec. 2b): share of a MAD campaign's water in May-Nov, Huaral."""
    # Snapshot of NASA POWER climatology ET0 (mm/day), Huaral coastal cell, 2001-2025.
    ET0_HUARAL = [4.02, 4.06, 3.97, 3.5, 2.79, 2.41, 2.44, 2.61, 2.89, 3.2, 3.46, 3.6]

    def test_matches_team_verification_table(self):
        clim = {"months": [{"month": i + 1, "et0_mm_day": v} for i, v in enumerate(self.ET0_HUARAL)]}
        expected = {1: 23, 2: 51, 3: 79, 8: 71, 9: 39}
        for month, pct in expected.items():
            got = E.low_river_share("maiz_amarillo_duro", month, clim)["low_river_share_percent"]
            self.assertAlmostEqual(got, pct, delta=3, msg=f"sowing month {month}")

    def test_s0_explanation_states_maize_share(self):
        clim = coastal_climate()
        why = E.compare(E.TEMPLATES["current"], clim)["strategies"][0]["sections"]["why"]["es"]
        self.assertTrue(any("del agua de tu maíz" in x for x in why))

class ImergBasinTests(unittest.TestCase):
    def test_box_mean_converts_rate_and_rejects_fill(self):
        from app.services.imerg_basin import box_mean_mm_month
        lons = np.array([-77.05, -76.95, -76.85, -76.75])
        lats = np.array([-11.45, -11.35, -11.25])
        rate = np.full((4, 3), 0.1)  # mm/hr
        rate[0, 0] = -9999.9
        v = box_mean_mm_month(rate, lons, lats, [-77.0, -11.5, -76.7, -11.2], 1)
        self.assertAlmostEqual(v, 0.1 * 24 * 31, places=1)
        self.assertIsNone(box_mean_mm_month(rate, lons, lats, [10, 10, 11, 11], 1))

    def test_summary_climatology_and_season_percent(self):
        from app.services.imerg_basin import summarise
        series = {f"{y}-{m:02d}": (100.0 if m in (1, 2, 3) else 10.0) for y in range(2005, 2025) for m in range(1, 13)}
        s = summarise(series)
        self.assertEqual(s["climatology_mm_month"][2], 100.0)
        self.assertEqual(s["seasons"][-1]["percent_of_normal"], 100)

    def test_api_abstains_without_imerg_summary(self):
        from app.services import imerg_basin
        with patch.object(imerg_basin, "load_seed", return_value=None):
            r = TestClient(app).get("/api/rotation/upper-basin-rain?zone=huaral").json()
        self.assertEqual(r["status"], "unavailable")
        self.assertIn("Earthdata", r["message_en"])

class TeamSowingRuleTests(unittest.TestCase):
    """Analysis-chat decisions: maize windows per strategy and honest S1 labelling."""

    @classmethod
    def setUpClass(cls):
        cls.clim = coastal_climate()

    def maize_months(self, strategy):
        return {p["start_calendar_month"] for p in strategy["plantings"] if p["crop_id"] == "maiz_amarillo_duro"}

    def test_s1_maize_only_nov_feb_and_s2_never_may_jul(self):
        currents = [E.TEMPLATES["current"],
                    [{"crop_id": "maiz_amarillo_duro", "start_index": 7}, {"crop_id": "camote", "start_index": 13}],
                    [{"crop_id": "maiz_amarillo_duro", "start_index": 10}]]
        for cur in currents:
            r = E.compare(cur, self.clim, priorities={"income": 2})
            s1 = next(s for s in r["strategies"] if s["key"] == "water")
            s2 = next(s for s in r["strategies"] if s["key"] == "soil")
            self.assertTrue(self.maize_months(s1) <= {11, 12, 1, 2}, self.maize_months(s1))
            self.assertFalse(self.maize_months(s2) & {5, 6, 7}, self.maize_months(s2))

    def test_s0_is_not_restricted(self):
        r = E.compare([{"crop_id": "maiz_amarillo_duro", "start_index": 10}], self.clim)  # sown in June
        self.assertEqual(self.maize_months(r["strategies"][0]), {6})

    def test_s1_that_does_not_save_low_river_water_says_so(self):
        # Current rotation uses no water in May-Nov (cowpea sown in January): S1 cannot improve it.
        r = E.compare([{"crop_id": "frijol_castilla", "start_index": 5}], self.clim)
        s1 = next(s for s in r["strategies"] if s["key"] == "water")
        self.assertFalse(s1["relative_to_current"]["improves_low_river_water"])
        self.assertIn("NO gasta menos agua", s1["sections"]["why"]["es"][0])
        self.assertIn("does NOT use less water", s1["sections"]["why"]["en"][0])
        self.assertNotEqual(s1["icons"]["water"], "better")

    def test_s1_that_saves_water_is_flagged_as_improvement(self):
        r = E.compare(E.TEMPLATES["current"], self.clim)
        s1 = next(s for s in r["strategies"] if s["key"] == "water")
        self.assertTrue(s1["relative_to_current"]["improves_low_river_water"])


if __name__ == "__main__":
    unittest.main()
