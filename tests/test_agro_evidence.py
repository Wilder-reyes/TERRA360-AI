"""Provenance, safety, and user-provided economics: offline deterministic tests."""
import json
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from fastapi.testclient import TestClient
from app.main import app
from app.services import agro_evidence as E

class EvidenceTests(unittest.TestCase):
    def test_no_ana_station_data_is_not_reported_as_live(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(E, "DATA_DIR", Path(directory)):
            result = E.public_evidence_summary()
        self.assertEqual(result["basin"]["status"], "source_only")
        self.assertEqual(result["weather_alerts"]["status"], "source_only")
        self.assertEqual(result["market_prices"]["status"], "source_only")

    def test_official_source_and_date_validation(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(E, "DATA_DIR", Path(directory)):
            data = {"status":"reviewed","zone":"barranca","reviewed_by":"Agro reviewer",
                    "reviewed_on":"2026-11-14","document_url":"https://snirh.ana.gob.pe/document.pdf",
                    "location":"Pativilca station","records":[
                       {"date":"2026-11-12","value":12.5,"unit":"m3/s"}]}
            path = Path(directory)/"ana.json"
            path.write_text(json.dumps(data))
            self.assertEqual(E.official_records("ana",today=date(2026,11,14))["status"],"curated_record")
            data["document_url"]="https://example.com/wrong.pdf"
            path.write_text(json.dumps(data))
            self.assertEqual(E.official_records("ana",today=date(2026,11,14))["status"],"source_only")

    def test_expired_alerts_disappear_not_represented_as_no_alert(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(E, "DATA_DIR", Path(directory)):
            payload={"status":"reviewed","zone":"barranca","reviewed_by":"Agro reviewer",
                     "reviewed_on":"2026-11-14","document_url":"https://www.senamhi.gob.pe/?p=aviso-meteorologico",
                     "location":"Barranca","records":[{"date":"2026-11-13","value":2,
                         "unit":"alert_level","valid_until":"2026-11-13"}]}
            (Path(directory)/"senamhi.json").write_text(json.dumps(payload))
            self.assertEqual(E.official_records("senamhi",today=date(2026,11,14))["status"],"source_only")

    def test_soil_not_certified_from_farmer_pH(self):
        val=E.soil_checks({"ph":7.1,"source":"farmer_reported"},["camote"])
        self.assertEqual(val["status"],"farmer_reported")
        self.assertNotIn("alerts",val)

    def test_soil_exclusions_require_expert_reviewed_crop_ranges(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(E,"DATA_DIR",Path(directory)):
            path=Path(directory)/"soil_requirements.json"
            path.write_text(json.dumps({"status":"draft","reviewer":"Team","source_url":E.FAO_ECOCROP,
                                         "crops":{"camote":{"ph_min":5,"ph_max":7}}}))
            result=E.soil_checks({"ph":8.5,"source":"lab_report"},["camote"])
            self.assertEqual(result["status"],"lab_results_without_validated_crop_thresholds")
            path.write_text(json.dumps({"status":"agronomist_reviewed","reviewer":"Verified agronomist",
                                         "source_url":E.FAO_ECOCROP,"crops":{"camote":{"ph_min":5,"ph_max":7}}}))
            result=E.soil_checks({"ph":8.5,"source":"lab_report"},["camote"])
            self.assertEqual(result["status"],"screened_with_expert_reviewed_reference")
            self.assertEqual(result["alerts"][0]["crop_id"],"camote")

    def test_economics_needs_every_crop_in_each_proposal(self):
        strategies=[{"id":"S0","plantings":[{"crop_id":"camote"}]},
                    {"id":"S1","plantings":[{"crop_id":"camote"},{"crop_id":"arveja_verde"}]}]
        budgets=[{"crop_id":"camote","yield_kg_ha":10000,"price_soles_kg":1.5,"cost_soles_ha":9000}]
        result=E.crop_economic_comparison(strategies,budgets)
        self.assertEqual(result["strategies"][0]["margin_soles_ha_24months"],6000)
        self.assertEqual(result["strategies"][1]["status"],"incomplete")
        self.assertEqual(result["strategies"][1]["missing_crop_ids"],["arveja_verde"])

    def test_budget_endpoint_and_rejected_unknown_crop(self):
        client=TestClient(app)
        req={"strategies":[{"id":"S0","plantings":[{"crop_id":"camote"}]}],
             "crop_budgets":[{"crop_id":"camote","yield_kg_ha":2000,
                              "price_soles_kg":2,"cost_soles_ha":3000}]}
        r=client.post("/api/rotation/economics",json=req)
        self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(r.json()["strategies"][0]["margin_soles_ha_24months"],1000)
        req["crop_budgets"][0]["crop_id"]="unknown_crop"
        self.assertEqual(client.post("/api/rotation/economics",json=req).status_code,422)

    def test_historical_context_is_not_a_water_turn(self):
        record=E.historic_ana_context()
        self.assertFalse(record["use_for_irrigation_allocation"])
        self.assertEqual(record["status"],"published_historical_reference")
        self.assertEqual({x["river"] for x in record["statistics"]},{"Pativilca","Supe"})
        self.assertEqual(record["statistics"][0]["average_flow_m3_s"],47.58)

if __name__=="__main__":unittest.main()
