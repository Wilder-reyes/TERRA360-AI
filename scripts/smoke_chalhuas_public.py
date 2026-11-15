#!/usr/bin/env python3
"""BIOTEX public Vercel ↔ Render deployment smoke test (lightweight and read-only science).

No imagery downloads or agronomic recommendations. Confirms production *contracts*
are public and the Chalhuas extension is deployed in the same frontend/backend pair.
"""
from __future__ import annotations
import json
import os
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

VERCEL=os.getenv("BIOTEX_PUBLIC_URL","https://terra360-ai-eta.vercel.app").rstrip("/")
RENDER=os.getenv("BIOTEX_RENDER_URL","https://terra360-api.onrender.com").rstrip("/")
MAX_TRIES=6

def fetch(host,route,body=None,tries=MAX_TRIES):
    url=host+route
    payload=json.dumps(body).encode() if body is not None else None
    headers={"Accept":"application/json, text/html","User-Agent":"BIOTEX-public-contract/0.28"}
    if payload is not None:headers["Content-Type"]="application/json"
    for index in range(tries):
        try:
            request=Request(url,data=payload,headers=headers,method="POST" if payload is not None else "GET")
            with urlopen(request,timeout=28) as response:
                return response.status,response.headers.get("content-type",""),response.read(2_000_000)
        except HTTPError as exc:
            if exc.code not in (404,429,502,503,504):
                raise RuntimeError(f"{route}: HTTP {exc.code} at {host}") from exc
            error=f"HTTP {exc.code}"
        except (URLError,TimeoutError,OSError) as exc:
            error=f"{type(exc).__name__}: {str(exc)[:140]}"
        if index<tries-1:
            print(f"Waiting for published services: {route} ({error}); attempt {index+1}/{tries}",flush=True)
            time.sleep(12)
    raise RuntimeError(f"Could not verify public route {host}{route}; last error {error}")

def j(host,route,body=None,tries=MAX_TRIES):
    code,ctype,data=fetch(host,route,body,tries)
    assert code==200 and "json" in ctype.lower(),(host,route,code,ctype)
    value=json.loads(data)
    assert isinstance(value,dict),route
    return value

def test():
    print("1/7 Vercel SPA",flush=True)
    code,ctype,html=fetch(VERCEL,"/?pilot=chalhuas",tries=3)
    assert code==200 and "html" in ctype.lower() and b'<div id="root"' in html
    release=j(VERCEL,"/release.json",tries=3)
    assert release["release"]=="v0.26-hls-trained-ai-barranca",release.get("release")
    assert any(p.get("id")=="chalhuas" and p.get("status")=="exploratory_no_local_ai_model"
               for p in release.get("experimental_pilots",[]))
    assert release["primary_url"].rstrip("/")==VERCEL
    print("PASS: Vercel React SPA, Barranca baseline preserved, Chalhuas experimental",flush=True)

    print("2/7 Render API",flush=True)
    health=j(RENDER,"/api/health")
    assert health.get("status")=="ok"
    print("PASS: Render backend",flush=True)

    print("3/7 Scientific layer contracts",flush=True)
    sources=j(RENDER,"/api/andes/sources")
    assert sources["place"]["parcel_boundary_known"] is False
    assert sources["scientific_ai"]["status"]=="not_trained_for_chalhuas"
    layers={layer["id"]:layer for layer in sources["layers"]}
    for name in ("vegetation","rain","srtm","era5_land","ecostress","gldas"):
        assert name in layers,name
    assert layers["ecostress"]["status"]=="needs_quality_controlled_scene"
    print("PASS: layer provenance and no invented local AI",flush=True)

    print("4/7 Local crop catalogue",flush=True)
    crops=j(RENDER,"/api/andes/catalog")
    assert crops["zone"]=="chalhuas"
    listing={crop["id"]:crop for crop in crops["crops"]}
    for crop in ("papa","arveja","haba","quinua","cebada","avena"):
        assert crop in listing,crop
    assert all(item["sowing_calendar_verified"] is False for item in listing.values())
    print("PASS: six crop entries, missing local calendars marked",flush=True)

    print("5/7 Rotation comparison",flush=True)
    body={"rotation":["papa","arveja","papa","arveja"],"priority":"both",
          "start_year":2027,"history_source":"example"}
    comparison=j(RENDER,"/api/andes/compare",body)
    assert comparison["status"]=="illustrative_comparison"
    assert comparison["automatic_recommendation"] is None
    assert comparison["start_year"]==2027 and comparison["end_year"]==2030
    assert len(comparison["strategies"])==3
    print("PASS: comparison remains non-prescriptive",flush=True)

    print("6/7 Vercel-only API rewrite",flush=True)
    proxy=j(VERCEL,"/api/andes/sources",tries=4)
    assert proxy["scientific_ai"]["status"]=="not_trained_for_chalhuas"
    assert proxy["place"]["name"]==sources["place"]["name"]
    print("PASS: Vercel to Render rewrite",flush=True)

    print("7/7 Optional layers contract (no expensive provider calls)",flush=True)
    spec=j(RENDER,"/openapi.json")
    routes=spec.get("paths",{})
    for endpoint in ("/api/andes/era5-land","/api/andes/ecostress-scenes",
                     "/api/andes/validate-subplots","/api/rotation/history"):
        assert endpoint in routes,endpoint
    print("PASS: publication contract complete; actual scenes and field validation separate",flush=True)

if __name__=="__main__":
    test()
