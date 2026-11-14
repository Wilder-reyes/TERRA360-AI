from app.connectors.nasa_power import normalize_daily


def test_normalize_daily_converts_missing_and_formats_date():
    payload = {
        "properties": {
            "parameter": {
                "PRECTOTCORR": {"20261101": 2.5, "20261102": -999},
                "T2M": {"20261101": 12.0, "20261102": 13.0},
            }
        }
    }
    result = normalize_daily(payload)
    assert result["records"][0]["date"] == "2026-11-01"
    assert result["records"][0]["PRECTOTCORR"] == 2.5
    assert result["records"][1]["PRECTOTCORR"] is None
    assert result["records"][1]["T2M"] == 13.0


# Keep this regression visible to the project's documented unittest runner.
import unittest

class NasaNormalizationTests(unittest.TestCase):
    def test_missing_and_dates(self):
        test_normalize_daily_converts_missing_and_formats_date()
