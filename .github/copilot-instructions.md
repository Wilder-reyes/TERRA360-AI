# GitHub Copilot instructions — TERRA360 AI

## Product goals
- Build for **NASA Space Apps Challenge 2026 — Field Shift**: an understandable crop rotation decision-support tool, not a generic Earth-observation dashboard.
- Three steps ONLY in normal user experience: **Mi terreno → Mis cultivos → Mi decisión**.
- No default coordinates, no Calca label assigned to an arbitrary user, no automatic API requests before the user selects their location.
- Languages: Spanish and English. Quechua is preparation only until a validated translation exists; when displayed, call it “Quechua”, code `qu`.
- Farmer-friendly words, minimal forms, accessible mobile UI. Advanced scientific provenance behind expandable panels.

## Science and safety
- NEVER invent production gains, crop yield, fertilizer savings, water savings, soil test measurements, weather forecasts or confidence scores.
- Keep satellite observations distinct from field measurements. NASA POWER, GPM, ESA Sentinel-2 via Microsoft Planetary Computer and models each have different spatial/temporal resolution.
- Planetary Computer scene search returns **catalog metadata only**; it is NOT NDVI, crop vigor, or a basis for ARIE recommendations.
- S0 = **farmer-reported** actual rotation (never invent it); S1 = traceable diversity/structural candidate; S2 = water-constrained exploration (do not claim lower consumption without real evidence).
- Unknown ≠ pass. Abstain if there is not enough data to support a recommendation. Agricultural expertise remains essential.
- Predictive model training is **experimental** unless held-out space/time validation proves generalization. Do not represent it as a field-tested model.

## Engineering standards
- Backend: FastAPI Python 3.12, deterministic services, pydantic request validation.
- Frontend: React + TypeScript + Vite + Leaflet, strictly typed response fields.
- API calls for Earth observations must have bounded timeouts, coordinate validation, explicit user intent, and visible loading / unavailable states.
- No credentials or tokens in code, ZIP, GitHub actions logs or the frontend. `.env` and backend data directories must remain ignored.
- Domain registrar/hosting subscriptions require the account owner's manual authorization. GitHub Pages can host the static frontend; Python API must run in a Python-capable environment.
- Add tests for each feature. Run `PYTHONPATH=backend python -m unittest discover -s tests -p 'test_*.py'` and `cd frontend && npm ci && npm run test && npm run build` before claiming success.

## Literature and citation requirements
- Cite NASA/FAO/INIA documents and indexed peer-reviewed studies where they actually support the decision.
- Do not convert limited literature information to location-specific agronomic recommendations without validating species, varieties, soils and seasons.
