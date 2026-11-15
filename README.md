# chakra — crop rotation decisions with NASA data

**CHAKRA** by team **CHAKRA X** · NASA Space Apps Challenge 2026 · [Field Shift: Adapting Farms with NASA Data](https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/)

**Demo:** https://biotex-eta.vercel.app/?lang=en (the domain still says *biotex*; the product is CHAKRA) · **API:** https://terra360-api.onrender.com/api/health · Spanish: [README.es.md](README.es.md)

## The problem

Family farmers in Peru's irrigated coastal valleys decide every season what to plant without seeing how their rotation affects their soil, or how exposed it is to scarce dry-season irrigation water and heat. On the desert coast, irrigation water comes from Andean rivers that carry most of their flow in 3–4 months (Dec–Apr); from May to November the river is low. Only 3.1% of producers received technical assistance in 2024 (INEI, ENA 2024).

CHAKRA lets a farmer outline a field, record what was planted in each zone, and compare **at least three rotation strategies, including the current one**, with **why, evidence, benefits, gaps and risks** for each. Public pilot: **Barranca** (Pativilca / Supe valleys, Lima).

## Use the demo in 3 steps

1. **Outline** — open the map and tap *Explore the Barranca example* (study field `barranca-1`, ~2.25 ha), or draw/import (GeoJSON) any field.
2. **Crops and zones** — draw zones if needed, pick each zone's crop with the cards and its sowing month. Crops are **declared by the farmer**, never inferred from imagery.
3. **My plan** — a zone-by-zone plan (next crop to consider, reference sowing date, preparation steps) and the **comparison of 3 strategies**: S0 current rotation, S1 *Water* (less crop water when the river is low) and S2 *Soil* (covered soil and legumes), each with Why / Evidence / Benefits / Gaps / Risks. *Print map and PDF plan* produces an A4 PDF with the zone sketch, areas and the 3-strategy table.

Data are saved on the device (key `biotex-farm-v1`); reload and restore to continue. Fields outside Barranca can be outlined and planned, but the result states that it is **guidance from general rules, not a locally validated recommendation**.

## NASA data and their scale

| Data | Scale | What CHAKRA uses it for | Type |
|---|---|---|---|
| **NASA HLS v2.0** (Harmonized Landsat Sentinel-2), via Microsoft Planetary Computer | 30 m | Monthly vegetation (NDVI) history of the field, 2021–2026; cloud-masked with Fmask; months without a clear image are left empty | observed |
| **NASA POWER** climatology 2001–2025 | ~0.5° grid | Reference evapotranspiration (FAO-56 Penman-Monteith) and Tmax; crop water = Kc × ET0. If the field's cell lies in the Andes, the neighbouring coastal cell is used and the app says so | calculated |
| **NASA GPM IMERG** Final Run monthly | 0.1° | Rain over the approximate upper basin (Pativilca / Chancay-Huaral), 2015–2025, where irrigation water comes from | observed (context) |
| NASA SMAP, SRTM, GIBS layers | 9 km and coarser | Regional map context only; SMAP pixels are larger than the valley | context |
| FAO-56, DRA Lima / MIDAGRI 2024–25 | — | Crop coefficients and stage lengths; Lima sowing calendar | agronomic rules |

**Model:** a small reproducible seasonal model — logistic regression on **44 NASA HLS monthly observations of one study field** (barranca-1) predicting a low-vegetation proxy. Chronological holdout of 11 months: Brier 0.234 vs 0.480 for a no-learning baseline. It is a **proof of concept**: it only applies to that exact polygon and does not identify crops, yields or soil health. Details: [docs/CHAKRA_NASA.md](docs/CHAKRA_NASA.md).

Every result distinguishes what is **observed** (satellite), **declared** (farmer), **calculated** (FAO-56/POWER), an **agronomic rule** or a **model inference**.

## Run and reproduce

```bash
# Backend (Python 3.12)
python -m venv backend/.venv && backend/.venv/bin/python -m pip install -r backend/requirements.txt
PYTHONPATH=backend python -m uvicorn app.main:app --app-dir backend --port 8000
PYTHONPATH=backend python -m unittest discover -s tests -p "test_*.py"
python scripts/reproduce_field_shift_ai.py --check      # re-trains the HLS model and checks the frozen metrics

# Frontend (Node 22+)
cd frontend && npm ci && npm run test && npm run build
VITE_API_URL=http://localhost:8000 npm run dev           # http://localhost:5173/?lang=en
npx playwright install chromium && npm run test:e2e
```

Reproducible data products: `scripts/precompute_rotation_history.py` (HLS histories), `scripts/precompute_imerg_basins.py` (IMERG; needs a NASA Earthdata token in a git-ignored `backend/.env`), `scripts/precompute_barranca_example.py` (cold-start example). Deployment: Vercel serves the static frontend and rewrites `/api/*` to the FastAPI service on Render; both deploy automatically from `main`.

## Limits

- Results are **relative comparisons** to discuss with a technician from the Agrarian Agency or the Water Users' Board — not yield, profit, irrigation-saving or soil-fertility predictions. No field validation with farmers has been done yet.
- NDVI shows vegetation, not which crop or whether it is healthy: greener = more vegetation observed, not necessarily a healthier crop.
- NASA POWER is a regional grid estimate, not a station on the field. IMERG covers an approximate rectangle, not an official ANA watershed, and may underestimate Andean rain.
- The Lima sowing calendar covers the whole department; Kc values are generic FAO-56; some catalogue entries are marked approximate.
- The free Render API may need ~30 s to wake up; the Barranca example falls back to a labelled precomputed result.

## AI assistance

The team chose the problem focus, target farmers, demo zone and solution direction. AI assistants (Claude by Anthropic, and OpenAI Codex) were used to research official statistics, draft analysis documents and documentation, and write and test code; the team reviewed all of it. Files written with Claude Code carry the header comment `AI-assisted: written with Claude Code (Anthropic) and reviewed by the … team.` No AI-generated data is presented as an observation: the HLS model is trained only on real NASA HLS observations stored in this repository.

## Next steps

Validation with Barranca's irrigation users' board and INIA, soil tests and real farmer-declared rotations; ANA river flows for the low-river months. Andean valleys (Mantaro), exploratory.

## License

[MIT](LICENSE) © 2026 CHAKRA X team. Third-party data (NASA, ESA, MIDAGRI, FAO) keep their own terms.
