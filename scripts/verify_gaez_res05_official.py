#!/usr/bin/env python3
"""Verify one FAO GAEZ v5 RES05-SIX object against FAO's official RES05 inventory.

No raster is downloaded, staged or used for agronomic decisions here.
A successful catalog match + public HEAD does NOT verify raster science,
licensing, scaling, no-data or cell measurements.
"""
from __future__ import annotations

import argparse
from io import BytesIO
import json
import re
import sys
from urllib.parse import quote

import pandas as pd
import requests

FAO_README = (
    "https://data.apps.fao.org/catalog/dataset/"
    "514c92d5-9e01-4c70-814a-80ea1ca9fe6a/resource/"
    "768b08ad-be9c-427a-84be-3a3d6dd7835a/download/_readme_res05.xlsx"
)
FAO_BASE_URL = (
    "https://storage.googleapis.com/fao-gismgr-gaez-v5-data/"
    "DATA/GAEZ-V5/MAPSET"
)
COLUMNS = (
    "MAPSET_CODE", "PERIOD", "CLIMATE_DATA_SOURCE", "SSP",
    "CROP", "INPUT", "FILE_NAME",
)
SELECTION = {
    "MAPSET_CODE": "RES05-SIX",
    "PERIOD": "HP0120",
    "CLIMATE_DATA_SOURCE": "AGERA5",
    "SSP": "HIST",
    "CROP": "CSV",
    "INPUT": "LRLM",
}
MAX_README_BYTES = 24 * 1024 * 1024
EXPECTED_SUFFIX = ".tif"
EXACT_PATTERN = re.compile(
    r"GAEZ-V5\.RES05-SIX\.HP0120\.AGERA5\.HIST\.CSV\.LRLM\.tif",
    flags=re.ASCII,
)


class VerificationError(RuntimeError):
    pass


def read_catalog(workbook: bytes) -> pd.DataFrame:
    """Parse LIST_FILES even if FAO shifts the header below row 1."""
    if not workbook or len(workbook) > MAX_README_BYTES:
        raise VerificationError("FAO RES05 catalog is empty or exceeds 24 MiB")
    try:
        raw = pd.read_excel(BytesIO(workbook), sheet_name="LIST_FILES",
                            engine="openpyxl", dtype=str, header=None)
    except (ValueError, KeyError) as exc:
        raise VerificationError("The official FAO LIST_FILES sheet is unavailable") from exc
    header = None
    for idx in range(min(40, len(raw))):
        candidate = [str(value).strip().upper().replace(" ", "_")
                     for value in raw.iloc[idx].tolist()]
        if sum(name in candidate for name in COLUMNS) >= 6:
            header = idx
            break
    if header is None:
        raise VerificationError("Official FAO inventory lacks its required headers")
    names = [str(value).strip().upper().replace(" ", "_")
             for value in raw.iloc[header].tolist()]
    if any(names.count(name) > 1 for name in COLUMNS):
        raise VerificationError("Official FAO inventory has duplicate scientific columns")
    data = raw.iloc[header + 1:].copy()
    data.columns = names
    if any(name not in data.columns for name in COLUMNS):
        raise VerificationError("Official FAO inventory columns are incomplete")
    return data[list(COLUMNS)].dropna(subset=["FILE_NAME"])


def select_one(catalog: pd.DataFrame) -> dict:
    """Reject 0 or >1 matching records, malformed names or path traversal."""
    table = catalog.copy()
    for name, value in SELECTION.items():
        table = table[table[name].astype(str).str.strip().str.upper() == value]
    if len(table) != 1:
        raise VerificationError(
            "FAO catalog has " + str(len(table)) + " exact matches; expected one"
        )
    name = str(table.iloc[0]["FILE_NAME"]).strip()
    if not name.lower().endswith(EXPECTED_SUFFIX):
        name += EXPECTED_SUFFIX
    if not EXACT_PATTERN.fullmatch(name):
        raise VerificationError("FAO catalog filename does not match selected scientific dimensions")
    return {
        "catalog_match_verified": True,
        "selection": dict(SELECTION),
        "file_name": name,
        "url": FAO_BASE_URL + "/" + quote(SELECTION["MAPSET_CODE"], safe="") +
               "/" + quote(name, safe=""),
    }


def download_inventory(session: requests.Session | None = None) -> bytes:
    own = session is None
    client = session or requests.Session()
    try:
        with client.get(FAO_README, timeout=(8, 35), stream=True,
                        allow_redirects=True) as response:
            response.raise_for_status()
            chunks, size = [], 0
            for block in response.iter_content(256 * 1024):
                if not block:
                    continue
                size += len(block)
                if size > MAX_README_BYTES:
                    raise VerificationError("FAO metadata workbook exceeds 24 MiB")
                chunks.append(block)
            return b"".join(chunks)
    except requests.RequestException as exc:
        raise VerificationError("Official FAO README download unavailable") from exc
    finally:
        if own:
            client.close()


def check_official_object(record: dict, session: requests.Session | None = None) -> dict:
    """Bounded HEAD only, no data download and no assumptions from 403/404."""
    own = session is None
    client = session or requests.Session()
    try:
        response = client.head(record["url"], timeout=(8, 18),
                               allow_redirects=False)
        status = response.status_code
        size = response.headers.get("Content-Length")
        result = {
            **record,
            "http_status": status,
            "public_object_verified": status == 200 and size is not None and size.isdecimal() and int(size) > 0,
            "content_length_bytes": int(size) if size and size.isdecimal() else None,
            "etag": response.headers.get("ETag"),
            "gcs_generation": response.headers.get("x-goog-generation"),
            "exact_asset_license_verified": False,
            "raster_geospatial_metadata_verified": False,
            "raster_sha256_verified": False,
            "suitability_index": None,
            "used_in_crop_decision": False,
        }
        return result
    except requests.RequestException as exc:
        raise VerificationError("FAO GCS object metadata could not be checked") from exc
    finally:
        if own:
            client.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--strict", action="store_true",
                        help="Nonzero exit if FAO catalog/object cannot be verified")
    args = parser.parse_args()
    try:
        record = select_one(read_catalog(download_inventory()))
        report = check_official_object(record)
        state = "FAO_OBJECT_HEAD_VERIFIED" if report["public_object_verified"] else "FAO_OBJECT_NOT_VERIFIED"
        print(state)
        print(json.dumps(report, indent=2, sort_keys=True, ensure_ascii=False))
        if args.strict and not report["public_object_verified"]:
            return 2
    except (VerificationError, ValueError) as exc:
        print("FAO_OFFICIAL_PROBE_UNAVAILABLE:", str(exc), file=sys.stderr)
        if args.strict:
            return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
