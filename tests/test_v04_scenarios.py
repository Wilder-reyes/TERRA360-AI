"""Regression checks for the three-step farmer journey contract."""
import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.scenarios import ScenarioRequest
from app.services.arie import evaluate


class FarmerJourneyContract(unittest.TestCase):
    def test_no_fictitious_soil_improvement_when_proposed_order_already_minimal(self):
        outcome = evaluate(ScenarioRequest(
            crops=['tarwi','maize','potato'],
            baseline_crops=['maize','maize'],
            priority='soil',
        ))
        s0,s1,s2 = outcome['scenario_comparison']
        self.assertEqual(s0['sequence'], ['maize','maize'])
        self.assertEqual(s1['order_changed'], False)
        self.assertEqual(s1['sequence'], ['tarwi','maize','potato'])
        self.assertIn('no propone un orden distinto', s1['reason'])
        self.assertEqual(s2['water_demand_status'], 'not_evaluable')
        self.assertFalse(outcome['is_yield_prediction'])

    def test_diversity_reordering_transparently_changes_when_possible(self):
        outcome = evaluate(ScenarioRequest(crops=['maize','barley','tarwi'],baseline_crops=['maize']))
        s1=outcome['scenario_comparison'][1]
        self.assertTrue(s1['order_changed'])
        self.assertEqual(set(s1['sequence']), {'maize','barley','tarwi'})
        self.assertEqual(s1['facts']['adjacent_same_family'], 0)

    def test_api_evaluate_end_to_end_offline(self):
        result=TestClient(app).post('/api/arie/evaluate',json={
            'crops':['maize','tarwi','potato'],
            'baseline_crops':['maize','maize'],
            'priority':'water', 'water_access':'unknown',
        })
        self.assertEqual(result.status_code,200)
        data=result.json()
        self.assertEqual(len(data['scenario_comparison']),3)
        self.assertEqual(data['scenario_comparison'][0]['sequence'],['maize','maize'])
        self.assertTrue(data['scenario_comparison'][2]['missing_data'])

    def test_history_route_is_registered(self):
        endpoints={route.path for route in app.routes if hasattr(route,'path')}
        self.assertIn('/api/environment/nasa-power/history',endpoints)

if __name__ == '__main__':
    unittest.main()
