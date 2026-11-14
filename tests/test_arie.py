import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from app.schemas.scenarios import ScenarioRequest
from app.services.arie import CROPS, REFERENCES, evaluate
from app.services.environment_metrics import calculate_statistics, aggregate_nasa_power
from pydantic import ValidationError

class ARIETests(unittest.TestCase):
    def test_catalog_references_are_resolvable(self):
        for crop in CROPS.values():
            for ref in crop['references']:
                self.assertIn(ref, REFERENCES)
    def test_single_crop_has_specific_warning(self):
        result = evaluate(ScenarioRequest(crops=['tarwi']))
        self.assertIn('no constituye una rotación', result['checks'][0]['detail'])

    def test_valid_sequence(self):
        result = evaluate(ScenarioRequest(crops=['maize','tarwi','potato']))
        self.assertFalse(result['is_yield_prediction'])
        self.assertEqual(len(result['scenario_comparison']),3)
        self.assertEqual(result['checks'][0]['status'],'pass')
    def test_duplicate_crop_rejected(self):
        with self.assertRaises(ValidationError):
            ScenarioRequest(crops=['maize','maize'])
    def test_empty_sequence_rejected(self):
        with self.assertRaises(ValidationError):
            ScenarioRequest(crops=[])
    def test_no_water_claim_without_evidence(self):
        result=evaluate(ScenarioRequest(crops=['maize']))
        self.assertEqual(next(c for c in result['checks'] if c['id']=='water')['status'],'review')
    def test_nonadditive_statistics(self):
        self.assertIsNone(calculate_statistics([20,22,None],additive=False)['total'])
        self.assertEqual(calculate_statistics([2,3,None])['total'],5)
    def test_temperature_not_summed(self):
        result=aggregate_nasa_power({'records':[{'T2M':20,'PRECTOTCORR':2},{'T2M':22,'PRECTOTCORR':3}]})
        self.assertIsNone(result['temperature_c']['total'])
        self.assertEqual(result['precipitation_mm_day']['total'],5)

if __name__=='__main__':unittest.main()
