"""Regression checks for the six-stage scientific pipeline and preserved data."""
import ast
import json
import unittest
from pathlib import Path
from app.quality.power import normalize_daily
from app.geospatial.parcels import verified_subplots
from app.schemas.andes import Subplot

ROOT=Path(__file__).resolve().parents[1]

class ArchitectureTests(unittest.TestCase):
    def test_pure_layers_do_not_depend_on_http_presentation_or_acquisition(self):
        files=list((ROOT/'backend/app/quality').glob('*.py'))+list((ROOT/'backend/app/geospatial').glob('*.py'))
        files.append(ROOT/'backend/app/application/rotation.py')
        for path in files:
            with self.subTest(path=path.name):
                tree=ast.parse(path.read_text(encoding='utf-8-sig'))
                imports=[n.module or '' for n in ast.walk(tree) if isinstance(n,ast.ImportFrom)]
                imports += [x.name for n in ast.walk(tree) if isinstance(n,ast.Import) for x in n.names]
                self.assertFalse(any(x.startswith(('fastapi','httpx','app.api')) for x in imports),imports)

    def test_boolean_power_values_are_unknown_instead_of_numeric_readings(self):
        d=normalize_daily({'properties':{'parameter':{'PRECTOTCORR':{'20260101':True},'T2M':{'20260101':False}}}})
        self.assertIsNone(d['records'][0]['PRECTOTCORR'])
        self.assertIsNone(d['records'][0]['T2M'])

    def test_duplicate_subplot_ids_cannot_overwrite_crop_allocations(self):
        shape={'type':'Polygon','coordinates':[[[-75.367,-12.047],[-75.365,-12.047],[-75.365,-12.049],[-75.367,-12.049],[-75.367,-12.047]]]}
        with self.assertRaisesRegex(ValueError,'identificadores'):
            verified_subplots(shape,[Subplot(id='A',polygon=shape),Subplot(id='A',polygon=shape)])

    def test_frozen_training_source_and_scientific_artifact_are_preserved(self):
        from app.services.field_shift_ai import _git_blob_sha
        artifact=json.loads((ROOT/'backend/app/data/models/barranca_hls_bare_v1.json').read_text())
        self.assertEqual(_git_blob_sha((ROOT/artifact['source_path']).read_bytes()),artifact['source_git_blob_sha'])
        self.assertEqual(len(list((ROOT/'backend/app/data/history_seed').glob('*.json'))),7)

if __name__=='__main__':unittest.main()
