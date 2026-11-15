import unittest
from datetime import date
from app.services.scientific_registry import public_catalog
from app.quality.evidence import daily_coverage


class ScientificProvenanceTests(unittest.TestCase):
    def test_sources_include_candid_non_connected_senamhi(self):
        catalog = public_catalog()
        ids = {item['id'] for item in catalog['sources']}
        self.assertTrue({'nasa_gibs_ndvi','nasa_gibs_imerg','nasa_power','smap','gpm_polygon','senamhi','era5'}.issubset(ids))
        station = next(s for s in catalog['sources'] if s['id']=='senamhi')
        self.assertIsNone(station['endpoint'])
        self.assertEqual(station['status'],'official_reference_no_live_data_ingested')
        self.assertFalse(station['used_in_agricultural_ranking'])
        for item in catalog['sources']:
            self.assertTrue(item['source_url'].startswith('https://'))
            self.assertTrue(item['spatial_support'])
            self.assertTrue(item['temporal_support'])

    def test_missing_and_sentinel_values_are_not_reclassified_as_valid(self):
        records=[
            {'date':'2026-11-01','PRECTOTCORR':2.0,'T2M':13.0},
            {'date':'2026-11-02','PRECTOTCORR':None,'T2M':None},
            {'date':'2026-11-03','PRECTOTCORR':float('nan'),'T2M':True},
        ]
        data=daily_coverage(records,date(2026,11,1),date(2026,11,3))
        self.assertEqual(data['expected_days'],3)
        self.assertEqual(data['valid_days_by_variable']['PRECTOTCORR'],1)
        self.assertEqual(data['coverage_percent_by_variable']['PRECTOTCORR'],33.3)
        self.assertFalse(data['missing_days_are_zero'])
        self.assertEqual(data['completeness'],'partial')

    def test_duplicate_and_out_of_period_dates_cannot_inflate_coverage(self):
        rows = [
            {'date': '2026-11-01', 'PRECTOTCORR': 2},
            {'date': '2026-11-01', 'PRECTOTCORR': 2},
            {'date': '2026-10-31', 'PRECTOTCORR': 999},
        ]
        q=daily_coverage(rows,date(2026,11,1),date(2026,11,2))
        self.assertEqual(q['valid_days_by_variable']['PRECTOTCORR'],1)
        self.assertEqual(q['calendar_days_represented'],1)
        self.assertEqual(q['completeness'],'partial')

    def test_year_coverage_leap_day(self):
        data=daily_coverage([],date(2024,1,1),date(2024,12,31))
        self.assertEqual(data['expected_days'],366)
        self.assertEqual(data['completeness'],'partial')

    def test_source_endpoint_is_registered(self):
        from app.api.scientific_sources_routes import router
        routes={route.path for route in router.routes}
        self.assertIn('/api/environment/scientific-sources',routes)

if __name__=='__main__':
    unittest.main()
