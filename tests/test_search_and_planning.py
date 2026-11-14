"""Acceptance tests for crop discovery and non-prescriptive multi-campaign previews."""
import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.services.arie import CROPS
from app.services.crop_search import search_directory


class SearchAndPlanningTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_accent_insensitive_crop_search_and_synonyms(self):
        for term, ident in [("quinua","quinoa"),("frejol","common_bean"),
                            ("plátano","banana"),("YÚCA","cassava"),
                            ("solanum lycopersicum","tomato")]:
            with self.subTest(term=term):
                response=self.client.get("/api/arie/crops",params={"query":term})
                self.assertEqual(response.status_code,200,response.text)
                records=response.json()["items"]
                self.assertTrue(any(item["id"]==ident for item in records),records)
                self.assertTrue(all(item["locally_suitable"] is None for item in records))

    def test_paginated_and_filtered_directory(self):
        first=self.client.get("/api/arie/crops",params={"limit":10,"offset":0}).json()
        second=self.client.get("/api/arie/crops",params={"limit":10,"offset":10}).json()
        self.assertEqual(first["total"],len(CROPS))
        self.assertEqual(len(first["items"]),10)
        self.assertFalse(set(p["id"] for p in first["items"]) & set(p["id"] for p in second["items"]))
        category=self.client.get("/api/arie/crops",params={"category":"Frutales"}).json()
        self.assertTrue(category["items"])
        self.assertTrue(all(it["category"]=="Frutales" for it in category["items"]))

    def test_unknown_query_has_suggestions_not_suitability_claims(self):
        result=self.client.get("/api/arie/crops",params={"query":"maiss"}).json()
        self.assertEqual(result["total"],0)
        self.assertTrue(result["suggestions"])
        self.assertFalse(result["region_suitability_evaluated"])

    def test_pagination_and_query_are_bounded(self):
        self.assertEqual(self.client.get("/api/arie/crops",params={"limit":101}).status_code,422)
        self.assertEqual(self.client.get("/api/arie/crops",params={"offset":10001}).status_code,422)
        self.assertEqual(self.client.get("/api/arie/crops",params={"query":"x"*81}).status_code,422)

    def test_planning_preview_never_fabricates_local_crop_dates(self):
        result=self.client.post("/api/arie/evaluate",json={
            "crops":["maize","faba","potato"],"baseline_crops":["maize"],
            "sowing_month":11,"water_access":"unknown"
        })
        self.assertEqual(result.status_code,200,result.text)
        preview=result.json()["plan_preview"]
        self.assertEqual(preview["planning_status"],"needs_local_confirmation")
        self.assertFalse(preview["is_planting_instruction"])
        self.assertFalse(preview["is_prediction"])
        self.assertEqual(len(preview["stages"]),3)
        self.assertEqual(preview["stages"][0]["first_sowing_month_declared"],11)
        self.assertTrue(all(s["sowing_date"] is None and s["harvest_date"] is None for s in preview["stages"]))
        self.assertTrue(all(s["first_sowing_month_declared"] is None for s in preview["stages"][1:]))
        self.assertIn("water",[c["id"] for c in preview["missing_essentials"]])

    def test_exploratory_crop_plan_warns_about_missing_agronomy(self):
        result=self.client.post("/api/arie/evaluate",json={
            "crops":["quinoa","tomato"],"water_access":"irrigated","sowing_month":3
        })
        self.assertEqual(result.status_code,200,result.text)
        body=result.json()
        self.assertEqual(body["ai_decision"]["status"],"exploratory_catalog_only")
        self.assertIsNone(body["ai_decision"]["chosen_for_review"])
        self.assertIn("crop_evidence",[c["id"] for c in body["plan_preview"]["missing_essentials"]])
        self.assertTrue(all(s["evidence_status"]=="reference_not_locally_validated" for s in body["plan_preview"]["stages"]))


if __name__ == "__main__":
    unittest.main()
