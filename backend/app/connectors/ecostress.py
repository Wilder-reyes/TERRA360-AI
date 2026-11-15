"""Bounded NASA CMR metadata acquisition; no derived science or decisions."""
import httpx

async def fetch_granules(latitude:float,longitude:float)->dict:
    bbox=f"{longitude-.01:.5f},{latitude-.01:.5f},{longitude+.01:.5f},{latitude+.01:.5f}"
    params={"short_name":"ECO_L2T_LSTE","version":"003",
        "bounding_box":bbox,
        "temporal":"2025-01-01T00:00:00Z,2026-11-14T23:59:59Z",
        "sort_key[]":"-start_date","page_size":8}
    async with httpx.AsyncClient(timeout=17,follow_redirects=False) as client:
        r=await client.get("https://cmr.earthdata.nasa.gov/search/granules.json",
                       params=params,headers={"Accept":"application/json","User-Agent":"BIOTEX-Research-Pilot/0.28"})
        r.raise_for_status()
        return r.json()
