import unittest
from unittest.mock import AsyncMock, patch
from datetime import date, timedelta
from fastapi import HTTPException
from app.api.history_routes import history

class HistoryTests(unittest.IsolatedAsyncioTestCase):
    async def test_full_leap_year_and_partial_year_are_not_confused(self):
        async def fake_fetch(latitude, longitude, start, end):
            days = [(start + timedelta(days=i)).strftime('%Y%m%d') for i in range((end-start).days+1)]
            if start.year == 2023:
                days.pop()
            return {'properties': {'parameter': {'PRECTOTCORR': {d: 1 for d in days}, 'T2M': {d: 10 for d in days}}}}
        with patch('app.api.history_routes.fetch_daily_point', new=fake_fetch):
            result = await history(-13.3, -71.9, 2024, 3)
        records = {r['year']: r for r in result['records']}
        self.assertEqual(records[2024]['precipitation_total_mm'], 366)
        self.assertEqual(records[2024]['status'], 'complete')
        self.assertIsNone(records[2023]['precipitation_total_mm'])
        self.assertEqual(records[2023]['valid_rain_days'], 364)

    async def test_incomplete_year_never_becomes_full_rainfall_total(self):
        raw = {'properties': {'parameter': {'PRECTOTCORR': {'20230101': 2}, 'T2M': {'20230101': 10}}}}
        with patch('app.api.history_routes.fetch_daily_point', new=AsyncMock(return_value=raw)):
            result = await history(-13.3, -71.9, 2023, 3)
        self.assertFalse(result['is_climate_trend'])
        self.assertEqual(len(result['records']), 3)
        self.assertTrue(all(r['precipitation_total_mm'] is None for r in result['records']))

    async def test_current_year_rejected(self):
        with self.assertRaises(HTTPException):
            await history(-13.3, -71.9, date.today().year, 3)

    async def test_window_before_archive_is_rejected(self):
        with self.assertRaises(HTTPException):
            await history(-13.3, -71.9, 1982, 3)

    async def test_source_failure_is_explicit(self):
        from app.connectors.nasa_power import NasaPowerError
        with patch('app.api.history_routes.fetch_daily_point', new=AsyncMock(side_effect=NasaPowerError('offline'))):
            result = await history(-13.3, -71.9, 2023, 3)
        self.assertTrue(all(r['status'] == 'unavailable' for r in result['records']))
