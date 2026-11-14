"""Immutable FAO ECOCROP snapshot for exploration, not local suitability.
Credit: Source data from the FAO EcoCrop database, Food and Agriculture
Organization of the United Nations; via CGIAR Climate Action Data Hub.
"""
import json
from functools import lru_cache
from pathlib import Path

PATH=Path(__file__).with_name("ecocrop_species.json")
@lru_cache(maxsize=1)
def snapshot():
    data=json.loads(PATH.read_text(encoding="utf-8"))
    if data.get("locally_validated") is not False or len(data.get("species",[]))!=2568:
        raise RuntimeError("ECOCROP record integrity check failed")
    if data.get("git_blob_sha1")!="849cc89873ef766690b12ac8251db4639c642084":
        raise RuntimeError("Unexpected ECOCROP source version")
    return data

def species_ids():
    return {row["id"] for row in snapshot()["species"]}

def ecocrop_profiles():
    return {
        row["id"]: {
            "name":row["name"],"scientific_name":row["scientific_name"],"family":row["family"],
            "role":"FAO ECOCROP · exploratorio",
            "kc":None,"cycle_days":None,"references":["ecocrop"],
            "kc_note":"FAO EcoCrop expert estimates, not locally validated crop coefficients or planting suitability.",
            "common_names":row["common_names"],
            "evidence_level":"ecocrop_expert_estimates_not_locally_validated",
            "ecocrop_thresholds":row["ecology"],
            "ecocrop_code":row["ecoportcode"],
        }
        for row in snapshot()["species"]
    }
