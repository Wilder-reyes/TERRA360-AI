"""AI decisions are explainable, constrained and abstain when evidence is lacking."""
import sys
import unittest
from pathlib import Path
from pydantic import ValidationError
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
from app.schemas.scenarios import ScenarioRequest
from app.services.arie import evaluate


class AIDecisionTests(unittest.TestCase):
    def test_maximum_five_crop_permutations(self):
        r=evaluate(ScenarioRequest(crops=['maize','tarwi','faba','potato','barley']))
        self.assertEqual(r['ai_decision']['candidate_count'],120)
        self.assertEqual(r['ai_decision']['method_type'],'symbolic_constraint_search_not_trained_predictive_model')

    def test_soil_permutation_recommendation_matches_s1(self):
        r=evaluate(ScenarioRequest(crops=['maize','barley','faba','potato'],baseline_crops=['maize'],priority='soil'))
        ai=r['ai_decision'];self.assertEqual(ai['status'],'structural_option_for_review')
        self.assertEqual(ai['sequence_for_review'],r['scenario_comparison'][1]['sequence'])
        self.assertLess(ai['comparison']['candidate_same_family_transitions'],ai['comparison']['farmer_proposal_same_family_transitions'])
        self.assertFalse(r['is_yield_prediction'])

    def test_no_structural_gain_abstains(self):
        ai=evaluate(ScenarioRequest(crops=['maize','tarwi','potato'],priority='soil'))['ai_decision']
        self.assertIsNone(ai['chosen_for_review']);self.assertEqual(ai['status'],'no_evidence_to_rank_rotations')

    def test_water_priority_never_claims_water_savings(self):
        ai=evaluate(ScenarioRequest(crops=['maize','barley','tarwi'],priority='water',water_access='rainfed'))['ai_decision']
        self.assertIsNone(ai['chosen_for_review'])
        self.assertEqual(ai['status'],'water_comparison_not_evaluable')
        self.assertTrue(ai['no_water_savings_claim'])

    def test_income_requires_cost_and_market_evidence(self):
        ai=evaluate(ScenarioRequest(crops=['maize','faba'],priority='income',market_intent='sale'))['ai_decision']
        self.assertEqual(ai['status'],'income_comparison_not_evaluable')
        self.assertIsNone(ai['chosen_for_review'])

    def test_farmer_market_constraint_respected(self):
        ai=evaluate(ScenarioRequest(crops=['maize','tarwi','barley'],priority='soil',market_intent='sale',market_available_crops=['maize']))['ai_decision']
        self.assertEqual(ai['status'],'farmer_constraint_conflict')
        self.assertFalse(ai['hard_constraints'][0]['satisfied'])
        self.assertIn('barley',ai['hard_constraints'][0]['affected_crops'])

    def test_income_consumption_does_not_invent_market(self):
        ai=evaluate(ScenarioRequest(crops=['maize','barley','tarwi'],priority='soil',market_intent='consumption'))['ai_decision']
        self.assertEqual(ai['hard_constraints'],[])

    def test_location_requires_pair(self):
        with self.assertRaises(ValidationError):
            ScenarioRequest(crops=['maize','faba'],latitude=11)

    def test_invalid_inputs_rejected(self):
        for kwargs in ({'sowing_month':13},{'budget_limit':-1}, {'market_available_crops':['maize','maize']},
                       {'climate_seasonality':{'months':[30.0]*11,'years_with_data':10}},
                       {'climate_seasonality':{'months':[-4.0]*12,'years_with_data':10}}):
            with self.subTest(kwargs=kwargs), self.assertRaises(ValidationError):
                ScenarioRequest(crops=['maize','faba'],**kwargs)

    def test_sowing_rain_warning_is_only_regional_context(self):
        ai=evaluate(ScenarioRequest(crops=['maize','tarwi'],sowing_month=1,priority='soil',
                                    climate_seasonality={'months':[5.0]+[45.0]*11,'years_with_data':10}))['ai_decision']
        self.assertTrue(any(w['code']=='sowing_month_rain' for w in ai['warnings']))
        self.assertTrue(ai['requires_local_validation'])

    def test_frontier_is_deterministic(self):
        request=ScenarioRequest(crops=['maize','barley','faba','potato'],baseline_crops=['maize'])
        self.assertEqual(evaluate(request)['ai_decision']['comparison']['frontier_sample'],
                         evaluate(request)['ai_decision']['comparison']['frontier_sample'])

if __name__=='__main__':unittest.main()
