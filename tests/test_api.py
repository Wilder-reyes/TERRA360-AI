import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from fastapi.testclient import TestClient
# Optional NASA Earthdata dependency is not needed for offline endpoint tests.
# It is installed from requirements.txt for actual GPM downloads.
try:
    import earthaccess
except ImportError:
    import types
    sys.modules['earthaccess'] = types.ModuleType('earthaccess')
from app.main import app

class APITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.client=TestClient(app)
    def test_health(self):self.assertEqual(self.client.get('/api/health').status_code,200)
    def test_catalog(self):
        response=self.client.get('/api/arie/catalog')
        self.assertEqual(response.status_code,200)
        self.assertIn('maize',response.json()['crops'])
    def test_evaluate(self):
        response=self.client.post('/api/arie/evaluate',json={'crops':['maize','faba']})
        self.assertEqual(response.status_code,200)
        self.assertFalse(response.json()['is_irrigation_prescription'])
    def test_invalid_sequence(self):
        self.assertEqual(self.client.post('/api/arie/evaluate',json={'crops':['maize','maize']}).status_code,422)
    def test_advanced_scenario_with_climate_and_history(self):
        payload = {
            'crops': ['maize', 'tarwi', 'potato'],
            'baseline_crops': ['maize', 'maize'],
            'priority': 'soil',
            'soil_ph': 6.4,
            'soil_texture': 'loamy',
            'climate_context': {
                'source': 'NASA POWER', 'start': '2026-10-01',
                'end': '2026-10-30', 'valid_rain_days': 30,
                'precipitation_total_mm': 110.2,
            },
        }
        response = self.client.post('/api/arie/evaluate', json=payload)
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        self.assertEqual(data['scenario_comparison'][0]['status'], 'user_reported')
        self.assertEqual(data['facts']['unique_families'], 3)
        self.assertEqual(data['climate_context']['source'], 'NASA POWER')
        self.assertGreaterEqual(len(data['next_steps']), 1)

    def test_observation_window_guard(self):
        response=self.client.get('/api/environment/observations/daily?start=2026-01-01&end=2026-03-01')
        self.assertEqual(response.status_code,422)

if __name__=='__main__':unittest.main()
