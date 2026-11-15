import json
import sys
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
from train_chalhuas_hls import compute

class TrainingDataGateTest(unittest.TestCase):
    def setUp(self):
        self.polygon={"type":"Polygon","coordinates":[[
          [-75.3666,-12.0475],[-75.3659,-12.0475],
          [-75.3659,-12.0470],[-75.3666,-12.0470],[-75.3666,-12.0475]]]}
        self.payload={"sensor_id":"hls","sensor":"NASA HLS v2.0 (Landsat 8/9 + Sentinel-2, 30 m)",
           "parcel_area_ha_approx":0.43,"months":[]}
    def test_refuses_fake_or_sparse_data(self):
        with self.assertRaises(ValueError):compute(self.payload,self.polygon,"CHALHUAS-1","fake-sha")
    def test_refuses_unreferenced_observation(self):
        self.payload["months"]=[{"month":f"{2021+i//12:04}-{1+i%12:02}","ndvi":.1 if i%2 else .5} for i in range(50)]
        with self.assertRaises(ValueError):compute(self.payload,self.polygon,"CHALHUAS-1","fake-sha")
    def test_wrong_sensor_rejected(self):
        self.payload["sensor_id"]="sentinel2"
        with self.assertRaises(ValueError):compute(self.payload,self.polygon,"CHALHUAS-1","fake-sha")

if __name__=="__main__":unittest.main()
