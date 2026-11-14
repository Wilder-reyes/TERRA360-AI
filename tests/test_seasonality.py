import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
from app.services.seasonality import monthly_values,summarize_months

class SeasonalityTests(unittest.TestCase):
 def test_zero_rain_is_valid(self):
  days=[{'date':f'2025-01-{d:02d}','PRECTOTCORR':0.0} for d in range(1,32)]
  result=monthly_values(days,2025)
  self.assertEqual(result[0]['total_mm'],0.0)
  self.assertTrue(result[0]['complete_enough'])
 def test_missing_not_aggregated_as_zero(self):
  days=[{'date':f'2025-01-{d:02d}','PRECTOTCORR':1.0} for d in range(1,12)]
  result=monthly_values(days,2025)
  self.assertIsNone(result[0]['total_mm']);self.assertFalse(result[0]['complete_enough'])
 def test_leap_february(self):
  days=[{'date':f'2024-02-{d:02d}','PRECTOTCORR':1.0} for d in range(1,29)]
  result=monthly_values(days,2024)
  self.assertEqual(result[1]['valid_days'],28)
 def test_insufficient_years_not_presented_as_normal(self):
  rows=[{'month':1,'total_mm':10,'complete_enough':True} for i in range(4)]
  result=summarize_months(rows)
  self.assertIsNone(result['months'][0]['median_rain_mm']);self.assertFalse(result['coverage_ok'])
 def test_median_when_five_years_available(self):
  rows=[{'month':1,'total_mm':i*10,'complete_enough':True} for i in range(1,6)]
  result=summarize_months(rows)
  self.assertEqual(result['months'][0]['median_rain_mm'],30.0)

if __name__=='__main__': unittest.main()
