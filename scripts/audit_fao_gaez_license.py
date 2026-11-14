#!/usr/bin/env python3
"""Check FAO CKAN dataset-level license and resource link for RES05 inventory.

No license is inferred from FAO's unrelated GAEZ Master Config dataset.
No automatic redistributing or enabling of the GeoTIFF follows this check.
"""
from __future__ import annotations
import json
from pathlib import Path
import sys

import requests

FAO_API = "https://data.apps.fao.org/catalog/api/3/action/package_show"
FAO_PACKAGE_ID = "514c92d5-9e01-4c70-814a-80ea1ca9fe6a"
FAO_README_RESOURCE_ID = "768b08ad-be9c-427a-84be-3a3d6dd7835a"


class LicenseAuditError(RuntimeError):
    pass


def audit_payload(payload: dict) -> dict:
    result = payload.get("result")
    if not payload.get("success") or not isinstance(result, dict):
        raise LicenseAuditError("FAO CKAN dataset response is not confirmed")
    if result.get("id") != FAO_PACKAGE_ID:
        raise LicenseAuditError("FAO CKAN returned a different dataset")
    resources = result.get("resources")
    if not isinstance(resources,list):
        raise LicenseAuditError("FAO CKAN resource listing is missing")
    resource = next((r for r in resources if isinstance(r,dict) and
                     r.get("id") == FAO_README_RESOURCE_ID), None)
    if not resource:
        raise LicenseAuditError("FAO RES05 README is not linked to selected dataset")
    title = result.get("license_title")
    url = result.get("license_url")
    if not isinstance(title,str) or not title.strip():
        raise LicenseAuditError("FAO dataset does not publish a license")
    return {
        "verified_fao_package_id": FAO_PACKAGE_ID,
        "verified_fao_res05_resource_id": FAO_README_RESOURCE_ID,
        "dataset_title":str(result.get("title",""))[:160],
        "dataset_license_title":title,
        "dataset_license_url":url if isinstance(url,str) else None,
        "res05_readme_url":str(resource.get("url",""))[:350],
        "exact_tiff_asset_license_independently_confirmed":False,
        "raster_suitability_published":False,
        "note":"The verified CKAN dataset license is distinct from validating all legal terms of a particular GCS object.",
    }


def audit_ckan() -> dict:
    try:
        response = requests.get(FAO_API, params={"id":FAO_PACKAGE_ID},
                                timeout=(7,18),allow_redirects=False)
        response.raise_for_status()
        if len(response.content)>2*1024*1024:
            raise LicenseAuditError("FAO CKAN response exceeds size cap")
        return audit_payload(response.json())
    except (requests.RequestException,ValueError) as exc:
        raise LicenseAuditError("FAO official dataset-level license unavailable") from exc


def main() -> int:
    try:
        report=audit_ckan()
    except LicenseAuditError as exc:
        print("FAO_LICENSE_AUDIT_UNAVAILABLE:",str(exc),file=sys.stderr)
        return 2
    print("FAO_DATASET_LICENSE_AUDITED_NO_TIFF_REUSE_AUTHORIZED")
    print(json.dumps(report,indent=2,sort_keys=True,ensure_ascii=False))
    Path("fao-res05-dataset-license.json").write_text(
        json.dumps(report,indent=2,sort_keys=True,ensure_ascii=False)+"\n",
        encoding="utf-8",
    )
    return 0


if __name__=="__main__":
    raise SystemExit(main())
