import sys
import unittest
from datetime import date,timedelta
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
from app.ml.rain_model import valid_months, report_skill, fit_ridge, predict_ridge
import numpy as np

class MLTests(unittest.TestCase):
 def test_rejects_incomplete_month(self):
  self.assertEqual(valid_months([{'date':'2025-01-01','PRECTOTCORR':1.0,'T2M':12.0}]),[])
 def test_valid_complete_month(self):
  rows=[{'date':f'2025-01-{x:02d}','PRECTOTCORR':0.0,'T2M':15.0} for x in range(1,32)]
  result=valid_months(rows)
  self.assertEqual(result[0]['rain_total_mm'],0)
 def test_no_fabricated_model_with_insufficient_history(self):
  self.assertEqual(report_skill([])['status'],'not_evaluable')
 def test_ridge_returns_finite_nonnegative(self):
  X=np.arange(120,dtype=float).reshape(20,6)/10.0
  y=np.log1p(np.arange(20,dtype=float)+1)
  model=fit_ridge(X,y)
  values=predict_ridge(model,X)
  self.assertTrue(np.isfinite(values).all())
  self.assertTrue((values>=0).all())

if __name__=='__main__':unittest.main()
