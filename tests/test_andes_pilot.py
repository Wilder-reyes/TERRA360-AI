import unittest
from app.services import andes_rotation
from app.services.era5_land_context import summarize_era5_land
class AndeanPilotTest(unittest.TestCase):
    def test_study_catalogue_has_documented_families(self):
        cat=andes_rotation.catalogue()
        self.assertEqual(cat["zone"],"chalhuas")
        self.assertEqual(next(c for c in cat["crops"] if c["id"]=="haba")["family"],"Fabaceae")
        self.assertFalse(all(c["sowing_calendar_verified"] for c in cat["crops"]))
    def test_reference_rotation_never_claims_suitability_or_water_savings(self):
        result=andes_rotation.compare(["papa","arveja","papa","arveja"],2027,"both")
        self.assertEqual(result["status"],"illustrative_comparison")
        self.assertEqual(result["history_source"],"example")
        self.assertIn("Ejemplo histórico",result["strategies"][0]["title_es"])
        confirmed=andes_rotation.compare(["papa","arveja","papa","arveja"],2027,"both","farmer_declared")
        self.assertIn("registrado por ti",confirmed["strategies"][0]["title_es"])
        self.assertIsNone(result["automatic_recommendation"])
        self.assertEqual([x["year"] for x in result["strategies"][1]["schedule"]],[2027,2028,2029,2030])
        self.assertEqual(result["strategies"][1]["indicators"]["botanical_families"],4)
        self.assertEqual(result["strategies"][0]["indicators"]["potato_return_interval_campaigns"],[2])
        self.assertFalse(result["field_evidence_available"])
        self.assertIn("No se calculó ahorro de agua",result["water_note_es"])
    def test_rejects_undocumented_crop(self):
        with self.assertRaises(ValueError):
            andes_rotation.compare(["papa","arveja","plátano","avena"],2027,"soil")
    def test_ecostress_metadata_never_becomes_a_temperature(self):
        from app.api.andes_routes import summarize_ecostress_granules
        out=summarize_ecostress_granules({"feed":{"entry":[{"producer_granule_id":"tile",
         "time_start":"2026-09-01T12:00:00Z"}]}})
        self.assertEqual(out["status"],"metadata_only_quality_unverified")
        self.assertFalse(out["temperature_values_available"])
        self.assertIsNone(out["scenes"][0]["temperature_c"])
    def test_era5_summary_does_not_replace_missing_with_zero(self):
        self.assertEqual(summarize_era5_land({"daily":{"time":["2025-01-01"],
             "temperature_2m_min":[0],"precipitation_sum":[0]}},2025)["status"],"insufficient_data")
    def test_era5_annual_aggregate(self):
        from datetime import date,timedelta
        days=[date(2025,1,1)+timedelta(days=i) for i in range(365)]
        data={"daily":{"time":[x.isoformat() for x in days],
              "temperature_2m_min":[-1 if i==0 else 7 for i in range(365)],
              "precipitation_sum":[1.0]*365}}
        r=summarize_era5_land(data,2025)
        self.assertEqual(r["status"],"available")
        self.assertEqual(r["days_at_or_below_zero_c"],1)
        self.assertEqual(r["rainfall_sum_mm"],365)
        self.assertEqual(len(r["months"]),12)


    def test_validated_subplots_and_overlaps(self):
        from app.api.andes_routes import verified_subplots, Subplot
        outer={"type":"Polygon","coordinates":[[[-75.37,-12.05],[-75.36,-12.05],[-75.36,-12.04],[-75.37,-12.04],[-75.37,-12.05]]]}
        west={"type":"Polygon","coordinates":[[[-75.37,-12.05],[-75.365,-12.05],[-75.365,-12.04],[-75.37,-12.04],[-75.37,-12.05]]]}
        east={"type":"Polygon","coordinates":[[[-75.365,-12.05],[-75.36,-12.05],[-75.36,-12.04],[-75.365,-12.04],[-75.365,-12.05]]]}
        result=verified_subplots(outer,[Subplot(id="A",polygon=west),Subplot(id="B",polygon=east)])
        self.assertEqual(len(result["subplots"]),2)
        self.assertAlmostEqual(sum(x["percent_of_field"] for x in result["subplots"]),100,places=1)
        with self.assertRaises(ValueError):
            verified_subplots(outer,[Subplot(id="A",polygon=west),Subplot(id="B",polygon=west)])

if __name__=="__main__":unittest.main()

