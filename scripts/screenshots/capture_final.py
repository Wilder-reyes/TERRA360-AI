# AI-assisted: written with Claude Code (Anthropic) and reviewed by the CHAKRA X team.
"""Capture the 8 PPT screenshots (English, 16:9) of the CHAKRA demo.

Usage (from repo root, after `pip install playwright` in any venv):
    python scripts/screenshots/capture_final.py https://biotex-eta.vercel.app ../capturas/final light
Arguments: base URL, output folder, theme (light|dark). Uses installed Microsoft Edge
(channel="msedge"); change CHANNEL to None to use Playwright's own Chromium.

Demo input (farmer-declared, used for every shot): Barranca example barranca-1,
Yellow maize sown February 2026 in the only zone. Do not invent other inputs.
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

BASE, OUT, THEME = sys.argv[1].rstrip("/"), pathlib.Path(sys.argv[2]), (sys.argv[3] if len(sys.argv) > 3 else "light")
CHANNEL = "msedge"
OUT.mkdir(parents=True, exist_ok=True)
URL = f"{BASE}/?lang=en&theme={THEME}"


def to_plan(pg, shots=None):
    shots = shots or {}
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_timeout(1500)
    if "landing" in shots:
        pg.screenshot(path=str(OUT / shots["landing"]))
    pg.get_by_role("button", name="Explore the Barranca example").click(); pg.wait_for_timeout(1500)
    if "map" in shots:
        pg.get_by_role("button", name="Barranca vegetation").click(); pg.wait_for_timeout(3000)
        pg.locator("#chakra-field").scroll_into_view_if_needed(); pg.wait_for_timeout(500)
        pg.screenshot(path=str(OUT / shots["map"]))
    pg.get_by_role("button", name="Record crops by zone").click(); pg.wait_for_timeout(1500)
    pg.locator(".chakra-crop-card", has_text="Yellow maize").click()
    pg.locator(".chakra-crop-when select").select_option(label="February 2026")
    pg.get_by_role("button", name="Save this area crop").click(); pg.wait_for_timeout(500)
    if "crops" in shots:
        pg.locator(".chakra-crop-section").scroll_into_view_if_needed(); pg.screenshot(path=str(OUT / shots["crops"]))
    pg.get_by_role("button", name="Prepare my plan").click()
    pg.wait_for_selector(".chakra-strategy-card", timeout=240_000); pg.wait_for_timeout(1500)


with sync_playwright() as p:
    br = p.chromium.launch(channel=CHANNEL, headless=True) if CHANNEL else p.chromium.launch(headless=True)
    pg = br.new_context(viewport={"width": 1600, "height": 900}, locale="en-US").new_page()  # 16:9
    to_plan(pg, {"landing": "1-landing-map.png", "map": "2-map-field-satellite-legend.png", "crops": "3-crops-by-zone.png"})
    pg.evaluate("window.scrollTo(0,0)"); pg.wait_for_timeout(400)
    pg.screenshot(path=str(OUT / "4-zone-plan.png"))
    target = pg.locator(".chakra-maize-card") if pg.locator(".chakra-maize-card").count() else pg.locator(".chakra-strategy-compare")
    target.scroll_into_view_if_needed(); pg.evaluate("window.scrollBy(0,-120)"); pg.wait_for_timeout(400)
    pg.screenshot(path=str(OUT / "5-compare-3-strategies.png"))
    s1 = pg.locator(".chakra-strategy-card").nth(1)
    s1.get_by_role("tab", name="Risks").click(); pg.wait_for_timeout(300)
    s1.scroll_into_view_if_needed(); pg.evaluate("window.scrollBy(0,-120)"); pg.wait_for_timeout(300)
    pg.screenshot(path=str(OUT / "6-why-evidence-risks-S1-water.png"))
    pg.emulate_media(media="print")
    pg.pdf(path=str(OUT / "7-plan.pdf"), format="A4", print_background=True)
    pg.emulate_media(media="screen")
    m = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True,
                       has_touch=True, locale="en-US").new_page()
    to_plan(m)
    m.locator(".chakra-strategy-compare").scroll_into_view_if_needed(); m.wait_for_timeout(400)
    m.screenshot(path=str(OUT / "8-mobile-result.png"))
    br.close()
print("Screenshots in", OUT, "- convert 7-plan.pdf page 1 to PNG for the PPT (e.g. open it and export).")
