---
name: biotex-farmer-experience
description: "Rules for scientifically honest, accessible agricultural decisions, map layers, spatial rotations and BIO's onboarding in BIOTEX."
---

# BIOTEX · Farmer experience engineering contract

Apply with the existing `ui-ux-pro-max` skill; use the twelve selected Aura guides as design-review references only if license and content were verified. Do not claim to have installed a third-party skill when it is only cited in a planning document.

## Farmer-first hierarchy
1. Ask where the field is; distinguish a statistical-sector point from a farmer's actual parcel.
2. The farmer records crop identity; imagery does **not** identify it automatically.
3. Ask priorities, availability and uncertainty.
4. Present rotation options, maps, risks, evidence, action checklist and optional methodology.

## Geospatial truth
- Labels distinguish **satellite observation**, **regional reanalysis**, **farmer-declared input**, **illustrative scenario**.
- Every scientific map layer shows source, spatial resolution, date/time, unit, legend, QA/no-data status and link.
- NASA MODIS (regional NDVI) does not describe a two-hectare field. NASA IMERG (~10km) is not irrigation canal flow. NASA POWER grid is not a thermometer in the field. SRTM90m terrain samples are not cadastral surveys. ERA5-Land (~9-11km) is not local frost risk or a forecast.
- ECOSTRESS must have a validated scene, time and mask before enabling numerical claims. GLDAS is research-level context only.
- Field boundary and subplot allocation are illustrations unless verified and declared by a farmer. Show spatial polygons proposed versus observed with different visual encodings.
- Subplot polygons must be inside the main polygon and disjoint; area sums use geodesic calculations.

## Rotation engine
- Never reuse Lima coastal calendar or Barranca-trained model for Chalhuas.
- Catalogue crops for the area with family, documented source, sowing/cycle confidence, soil/irrigation/variety status. A historical mention is not verified suitability in the current field.
- Keep exact civil years, months, campaign starts, and valid intervals; test every year transition.
- Restrict infeasible rotations using locally expert-verified hard constraints; do not convert missing soil or water information to 'safe'.
- Botanical diversity, legume campaigns, time to return to potato, pests and labor/market limitations are informative. Do not claim a quantified nitrogen contribution or savings without empirical evidence.
- For four-year reference scenarios, do not assert that every year has continuous vegetation or definite sowing months.
- S0 is farmer-declared; R1/R2 are **study hypotheses**, not prescriptive recommendations.
- The Barranca NDVI model is invalid for Junín. Train a new model only after real HLS observations, reproducible QA and temporal holdout.

## BIO
- BIO is the introduction/tutorial mascot, **not a chatbot, agronomist or weather forecaster**.
- Allow: next, previous, skip, repeat; store opt-out locally, accessible keyboard/Escape, reduced motion.
- Explain actionable controls briefly, highlighting only real UI controls. Do not block the map's essential operations.

## Skills-to-code quality contract
- **Web Interface Guidelines:** keyboard, focus, semantics, helpful errors.
- **UX Copywriting Guide:** simple Spanish, decisions before indices.
- **Web Design Reviewer:** desktop/mobile screenshot review.
- **Responsive Design:** 360/390/768/1280 px functional.
- **UI Design System Toolkit:** same components/tokens.
- **Interaction Design:** BIO navigation and gestures.
- **Design State Ownership:** local saved dates, migration.
- **Build Interactive Dashboards:** legends and interactive dates/series.
- **Frontend Developer Expert:** typed, shared code, no duplicated backend science.
- **UI Consistency Auditor:** same words/sources on plan, map and print.
- **Image Optimization Analysis:** tiny BIO SVG, lazy maps.
- **Skill Creator:** maintain this file and examples.

## Release gate
Keep Vercel static + an independently configured Python API; no secret in frontend. Build TypeScript, all Python/unit/browser tests pass; scientific provenance/case-study data verified separately. Never describe unvalidated local AI as trained. Preserve reproducible Barranca data and model, with explicit abstention outside its exact parcel. Do not reconnect old hosted projects.
