#!/usr/bin/env python3
"""Check real NASA GIBS WMS layer availability, not tile correctness.

Source official public WMS GetCapabilities and NASA layer-metadata JSON.
Failures indicate unverified external availability; they do not make field
suitability measurements or NASA raster extraction possible.
"""
import json
import urllib.request
import xml.etree.ElementTree as ET

WMS="https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.1.1"
LAYERS={
 "IMERG_Precipitation_Rate":"precipitation rate",
 "SMAP_L4_Analyzed_Surface_Soil_Moisture":"surface soil moisture",
 "MODIS_Terra_NDVI_8Day":"normalized difference vegetation",
 "SRTM_Color_Index":"elevation",
}

def download(url):
    req=urllib.request.Request(url,headers={"User-Agent":"TERRA360-GIBS-science-verification/0.10","Accept":"application/xml,application/json,*/*"})
    with urllib.request.urlopen(req,timeout=35) as response:
        if response.status!=200:
            raise RuntimeError("NASA request not successful")
        raw=response.read(18_000_000)
        if len(raw)>17_000_000:
            raise RuntimeError("Unexpected oversized NASA capabilities")
        return raw

def check():
    xml=ET.fromstring(download(WMS))
    ids={el.text for el in xml.iter() if el.tag.split('}')[-1]=="Name" and el.text}
    for name,subject in LAYERS.items():
        meta=json.loads(download(f"https://gibs.earthdata.nasa.gov/layer-metadata/v1.0/{name}.json"))
        if name not in ids:
            raise AssertionError(f"NASA WMS EPSG:3857 missing expected layer: {name}")
        if not meta.get("measurement"):
            raise AssertionError(f"NASA metadata missing science measurement for {name}")
        print(f"PASS {name}: {meta['title']} ({subject})")
    print("All four NASA map layer IDs are present in official WMS/metadata; visual tile dates still require checks.")

if __name__=="__main__":
    check()
