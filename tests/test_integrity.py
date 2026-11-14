import unittest
from datetime import date
from pydantic import ValidationError
from app.connectors.nasa_power import normalize_daily
from app.services.environment_metrics import calculate_statistics
from app.schemas.scenarios import ScenarioRequest
from app.services.arie import evaluate

class IntegrityTests(unittest.TestCase):
    def test_missing_calendar_days_and_parameters(self):
        result = normalize_daily({'properties': {'parameter': {'PRECTOTCORR': {'20261101': 1, '20261103': 2}}}}, date(2026,11,1), date(2026,11,3))
        self.assertEqual(len(result['records']), 3)
        self.assertIsNone(result['records'][1]['PRECTOTCORR'])
        self.assertIsNone(result['records'][0]['T2M'])

    def test_nonfinite_values_are_missing(self):
        stats = calculate_statistics([1, float('nan'), float('inf'), None])
        self.assertEqual(stats['count'], 1)
        self.assertEqual(stats['missing_count'], 3)
        self.assertEqual(stats['total'], 1)

    def test_climate_total_requires_observations(self):
        with self.assertRaises(ValidationError):
            ScenarioRequest(crops=['maize'], climate_context={'start':'2026-11-01', 'end':'2026-11-02', 'valid_rain_days':0, 'precipitation_total_mm':100})

    def test_scenarios_preserve_history_and_selected_crop_set(self):
        result=evaluate(ScenarioRequest(crops=['maize','barley','tarwi'],baseline_crops=['maize','maize']))
        a,b,c=result['scenario_comparison']
        self.assertEqual(a['sequence'], ['maize','maize'])
        self.assertEqual(set(b['sequence']), {'maize','barley','tarwi'})
        self.assertEqual(b['facts']['adjacent_same_family'], 0)
        self.assertEqual(c['sequence'], ['maize','barley','tarwi'])
        self.assertEqual(c['water_demand_status'], 'not_evaluable')
        self.assertTrue(all(s['risks'] and s['missing_data'] for s in [a,b,c]))

    def test_scenarios_do_not_invent_baseline(self):
        result=evaluate(ScenarioRequest(crops=['maize','tarwi']))
        self.assertEqual(result['scenario_comparison'][0]['sequence'], [])
        self.assertEqual(result['scenario_comparison'][0]['status'], 'requires_farmer_baseline')

if __name__ == '__main__': unittest.main()
