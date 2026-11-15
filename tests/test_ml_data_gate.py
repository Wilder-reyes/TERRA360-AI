"""Validate that agricultural ML cannot train on demo or missing field records."""
import importlib.util
import sys
import csv
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location("biotex_train",ROOT/"scripts"/"train_agro_model.py")
TRAIN=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(TRAIN)


class RealDataGateTests(unittest.TestCase):
    def test_nonexistent_dataset_refuses_to_train(self):
        with self.assertRaises(ValueError):
            TRAIN.load_real_data(Path("/no/such/real/biotex-data.csv"))

    def test_one_sample_or_unconsented_record_is_rejected(self):
        fields=["plot_code","consent","verified_by","zone","crop_id","season_start",
                "rain_30d_mm","temp_mean_c","ndvi_mean","soil_ph","water_m3_ha","yield_kg_ha"]
        with tempfile.TemporaryDirectory() as root:
            path=Path(root)/"observations.csv"
            sample=dict(plot_code="p1",consent="yes",verified_by="farmer",zone="supe",
                        crop_id="camote",season_start="2026-03",rain_30d_mm="5",
                        temp_mean_c="23",ndvi_mean=".5",soil_ph="6.5",
                        water_m3_ha="2300",yield_kg_ha="20000")
            with path.open("w",newline="",encoding="utf-8") as stream:
                writer=csv.DictWriter(stream,fieldnames=fields);writer.writeheader();writer.writerow(sample)
            with self.assertRaisesRegex(ValueError,"at least"):
                TRAIN.load_real_data(path)
            sample["consent"]="no"
            with path.open("w",newline="",encoding="utf-8") as stream:
                writer=csv.DictWriter(stream,fieldnames=fields);writer.writeheader();writer.writerow(sample)
            with self.assertRaisesRegex(ValueError,"explicit consent"):
                TRAIN.load_real_data(path)

    def test_unsupported_place_is_not_used_to_extend_local_model(self):
        fields=["plot_code","consent","verified_by","zone","crop_id","season_start",
                "rain_30d_mm","temp_mean_c","ndvi_mean","soil_ph","water_m3_ha","yield_kg_ha"]
        with tempfile.TemporaryDirectory() as root:
            path=Path(root)/"observations.csv"
            row=dict(plot_code="p1",consent="yes",verified_by="farmer",zone="cusco",
                     crop_id="maiz_amarillo_duro",season_start="2026-03",rain_30d_mm="25",
                     temp_mean_c="23",ndvi_mean=".5",soil_ph="6.5",
                     water_m3_ha="2300",yield_kg_ha="20000")
            with path.open("w",newline="",encoding="utf-8") as stream:
                writer=csv.DictWriter(stream,fieldnames=fields);writer.writeheader();writer.writerow(row)
            with self.assertRaisesRegex(ValueError,"locally validated"):
                TRAIN.load_real_data(path)

if __name__=="__main__":unittest.main()
