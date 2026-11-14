"""Hazard signals, seasonal ties, completeness, geography and report expiry."""
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
from hashlib import sha256
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

from fastapi.testclient import TestClient
import numpy as np
from pydantic import ValidationError
from pyproj import Geod

from app.main import app
from app.connectors.risk_weather import POINTS, HISTORY_VARIABLES, parameters, normalize_points
from app.schemas.risk_alerts import RiskSnapshot, DailyRiskInput
from app.services import risk_alerts as service
from app.services.risk_terrain import slope_summary


def fixture():
    """Synthetic deterministic inputs, never bundled as application observations."""
    issued = datetime(2026, 11, 14, 18, tzinfo=timezone.utc)
    history_start, history_end = date(2026, 10, 9), date(2026, 11, 7)
    forecast_start = date(2026, 11, 15)
    points = []
    for point in POINTS:
        points.append({**point, "history_grid": [point["latitude"], point["longitude"]],
                       "forecast_grid": [point["latitude"], point["longitude"]],
                       "history": [{"date": history_start+timedelta(days=i), "precipitation_mm": 1, "soil_m3_m3": .3} for i in range(30)],
                       "forecast": [{"date": forecast_start+timedelta(days=i), "precipitation_mm": 1, "et0_mm": 2, "tmin_c": 5, "tmax_c": 20} for i in range(7)],
                       "baseline": [{"end_year": 1991+i, "precipitation_30d_mm": 10+i, "soil_7d_m3_m3": .15+i*.005} for i in range(30)],
                       "terrain": {"slope_p75_degrees": 5, "valid_fraction": 1, "source_assets": []}})
    return {"method_version": service.rules()["version"], "issued_at": issued, "expires_at": issued+timedelta(hours=12),
            "forecast_start": forecast_start, "forecast_end": forecast_start+timedelta(days=6),
            "history_start": history_start, "history_end": history_end, "points": points,
            "provenance": [{"purpose": "forecast", "sha256": "f"*64}, {"purpose": "history", "sha256": "a"*64}]}


def alerts(value):
    point = RiskSnapshot(**value).points[0]
    return {a["id"]: a for a in service.point_alerts(point)}


def save_fixture(root, value):
    raw = RiskSnapshot(**value).model_dump_json().encode()
    (root / "pilot-snapshot.json").write_bytes(raw)
    (root / "pilot-manifest.json").write_text(json.dumps({"sha256": sha256(raw).hexdigest()}))


class RiskIndicatorTests(TestCase):
    def test_five_indicators_and_no_unjustified_signal(self):
        result = alerts(fixture())
        self.assertEqual(set(result), {"drought", "temperature", "excess_rain", "erosion", "water_stress"})
        self.assertTrue(all(a["level"] == "no_signal" for a in result.values()))

    def test_seasonal_tied_zeros_do_not_create_a_drought(self):
        data = fixture()
        for r in data["points"][0]["history"]: r["precipitation_mm"] = 0
        for b in data["points"][0]["baseline"]: b["precipitation_30d_mm"] = 0
        output = alerts(data)["drought"]
        self.assertEqual(output["level"], "no_signal")
        self.assertEqual(output["metrics"][1]["value"], 50)

    def test_large_rainfall_deficit_is_detected_against_matching_baseline(self):
        data = fixture()
        for r in data["points"][0]["history"]: r["precipitation_mm"] = 0
        output = alerts(data)["drought"]
        self.assertEqual(output["level"], "high")
        self.assertEqual(output["coverage"]["baseline_years"], 30)

    def test_one_missing_recent_day_blocks_rainfall_drought_evaluation(self):
        data = fixture();data["points"][0]["history"][8]["precipitation_mm"] = None
        self.assertEqual(alerts(data)["drought"]["level"], "insufficient_data")

    def test_inadequate_reference_history_never_becomes_no_signal(self):
        data = fixture()
        for b in data["points"][0]["baseline"][:6]:
            b["precipitation_30d_mm"] = None;b["soil_7d_m3_m3"] = None
        result = alerts(data)
        self.assertEqual(result["drought"]["level"], "insufficient_data")
        self.assertEqual(result["water_stress"]["level"], "insufficient_data")

    def test_frost_and_heat_thresholds_include_the_boundary(self):
        for key, value in [("tmin_c", -3), ("tmax_c", 40)]:
            data = fixture();data["points"][0]["forecast"][2][key] = value
            self.assertEqual(alerts(data)["temperature"]["level"], "high")
        for key, value in [("tmin_c", 0), ("tmax_c", 35)]:
            data = fixture();data["points"][0]["forecast"][2][key] = value
            self.assertEqual(alerts(data)["temperature"]["level"], "monitor")

    def test_known_hazard_survives_partial_temperature_coverage(self):
        data = fixture();rows=data["points"][0]["forecast"]
        rows[0]["tmin_c"] = -4;rows[1]["tmax_c"] = None
        result = alerts(data)["temperature"]
        self.assertEqual(result["level"], "high")
        self.assertEqual(result["coverage"]["valid"], 13)

    def test_missing_temperature_without_a_known_trigger_is_not_safe(self):
        data = fixture();data["points"][0]["forecast"][1]["tmax_c"] = None
        self.assertEqual(alerts(data)["temperature"]["level"], "insufficient_data")

    def test_heavy_daily_rain_or_three_day_accumulation_trigger(self):
        data = fixture();data["points"][0]["forecast"][0]["precipitation_mm"] = 40
        self.assertEqual(alerts(data)["excess_rain"]["level"], "high")
        for row in data["points"][0]["forecast"]: row["precipitation_mm"] = 18
        result = alerts(data)["excess_rain"]
        self.assertEqual(result["level"], "monitor")
        self.assertEqual(result["metrics"][1]["value"], 54)

    def test_three_day_rain_never_bridges_a_gap_or_imputes_zero(self):
        data = fixture()
        for i, r in enumerate(data["points"][0]["forecast"]): r["precipitation_mm"] = None if i % 2 else 10
        result = alerts(data)["excess_rain"]
        self.assertEqual(result["level"], "insufficient_data")
        self.assertIsNone(result["metrics"][1]["value"])

    def test_erosion_needs_both_rain_and_slope_and_never_estimates_soil_loss(self):
        data = fixture();data["points"][0]["terrain"]["slope_p75_degrees"] = 30
        self.assertEqual(alerts(data)["erosion"]["level"], "no_signal")
        data["points"][0]["forecast"][0]["precipitation_mm"] = 100
        result = alerts(data)["erosion"]
        self.assertEqual(result["level"], "monitor")
        self.assertIn("soil_erodibility", result["missing_factors"])
        self.assertNotIn("soil_loss", result)

    def test_unreliable_dem_is_unassessed_even_if_a_slope_value_exists(self):
        data = fixture();data["points"][0]["terrain"]["valid_fraction"] = .5
        self.assertEqual(alerts(data)["erosion"]["level"], "insufficient_data")

    def test_water_stress_requires_soil_anomaly_and_climatic_deficit(self):
        data = fixture();p=data["points"][0]
        for row in p["history"]:row["soil_m3_m3"] = 0
        self.assertEqual(alerts(data)["water_stress"]["level"], "no_signal")
        for row in p["forecast"]:row["et0_mm"] = 5;row["precipitation_mm"] = 0
        result = alerts(data)["water_stress"]
        self.assertEqual(result["level"], "high")
        self.assertEqual(result["metrics"][0]["value"], 0)
        self.assertEqual(result["metrics"][2]["value"], 35)

    def test_missing_water_inputs_do_not_become_a_negative_risk_assessment(self):
        for block, key, at in [("forecast", "et0_mm", 1), ("history", "soil_m3_m3", 29)]:
            data=fixture();data["points"][0][block][at][key] = None
            self.assertEqual(alerts(data)["water_stress"]["level"], "insufficient_data")

    def test_missing_category_does_not_become_an_overall_safe_label(self):
        data=fixture();data["points"][0]["terrain"]["slope_p75_degrees"] = None
        report=service.build_report(RiskSnapshot(**data))
        self.assertEqual(report["points"][0]["overall"], "insufficient_data")
        self.assertEqual(report["summary"]["erosion"]["insufficient_data"], 1)


class RiskDeliveryTests(TestCase):
    def test_real_bundled_inputs_verify_without_depending_on_today(self):
        snapshot=service.load_snapshot(service.DATA/'risk_alerts')
        self.assertEqual(len(snapshot.points),9)
        self.assertEqual(len(snapshot.provenance),32)
        self.assertTrue(all(len(source['sha256'])==64 for source in snapshot.provenance))
        self.assertEqual(len({a['url'] for p in snapshot.points for a in p.terrain.source_assets}),2)
        report=service.build_report(snapshot)
        self.assertEqual(len(report['terrain_assets']),2)
        self.assertEqual(len(report['rules_sha256']),64)

    def test_clock_expiry_midnight_and_future_issue_fail_closed(self):
        snapshot=RiskSnapshot(**fixture())
        with patch.object(service, "load_snapshot", return_value=snapshot):
            self.assertEqual(service.latest_report(snapshot.issued_at+timedelta(minutes=1))["status"], "available")
            for now in [snapshot.issued_at-timedelta(seconds=1),snapshot.expires_at,datetime(2026,11,15,5,tzinfo=timezone.utc)]:
                result=service.latest_report(now)
                self.assertEqual(result["status"], "stale_report")
                self.assertIsNone(result["report"])

    def test_missing_and_corrupt_inputs_are_explicit(self):
        with TemporaryDirectory() as name, patch.object(service,"snapshot_directory",return_value=Path(name)):
            self.assertEqual(service.latest_report()["status"], "not_prepared")
            save_fixture(Path(name), fixture())
            (Path(name)/"pilot-snapshot.json").write_text('{}')
            self.assertEqual(service.latest_report()["status"], "invalid_report")

    def test_verified_snapshot_and_api_contract(self):
        with TemporaryDirectory() as name:
            save_fixture(Path(name), fixture())
            snapshot=service.load_snapshot(name)
        with patch.object(service,"load_snapshot",return_value=snapshot), patch("app.api.risk_routes.latest_report",return_value=service.latest_report(snapshot.issued_at+timedelta(minutes=1))):
            client=TestClient(app)
            report=client.get('/api/agro/risks/report')
            self.assertEqual(report.status_code,200)
            self.assertEqual(len(report.json()["report"]["points"]),9)
            self.assertEqual(len(client.get('/api/agro/risks/catalog').json()["hazards"]),5)

    def test_wrong_grid_dates_duplicates_and_nan_are_rejected(self):
        for problem in ('grid','date','duplicate','temperature','nan'):
            data=fixture();p=data["points"][0]
            if problem=='grid':p["history_grid"][0] += .25
            if problem=='date':p["forecast"][1]["date"] = p["forecast"][0]["date"]
            if problem=='duplicate':data["points"][1] = deepcopy(p)
            if problem=='temperature':p["forecast"][0]["tmin_c"] = 30
            if problem=='nan':p["forecast"][0]["et0_mm"] = float('nan')
            with self.subTest(problem=problem), self.assertRaises(ValidationError): RiskSnapshot(**data)
        with self.assertRaises(ValidationError):DailyRiskInput(date=date(2026,1,1),precipitation_mm=True)


class RiskSourceTests(TestCase):
    def payload(self):
        return [{"latitude":p["latitude"],"longitude":p["longitude"],"timezone":"America/Lima","utc_offset_seconds":-18000,
                 "daily_units":{k:v[1] for k,v in HISTORY_VARIABLES.items()},
                 "daily":{"time":["2026-11-01"],"precipitation_sum":[0],"soil_moisture_0_to_100cm_mean":[None]}} for p in POINTS]

    def test_upstream_zero_missing_dates_and_no_data(self):
        result=normalize_points(self.payload(),date(2026,11,1),date(2026,11,2))
        self.assertEqual(result[0]["rows"][0]["precipitation_mm"],0)
        self.assertIsNone(result[0]["rows"][0]["soil_m3_m3"])
        self.assertIsNone(result[0]["rows"][1]["precipitation_mm"])

    def test_units_location_order_and_date_duplicates_are_verified(self):
        for problem in ('units','order','duplicate'):
            data=self.payload()
            if problem=='units':data[0]["daily_units"]["precipitation_sum"]='inch'
            if problem=='order':data[0]["location_id"]=1
            if problem=='duplicate':data[0]["daily"]["time"] *= 2
            with self.subTest(problem=problem),self.assertRaises(ValueError): normalize_points(data,date(2026,11,1),date(2026,11,2))

    def test_explicit_models_and_nine_native_elevations(self):
        p=parameters(date(2026,11,1),date(2026,11,2))
        self.assertEqual(p['models'],'era5')
        self.assertEqual(p['elevation'].split(','),['nan']*9)
        self.assertEqual(p['cell_selection'],'nearest')

    def test_dem_slope_on_a_plane_and_missing_values(self):
        lat=-13.5;step=1/1200
        dx=Geod(ellps='WGS84').inv(0,lat,step,lat)[2]
        values=np.tile(np.arange(31)*dx*np.tan(np.radians(20)),(31,1))
        output=slope_summary(values,step,step,lat)
        self.assertAlmostEqual(output['slope_p75_degrees'],20,places=2)
        self.assertEqual(output['valid_fraction'],1)
        missing=slope_summary(np.full((31,31),np.nan),step,step,lat)
        self.assertIsNone(missing['slope_p75_degrees'])
        self.assertEqual(missing['valid_fraction'],0)
