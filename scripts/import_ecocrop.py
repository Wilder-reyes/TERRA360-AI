#!/usr/bin/env python3
"""Reproducible FAO ECOCROP snapshot importer.

Source: OpenCLIM/ecocrop commit ea43ecd418fd1a1ea08d32c7dce64b7fae02dec4
via CGIAR Climate Action Data Hub (CC BY 4.0), original FAO EcoCrop estimates.
The exact Git blob SHA is pinned; fail closed if upstream bytes differ.

The generated data are *botanical discovery/reference only*, not proof that a
species is appropriate at any coordinates. Never label thresholds as local tests.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import urllib.request
from pathlib import Path

SOURCE_COMMIT = "ea43ecd418fd1a1ea08d32c7dce64b7fae02dec4"
SOURCE_URL = f"https://raw.githubusercontent.com/OpenCLIM/ecocrop/{SOURCE_COMMIT}/EcoCrop_DB.csv"
SOURCE_GIT_BLOB_SHA1 = "849cc89873ef766690b12ac8251db4639c642084"
DEST = Path(__file__).resolve().parents[1] / "backend" / "app" / "data" / "ecocrop_species.json"
EXPECTED_RECORDS = 2568

NUMBER_FIELDS = (
    "tmin", "tmax", "topmn", "topmx", "rmin", "rmax", "ropmn", "ropmx",
    "gmin", "gmax", "phmin", "phmax", "phopmn", "phopmx", "altmx", "latmn", "latmx",
)


def clean_number(v: str | None) -> int | float | None:
    if v is None or v.strip().upper() in {"", "NA", "N/A", "NULL"}:
        return None
    try:
        n = float(v)
        if not (-1_000_000 < n < 1_000_000):
            return None
        return int(n) if n.is_integer() else n
    except ValueError:
        return None


def parse_csv(source: bytes) -> list[dict]:
    txt = source.decode("cp1252").lstrip("\\ufeff")
    reader = csv.DictReader(io.StringIO(txt, newline=""))
    fields = set(reader.fieldnames or ())
    lower = {str(f).strip().lower(): f for f in fields}
    required = {"ecoportcode", "scientificname", "famname", "comname"}
    if not required <= lower.keys():
        raise ValueError(f"Unexpected ECOCROP header; expected {required}; got {sorted(lower)[:15]}")
    data = []
    seen: set[str] = set()
    for line in reader:
        row = {str(k).strip().lower(): str(v or "").strip() for k, v in line.items() if k}
        code = row.get("ecoportcode", "")
        name = row.get("scientificname", "")
        if not code.isdecimal() or not name:
            raise ValueError("Malformed EcoPort code or missing scientific name")
        if code in seen:
            raise ValueError("Repeated ECOCROP primary key")
        seen.add(code)
        common = [n.strip() for n in row.get("comname", "").split(",") if n.strip() and n.strip().upper() != "NA"]
        family_path = row.get("famname", "")
        family = family_path.split(":")[-1].strip() if family_path else ""
        ecology = {key: clean_number(row.get(key)) for key in NUMBER_FIELDS}
        data.append({
            "id": f"ecocrop_{code}",
            "ecoportcode": int(code),
            "name": common[0] if common else name,
            "scientific_name": name,
            "family": family or "Familia no indicada",
            "common_names": common[:20],
            "category": row.get("cat") or "Cultivo exploratorio",
            "ecology": ecology,
            "evidence_level": "ecocrop_expert_estimates_not_locally_validated",
        })
    if len(data) != EXPECTED_RECORDS:
        raise ValueError(f"Expected {EXPECTED_RECORDS} species; got {len(data)}")
    return sorted(data, key=lambda x: x["ecoportcode"])


def build_snapshot(source: bytes) -> dict:
    blob = b"blob " + str(len(source)).encode("ascii") + b"\0" + source
    digest = hashlib.sha1(blob).hexdigest()
    if digest != SOURCE_GIT_BLOB_SHA1:
        raise ValueError(f"Source blob hash mismatch: {digest}")
    return {
        "source": "FAO EcoCrop via OpenCLIM CSV snapshot and CGIAR Climate Action Data Hub",
        "source_url": SOURCE_URL,
        "catalog_url": "https://cgiar-climate-data-hub.github.io/catalog/ecocrop/",
        "license": "CC-BY-4.0 (CGIAR Data Hub; confirm original dataset citation)",
        "source_commit": SOURCE_COMMIT,
        "git_blob_sha1": digest,
        "sha256": hashlib.sha256(source).hexdigest(),
        "locally_validated": False,
        "environmental_ranges_are_expert_estimates": True,
        "species": parse_csv(source),
    }


def main():
    req = urllib.request.Request(SOURCE_URL, headers={
        "User-Agent": "TERRA360-AI-ECOCROP-reproducible-import/1.0",
        "Accept": "text/csv, */*"
    })
    with urllib.request.urlopen(req, timeout=30) as response:
        raw = response.read(3_000_000)
    if len(raw) > 2_500_000:
        raise ValueError("Dataset exceeds expected size")
    snapshot = build_snapshot(raw)
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Imported {len(snapshot['species'])} ECOCROP species; source SHA256={snapshot['sha256']}; file_bytes={DEST.stat().st_size}")


if __name__ == "__main__":
    main()
