"""BIOTEX: real NASA HLS model can be reproduced from its committed source.

These tests require no network, fake crop labels, Earthdata token or ML service.
They verify source fingerprint, chronological holdout, model ranking influence,
and the restriction to exactly ONE NASA-observed Barranca polygon.
"""
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/"backend"))
from fastapi.testclient import TestClient
from app.main import app
from app.services import field_shift_ai as AI, rotation_engine as E

PARCEL={
 "type":"Polygon","coordinates":[[
 [-77.739236,-10.699368],[-77.737867,-10.699354],
 [-77.737852,-10.700708],[-77.739222,-10.700723],
 [-77.739236,-10.699368],
 ]]
}

class TrainedHLSModelTests(unittest.TestCase):
    def test_frozen_real_hls_artifact_reproduces(self):
        outcome=AI.reproduce_model()
        artifact=outcome["artifact"]
        self.assertEqual(artifact["source_sensor"],"NASA HLS v2.0 (Landsat 8/9 + Sentinel-2, 30 m)")
        self.assertEqual(len(outcome["observed"]),44)
        self.assertEqual(artifact["training"]["train_observations"],33)
        self.assertEqual(artifact["training"]["holdout_observations"],11)
        self.assertEqual(artifact["source_git_blob_sha"],AI._git_blob_sha(
            (AI.ROOT/"data/history_seed/3365819f83a772e737d341ec1058efac.json").read_bytes()))
        self.assertLess(artifact["evaluation"]["brier_model"],artifact["evaluation"]["brier_train_prevalence_baseline"])
        self.assertEqual(len(outcome["probabilities"]),12)
        self.assertGreater(max(outcome["probabilities"])-min(outcome["probabilities"]),.2)

    def test_other_field_must_not_inherit_the_demo_model(self):
        self.assertTrue(AI.exact_parcel_match(PARCEL))
        changed={"type":"Polygon","coordinates":[[[x+.0005,y] for x,y in PARCEL["coordinates"][0]]]}
        self.assertFalse(AI.exact_parcel_match(changed))
        self.assertEqual(AI.assess_strategies(changed,[])["status"],"not_applicable_to_this_field")

    def test_model_exposure_uses_actual_crop_coverage_months(self):
        empty=[{"index":i,"calendar_month":(8+i-1)%12+1,"covered":False} for i in range(24)]
        planted=[{**m,"covered":m["calendar_month"] in (9,10,11)} for m in empty]
        result=AI.assess_strategies(PARCEL,[{"id":"S0","timeline":empty},{"id":"S1","timeline":planted}])
        self.assertEqual(result["status"],"trained_and_verified")
        self.assertTrue(result["used_for_decision"])
        self.assertGreater(result["weighted_uncovered_exposure"]["S0"],result["weighted_uncovered_exposure"]["S1"])
        self.assertEqual(result["observed_months"],44)

    def test_learned_risk_changes_rank_when_other_tradeoffs_equal(self):
        strategies=[
          {"id":"S0","indicators":{"water_low_river_mm":300,"bare_months":12}},
          {"id":"S1","indicators":{"water_low_river_mm":300,"bare_months":12}},
          {"id":"S2","indicators":{"water_low_river_mm":310,"bare_months":12}},
        ]
        priorities={"water":1,"soil":2,"pests":0}
        without=E.highlight_for_farmer(strategies,priorities,"normal")
        self.assertIsNone(without["recommended_strategy_id"])
        with_ai=E.highlight_for_farmer(strategies,priorities,"normal",
                                     ai_bare_risk={"S0":.6,"S1":.3,"S2":.2})
        self.assertEqual(with_ai["recommended_strategy_id"],"S2")
        self.assertTrue(with_ai["ai_weighted"])
        scarce=E.highlight_for_farmer(strategies,priorities,"escaso",
                                     ai_bare_risk={"S0":.6,"S1":.3,"S2":.2})
        self.assertEqual(scarce["recommended_strategy_id"],"S1")

    def test_ai_api_proof_uses_real_holdout_and_source(self):
        r=TestClient(app).get("/api/rotation/ai-demo")
        self.assertEqual(r.status_code,200,r.text)
        body=r.json()
        self.assertEqual(body["status"],"trained_and_verified")
        self.assertEqual(body["observed_months"],44)
        self.assertEqual(len(body["real_ndvi_observations"]),44)
        self.assertLess(body["holdout"]["brier_model"],body["holdout"]["brier_train_prevalence_baseline"])

    def test_compare_integrates_model_for_exact_polygon(self):
        # Existing tests use a deterministic climate fixture; avoid calling NASA
        # from unit tests but DO NOT fake the model or its source records.
        climate={"source":"NASA POWER test fixture","source_url":"https://power.larc.nasa.gov",
            "period":"reference","hot_months":[1,2,3],"annual_et0_mm":1200,
            "tmax_seasonal_range_c":4,"limitations":[],"limitations_en":[],
            "method":"test fixture","cell_adjustment":None,"power_grid_elevation_m":70,
            "months":[{"month":m,"tmax_c":28,"tmin_c":17,"tmean_c":22,
                       "et0_mm_day":4,"et0_mm_month":122} for m in range(1,13)]}
        async def fake_monthly(lat,lon,client=None,coastal=True):
            return climate
        from app.api import rotation_routes as R
        with patch.object(R,"monthly_climate",fake_monthly):
            response=TestClient(app).post("/api/rotation/compare",json={
                "zone":"barranca","latitude":-10.7,"longitude":-77.7385,
                "polygon":PARCEL,"current":E.TEMPLATES["current"],
                "priorities":{"water":2,"soil":2,"income":1,"pests":1},
                "water_turn":"escaso","use_team_templates_as_fallback":False,
            })
        self.assertEqual(response.status_code,200,response.text)
        data=response.json()
        self.assertEqual(data["ai_analysis"]["status"],"trained_and_verified")
        self.assertIn("ai_weighted",data)
        self.assertTrue(data["ai_weighted"])
        self.assertEqual(len(data["strategies"]),3)
        self.assertIn(data["recommended_strategy_id"],["S1","S2",None])

if __name__=="__main__":unittest.main()
