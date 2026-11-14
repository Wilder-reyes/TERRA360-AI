"""Expanded exploratory crop catalog — names/families never imply local fitness."""
import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.data.crop_directory import CROP_DIRECTORY, KNOWN_CROP_IDS
from app.services.arie import CROPS
from app.data.ecocrop_catalog import snapshot


class ExtendedCropDirectoryTests(unittest.TestCase):
    def setUp(self):
        self.client=TestClient(app)

    def test_expanded_catalog_has_enough_searchable_taxa(self):
        response=self.client.get('/api/arie/catalog')
        self.assertEqual(response.status_code,200)
        data=response.json()
        self.assertGreaterEqual(len(data['crops']),90)
        self.assertEqual(len(data['crops']),len(KNOWN_CROP_IDS))
        self.assertGreaterEqual(len(data['crops']),2600)
        self.assertEqual(len(snapshot()['species']),2568)
        self.assertIn('ecocrop',data['references'])
        self.assertIn('quinoa',data['crops'])
        self.assertIn('tomato',data['crops'])
        self.assertEqual(data['crops']['tomato']['evidence_level'],'taxonomy_only_no_local_suitability')
        self.assertIsNone(data['crops']['tomato']['kc'])
        self.assertIsNone(data['crops']['tomato']['cycle_days'])
        self.assertEqual(data['crops']['maize']['family'],'Poaceae')

    def test_directory_is_unique_and_only_exploratory(self):
        ids=[record[0] for record in CROP_DIRECTORY]
        self.assertEqual(len(ids),len(set(ids)))
        self.assertTrue(all(CROPS[id]['evidence_level']=='taxonomy_only_no_local_suitability' for id in ids))
        self.assertTrue(all(CROPS[id]['kc'] is None for id in ids))

    def test_ecocrop_estimates_are_not_locally_recommended(self):
        example = snapshot()["species"][0]
        profile = CROPS[example["id"]]
        self.assertEqual(profile["evidence_level"],"ecocrop_expert_estimates_not_locally_validated")
        self.assertIsNone(profile["kc"])
        result=self.client.post("/api/arie/evaluate",json={"crops":[example["id"],"maize"]})
        self.assertEqual(result.status_code,200,result.text)
        self.assertEqual(result.json()["ai_decision"]["status"],"exploratory_catalog_only")
        self.assertIsNone(result.json()["ai_decision"]["chosen_for_review"])

    def test_exploratory_crops_can_be_compared_without_fabricated_fitness(self):
        response=self.client.post('/api/arie/evaluate',json={
            'crops':['quinoa','tomato','cassava'],
            'baseline_crops':['quinoa','quinoa'],
            'priority':'soil',
        })
        self.assertEqual(response.status_code,200,response.text)
        output=response.json()
        self.assertEqual(len(output['scenario_comparison']),3)
        self.assertFalse(output['is_yield_prediction'])
        self.assertFalse(output['is_irrigation_prescription'])
        self.assertEqual(output['ai_decision']['confidence'],'limited_not_field_validated')
        self.assertIsNone(output['ai_decision']['chosen_for_review'])
        self.assertEqual(output['ai_decision']['status'],'exploratory_catalog_only')
        self.assertIn('exploratory_profiles',[w['code'] for w in output['ai_decision']['warnings']])

    def test_unknown_crop_and_more_than_five_are_rejected(self):
        bad=self.client.post('/api/arie/evaluate',json={'crops':['unverified_not_a_crop','maize']})
        self.assertEqual(bad.status_code,422)
        too_many=self.client.post('/api/arie/evaluate',json={'crops':['maize','tarwi','faba','potato','barley','quinoa']})
        self.assertEqual(too_many.status_code,422)
