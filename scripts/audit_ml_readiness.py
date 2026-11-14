"""Offline pilot audit. An installed connector does not imply available data."""
import importlib.util
import json
from pathlib import Path

from scripts.audit_ecocrop import inspect_row

ROOT = Path(__file__).resolve().parents[1]


def audit():
    pilot = json.loads((ROOT / "backend/app/data/agro_pilot.json").read_text(encoding="utf-8"))
    snapshot = json.loads((ROOT / "backend/app/data/ecocrop_species.json").read_text(encoding="utf-8"))
    species = {row["id"]: row for row in snapshot["species"]}
    crops = []
    for crop in pilot["crops"]:
        row = species[crop["ecocrop_id"]]
        if row["scientific_name"] != crop["scientific_name"]:
            raise ValueError("Pilot crop mapping requires review: " + crop["id"])
        crops.append({**crop, "quality_flags": inspect_row(row), "locally_validated": False})
    return {"pilot": pilot["id"], "crops": crops, "field_records_available": False,
            "chronos_package_installed": importlib.util.find_spec("chronos") is not None,
            "rain_history_cache_present": any((ROOT / "backend/data/chronos_power").glob("*.json")),
            "capabilities": pilot["capabilities"],
            "limitations": ["An installed package does not prove model weights or NASA data are available.",
                            "No quality flags does not imply local crop suitability."]}


if __name__ == "__main__":
    print(json.dumps(audit(), ensure_ascii=False, indent=2))
