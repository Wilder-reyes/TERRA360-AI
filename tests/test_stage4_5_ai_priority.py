"""Stage 4/5 regression: evidence scoped by geography and goal."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from app.ml.holdout_metrics import binary_holdout_metrics
from app.services.field_shift_ai import evaluated_holdout
from app.services.andes_rotation import compare


class HoldoutEvidenceTest(unittest.TestCase):
    def test_confusion_matches_reproduced_nasa_holdout(self):
        report = evaluated_holdout()
        holdout = report['holdout']
        self.assertEqual(holdout['test_observations'], 11)
        self.assertEqual(holdout['confusion_matrix'], {'tp':5,'tn':2,'fp':0,'fn':4})
        self.assertAlmostEqual(holdout['accuracy_percent'], 63.63636363636363)
        self.assertAlmostEqual(holdout['precision_percent'], 100)
        self.assertAlmostEqual(holdout['recall_percent'], 55.55555555555556)
        self.assertAlmostEqual(holdout['f1_percent'], 71.42857142857143)
        self.assertAlmostEqual(holdout['brier_model'], .2340806662985984)
        self.assertFalse(report['public_inference_for_other_fields'])

    def test_undefined_precision_is_not_fabricated(self):
        result = binary_holdout_metrics([0,0], [.1,.2])
        self.assertIsNone(result['precision_percent'])
        self.assertIsNone(result['recall_percent'])
        self.assertIsNone(result['f1_percent'])
        with self.assertRaises(ValueError):
            binary_holdout_metrics([1,0], [.3,float('nan')])
        with self.assertRaises(ValueError):
            binary_holdout_metrics([1,0], [.3])

    def test_scoped_api_reports_chalhuas_abstention(self):
        import importlib.util
        if importlib.util.find_spec('earthaccess') is None:
            self.skipTest('Full API imports require earthaccess; install backend requirements in CI')
        from fastapi.testclient import TestClient
        from app.main import app
        response=TestClient(app).get('/api/ai/validated-models')
        self.assertEqual(response.status_code,200,response.text)
        body=response.json()
        self.assertEqual(body['chalhuas']['status'],'not_trained_or_spatially_validated')
        self.assertIsNone(body['chalhuas']['metrics'])
        self.assertIn('Barranca',body['models'][0]['scope'])

    def test_priority_effects_are_explanatory_not_fake_scores(self):
        seq=['papa','arveja','papa','arveja']
        water=compare(seq,2027,'water')
        soil=compare(seq,2027,'soil')
        both=compare(seq,2027,'both')
        self.assertIn('agua',water['comparison_summary_es'])
        self.assertIn('estructura botánica',soil['comparison_summary_es'])
        self.assertIn('equilibrio',both['comparison_summary_es'])
        self.assertFalse(water['priority_evidence']['quantitative_water_savings_available'])
        self.assertIsNone(water['automatic_recommendation'])
        reference=soil['strategies'][1]
        self.assertEqual(reference['comparison_to_user_sequence']['additional_botanical_families'],2)
        self.assertEqual(reference['comparison_to_user_sequence']['adjacent_family_repetitions_change'],0)

if __name__=='__main__':unittest.main()
