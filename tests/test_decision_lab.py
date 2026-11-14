"""Offline regression tests for the guided TERRA360 v0.3 workflow."""
import sys
import unittest
from pathlib import Path
from pydantic import ValidationError
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from app.schemas.scenarios import ScenarioRequest
from app.services.arie import evaluate, family_facts, REFERENCES
from app.api.routes import point_metadata


class DecisionLabTests(unittest.TestCase):
    def test_baseline_repetitions_are_realistic_and_allowed(self):
        r = evaluate(ScenarioRequest(
            crops=['maize', 'tarwi', 'potato'],
            baseline_crops=['maize', 'maize', 'potato'],
        ))
        self.assertEqual(r['scenario_comparison'][0]['status'], 'user_reported')
        self.assertEqual(r['baseline_facts']['crop_count'], 3)
        self.assertEqual(r['baseline_facts']['adjacent_same_family'], 1)

    def test_without_baseline_s0_remains_unverified(self):
        r = evaluate(ScenarioRequest(crops=['tarwi', 'potato']))
        self.assertEqual(r['scenario_comparison'][0]['status'], 'requires_farmer_baseline')
        self.assertIsNone(r['baseline_facts'])
        self.assertTrue(any(x['id'] == 'baseline' for x in r['next_steps']))

    def test_adjacent_same_family_is_transparent(self):
        r = evaluate(ScenarioRequest(crops=['maize', 'barley', 'potato']))
        self.assertEqual(r['facts']['unique_families'], 2)
        self.assertEqual(r['facts']['adjacent_same_family'], 1)
        self.assertEqual(next(x['status'] for x in r['checks'] if x['id']=='adjacency'),'review')

    def test_climate_context_included_without_implied_prediction(self):
        r = evaluate(ScenarioRequest(
            crops=['maize','faba'],
            climate_context={'source':'NASA POWER','start':'2026-10-01','end':'2026-10-30',
                             'valid_rain_days':29,'precipitation_total_mm':120.5,'temperature_mean_c':11.2},
        ))
        self.assertEqual(r['climate_context']['source'], 'NASA POWER')
        self.assertFalse(r['is_yield_prediction'])
        self.assertFalse(r['is_irrigation_prescription'])
        self.assertIn('no equivale', next(x['detail'] for x in r['checks'] if x['id']=='climate_context').lower())

    def test_climate_window_guards(self):
        with self.assertRaises(ValidationError):
            ScenarioRequest(crops=['maize'],climate_context={'start':'2026-11-02','end':'2026-11-01','valid_rain_days':1})
        with self.assertRaises(ValidationError):
            ScenarioRequest(crops=['maize'],climate_context={'start':'2026-11-01','end':'2026-11-03','valid_rain_days':4})

    def test_soil_inputs_validate_range(self):
        for ph, om in [(15.0,None),(-1.0,None),(None,101.0),(None,-2.0)]:
            with self.assertRaises(ValidationError):
                ScenarioRequest(crops=['maize'],soil_ph=ph,soil_organic_matter_pct=om)

    def test_soil_data_not_auto_verified(self):
        r = evaluate(ScenarioRequest(crops=['maize','tarwi'],soil_ph=6.0,soil_texture='loamy'))
        self.assertEqual(next(x['status'] for x in r['checks'] if x['id']=='soil'),'context')
        self.assertIn('declarados por el usuario', next(x['detail'] for x in r['checks'] if x['id']=='soil'))

    def test_all_scenario_refs_exist(self):
        r = evaluate(ScenarioRequest(crops=['maize','tarwi']))
        for s in r['scenario_comparison']:
            self.assertTrue(all(ref in REFERENCES for ref in s['references']))
        for check in r['checks']:
            self.assertTrue(all(ref in REFERENCES for ref in check['references']))

    def test_selected_point_cannot_masquerade_as_huando_sector(self):
        official = point_metadata(-11.47918514,-77.18041962)
        self.assertEqual(official['coordinate_type'], 'official_sector_centroid_not_parcel')
        self.assertIn('Huaral', official['name'])
        selected = point_metadata(-11.48,-77.18)
        self.assertEqual(selected['coordinate_type'], 'user_selected_query_point_not_surveyed_parcel')
        self.assertNotIn('Huando', selected['name'])
        historical_calca = point_metadata(-13.32175,-71.95605)
        self.assertNotEqual(historical_calca['coordinate_type'], 'official_sector_centroid_not_parcel')

    def test_descriptive_stats_are_not_performance_scores(self):
        r = family_facts(['maize','barley','tarwi'])
        self.assertEqual(r['unique_families'],2)
        self.assertEqual(r['adjacent_same_family'],1)
        self.assertNotIn('yield',r)
        self.assertNotIn('score',r)

if __name__ == '__main__': unittest.main()
