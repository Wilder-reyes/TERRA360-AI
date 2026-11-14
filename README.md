# BIOTEX · NSPACE BIOTEX — Field Shift crop-rotation decision support (repository: TERRA360-AI)

**App (Vercel):** https://terra360-ai-xi.vercel.app/\n**Alternative deployment:** https://terra360-ai.netlify.app/ (ES/EN selector in the header; `?lang=en` opens it in English)
**API:** https://terra360-api.onrender.com/api/health · Spanish README: [README.es.md](README.es.md)

BIOTEX helps family farmers in the irrigated coastal valleys of Lima, Peru (demo zones **Huaral** and **Barranca**) see how their crop rotation affects their **soil** and how exposed it is to **scarce dry-season irrigation water and heat**. It compares the farmer's current rotation with two alternatives:

1. **My field:** choose Huaral or Barranca, tap an example field, draw your own on the map or paste/upload a GeoJSON polygon.
2. **My current rotation:** a monthly NDVI series (2021–today) from **NASA HLS** shows when the field was cropped and when it was bare. The farmer **explicitly confirms** the crop in each detected season; candidates are never accepted automatically. Farmers can also enter their crop history manually if satellite data are missing. This is labelled as a *satellite-estimated history*.
3. **What matters to you:** water, soil, income crop and pests (0–2), plus the irrigation turn from May to November.
4. **Compare 3 rotations:** 24-month timelines for **S0 current**, **S1 "Water"** (less crop water when the river is low) and **S2 "Soil"** (soil always covered, legumes). Context bands show low-river months, the warmest months and reference water demand. Each strategy has a **"Why?"** card with five sections: why, evidence, benefits, gaps and risks. The comparison can be printed or saved as a PDF to take to a technician.

All indicators are **relative to the current rotation**. They are not yield, profit or irrigation prescriptions. The app **abstains** when data is missing: no farmer-confirmed or farmer-declared current rotation means no comparison; if only one or two alternatives are feasible, the app returns a partial result, never an unlabeled demo template. Months without a satellite image stay empty instead of being interpolated.

## v0.22 farmer workflow and scientific safeguards

- **Actual team/product names:** NSPACE BIOTEX / BIOTEX. The GitHub repository and existing infrastructure continue to use `TERRA360-AI` identifiers to avoid breaking deployed URLs.
- **Explicit confirmation:** a satellite-suggested crop is not automatically selected. The farmer must select a crop or say they do not remember.
- **Manual history:** an optional form allows entering up to 10 plantings (crop + sowing month) over the 24-month comparison window. This is labeled as farmer-declared rather than satellite-detected.
- **Demo provenance:** the sample maize rotation is labeled as fictitious, not a real farmer field. `current_source` reports `farmer_declared`, `satellite_confirmed` or `team_demo`.
- **Income crop:** the farmer can explicitly choose the crop supporting their income; the comparator keeps this crop when that priority is active. If none is selected, the most frequent crop in S0 is a declared fallback, not a hidden preference for maize.\n- **No synthetic results:** `use_team_templates_as_fallback` defaults to false. If the constrained optimizer cannot find S1 or S2, the UI reports a partial comparison rather than silently displaying a predefined plan.
- **GeoJSON limits:** malformed/non-finite coordinates return HTTP 422; manual GeoJSON follows the same parcel area limits as drawn fields.
- **NASA GPM IMERG basin climatology:** when `backend/app/data/imerg_basin_seed.json` is absent, the app displays an unavailable state rather than inventing precipitation. Basin precipitation is not river discharge or the farmer's irrigation entitlement.
- **Validation status:** documented methods and automated tests are not field validation. Crop water is a relative Kc × ET0 estimate, not measured irrigation needs or yield.

## BIOTEX v0.23 — mobile-first farmer journey

The public interface now follows plain-language screens that can be used on a phone:

1. **Mi chacra:** starts in **Barranca (Pativilca / Supe)**. Two precomputed demo fields are clearly labeled as examples. Farmers can search for a town via OpenStreetMap Nominatim (one explicit search per action), zoom into a satellite image, and draw their own field boundary. The search works beyond Barranca.
2. **Mis cultivos:** enter crops and sowing months manually; satellite image clues are optional and **never identify crops with certainty**. No GeoJSON, NDVI, or remote-sensing jargon is required.
3. **Mis prioridades:** choose water, soil or both, a crop to keep growing, and whether irrigation water is scarce. No four technical sliders.
4. **Mi plan:** the server compares existing and alternative rotations automatically and highlights an alternative **only when transparent relative estimates support it**. Trade-offs, risks, crop calendar and other options are clear. A source/uncertainty section remains expandable.

**Scope:** the Barranca demo is the main story. Locations elsewhere can be found and fields drawn, but crop rotation calculations are currently limited to the **coastal Lima** reference calendar. Expansion requires local crop calendars, soil measurements and agronomic validation. No fake satellite or farmer data are filled.

**Technical view:** `/?vista=comparador-tecnico` retains the previous S0/S1/S2 interface. The public UI never needs to show those labels.

**Printable report:** the browser's Print / Save PDF action creates a dedicated **A4 portrait** document with field context, crop calendar, result indicators, comparison tables, labelled bar charts, limitations and source methods. Print styling avoids clipped cards, horizontal overflow and tables split mid-row.

**Developer UX skill:** `.agents/skills/ui-ux-pro-max/` includes the official open-source UI UX Pro Max reference material for reuse in coding agents. It is not a ChatGPT plugin installation. The design follows WCAG-oriented contrast, labelled controls, minimum touch sizes, responsive layout and reduced-motion preferences.

## How it works

| Step | Method | Data |
|---|---|---|
| Field history | Monthly **maximum** of the per-scene polygon median NDVI. Clear pixels only, using the HLS `Fmask` (cloud, adjacent cloud, shadow, snow and water are rejected). Missing months stay `null`. | **NASA HLS v2.0** (`hls2-s30`, `hls2-l30`, 30 m) on Microsoft Planetary Computer. Fallback: ESA Sentinel-2 L2A with the SCL mask. |
| Season detection | Peaks with NDVI > 0.4, separated by a dip of at least 0.12. Each season is bounded by the 50 % amplitude rule. Bare soil is NDVI < 0.2. Thresholds are **declared heuristics** and are not calibrated locally. Long cloudy gaps are never merged. | — |
| Crop suggestion per season | Sowing month (about one month before green-up) plus cycle length, matched against the team catalogue. The farmer confirms or corrects it. | DRA Lima sowing calendar, FAO-56 cycle lengths |
| Water demand | Σ Kc(day) × ET0(month) over a 730-day cycle. FAO-56 single-Kc curve. ET0 from **FAO-56 Penman-Monteith** using NASA POWER monthly climatology (2001–2025). The share falling in low-river months (May–Nov) is highlighted. | **NASA POWER** (T2M_MAX, T2M_MIN, RH2M, WS2M, ALLSKY_SFC_SW_DWN), FAO-56 Tables 11–12 |
| Heat | A crop is flagged when most of its heat-sensitive window falls in the zone's three warmest POWER months (relative, no fixed threshold). | NASA POWER |
| Alternatives S1/S2 | Exact dynamic programming over months. Sowing is allowed only in DRA Lima sowing months, crop cycles come from the catalogue, no crop follows itself, the farmer's income crop is kept, and weights come from the farmer's priorities. S1 may not leave the field bare longer than today. Team sowing rules: in S1 yellow maize is sown only Nov–Feb (its thirstiest stage meets the high river), in S2 never May–Jul, and S0 is not restricted. If S1 does not lower May–Nov water versus today, its card says so instead of presenting it as an improvement. Perennial alfalfa is not proposed automatically. The team's S0/S1/S2 templates are **explicit demo/test cases only**. Real-field requests never silently fall back to them. | Team crop catalogue (13 crops) |

**Scale honesty.** The NASA POWER grid cell (~0.5°) assigned to Huando sits at about 2,100 m in the Andes and shows almost no seasonal temperature cycle. In that case the API moves to the neighbouring coastal cell (224 m in Huaral, 83 m in Barranca) and says so in the response and in the UI. Coarse products such as SMAP and GAEZ stay in the technical view only.

**Demo zones.** Both zones are statistical-sector centroids from the same official source, MIDAGRI's *Padrón Nacional de Sectores Estadísticos 2024*: HUANDO 15060105 (Huaral) and CHACARITA 15020105 (Barranca). They are not parcels. Example fields live in `frontend/src/exampleFields.json`. The current "technical test" fields were found automatically as ~2 ha blocks whose HLS NDVI alternates between green and bare, and they do not belong to an identified farmer. The team adds its hand-drawn fields there.

## Run locally (Windows PowerShell)

```powershell
# Backend (Python 3.12 recommended; 3.14 also passes the tests)
py -3.12 -m venv backend\.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload --reload-dir backend/app

# Frontend (second terminal)
cd frontend; npm.cmd ci; npm.cmd run dev      # http://localhost:5173/

# Tests
.\backend\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py"
cd frontend; npm.cmd run test; npm.cmd run build

# After adding or changing example fields: precompute their satellite history
.\backend\.venv\Scripts\python.exe scripts\precompute_rotation_history.py
```

Other views: `/?vista=clima` (previous farmer weather dashboard) and `/?vista=tecnica` (technical lab with SMAP, GAEZ, the FAO ECOCROP catalogue and more).

## API (rotation comparator)

| Endpoint | Purpose |
|---|---|
| `GET /api/rotation/zones` | Huaral and Barranca (MIDAGRI 2024 centroids, approximate upper-basin boxes) |
| `GET /api/rotation/crops` | Team crop catalogue (13 crops) and coastal seasons |
| `GET /api/rotation/climate?zone=huaral` | Monthly ET0, Tmax, solar radiation and warmest months from NASA POWER |
| `POST /api/rotation/history` `{polygon, start_year}` | Monthly NDVI series and detected seasons. Returns `202 {"status":"processing"}` while a new field is computed; repeat the same POST. |
| `POST /api/rotation/compare` | `{zone, current:[{crop_id,start_index}], priorities:{water,soil,income,pests}, water_turn, history, current_source, income_crop_id, use_team_templates_as_fallback:false}` → real-field S0/S1/S2 (possibly partial), benefits, risks and uncertainties ES/EN |
| `GET /api/rotation/upper-basin-rain?zone=huaral` | "Water to come": GPM IMERG monthly rain over the upper basin (climatology and recent seasons, % of normal). Precomputed with an Earthdata token; abstains if not available. |
| `GET /api/rotation/templates` | Team S0/S1/S2 test rotations (`start_index` 0 = August of year 1) |

## Data used

- **NASA HLS v2.0** (Harmonized Landsat Sentinel-2), via Microsoft Planetary Computer: field NDVI history.
- **NASA POWER** (Agroclimatology, climatology 2001–2025): ET0 and heat.
- **ESA Copernicus Sentinel-2 L2A** (via Planetary Computer): fallback NDVI and existing parcel NDVI tools.
- **NASA GPM IMERG** Final Run monthly (GPM_3IMERGM v07): rain in the upper Chancay-Huaral and Pativilca basins, shown as "water to come" context.
- **NASA GIBS** (IMERG, MODIS NDVI) map layers, plus NASA GPM IMERG, SMAP and SRTM in the technical view.
- **FAO Irrigation & Drainage Paper 56:** crop coefficients (Kc) and stage lengths.
- **MIDAGRI / DRA Lima:** *Evaluación mensual de la dinámica agropecuaria*, Oct 2025 (sowing calendar, 2024–2025 season). *Padrón Nacional de Sectores Estadísticos 2024* (zones).
- FAO ECOCROP via CGIAR (technical view), INEI ENA 2024 (context).

## AI assistance

The challenge rules allow AI to speed up work, and we declare where it was used. The team chose the problem focus, target farmers, demo zones and solution direction. AI assistants (Claude) were used to research official statistics, draft the analysis documents, and write and test the code; the team reviewed all of it. In the code, **Claude Code (Anthropic)** helped write and test the rotation comparator. Every AI-assisted file starts with the header comment `AI-assisted: written with Claude Code (Anthropic) and reviewed by the TERRA360 team.`:

- `backend/app/services/hls_history.py`: HLS monthly NDVI history and season detection
- `backend/app/services/power_climatology.py`: NASA POWER climatology and FAO-56 ET0
- `backend/app/services/rotation_engine.py`: S0/S1/S2 engine, constrained search and 5-section explanations
- `backend/app/services/rotation_zones.py`, `backend/app/api/rotation_routes.py`
- `frontend/src/RotationApp.tsx`, `frontend/src/rotation.css`, `frontend/src/rotationZones.ts`
- `backend/app/services/imerg_basin.py`, `scripts/precompute_imerg_basins.py`: GPM IMERG upper-basin rain ("water to come")
- `scripts/precompute_rotation_history.py`, `tests/test_rotation.py`

Data files: `backend/app/data/rotation_crops.json` is the team's catalogue, copied unchanged. `backend/app/data/history_seed/*.json` are satellite histories computed by the code above. The technical-test field polygons were found by an AI-assisted script, as described above. Modules from earlier versions (v0.1–v0.19) keep their own history in git; the team will state any AI use in them.

## Limits

These are relative comparisons for discussion with a technician from the Agrarian Agency or the Water Users' Board, not instructions. The app does not know the farmer's soil test, real irrigation turn, variety or future prices. The DRA Lima calendar covers the whole department, including highland provinces. Kc values and stage lengths are generic FAO-56 values. Some catalogue entries are marked as *proxy* or *to verify* and are shown in the app as approximate data.
