# BIOTEX — UI/UX design baseline

**Purpose:** preserve the working rotation-comparator experience while guiding accessible, evidence-driven refinements. This file is a **baseline** from v0.21 `frontend/src/rotation.css`, not a demand to retheme production.

## User and job to be done
Spanish- and English-speaking agricultural producers in the irrigated coastal valleys of Huaral and Barranca. Mobile, occasionally slow networks, bright outdoor conditions. Users need to compare 3 crop-rotation strategies (S0 current, S1 water, S2 soil), understand sources and risks, and discuss results with a technician.

## Existing design tokens (source of truth: actual CSS)
- Primary `#145442`, dark `#173a2e`, heading/header `#123e31`, action `#166448`.
- Text `#26392f`, secondary text `#5f7268`, background `#f4f7f1`, surface `#ffffff`, border `#d8e4da`.
- Context/legend: water `#3b82b8`, heat `#e0662f`, bare soil `#b08a5c`, focus `#e3b34e`.
- Typography: DM Sans (body 16px/1.5), Manrope (headings); readable labels and line heights.
- Soft rounded cards (12–18px), visible button states, clear green primary action. Avoid unrelated purple AI SaaS gradients.

## IA of the farmer journey
1. Choose Huaral/Barranca and select/draw a valid polygon or provide GeoJSON.
2. Review monthly NASA HLS greenness history, missing months and suggested seasons; farmer confirms crop identity.
3. Give priorities: water, soil, income and pests, plus irrigation turn.
4. Compare 24-month S0/S1/S2 timelines and relative, **not prescriptive**, indicators.
5. Open why/evidence/benefits/gaps/risks, inspect sources, print/share with a technician.

## Accessibility and interaction requirements
- Meaningful focus indicators, accessible forms and map controls, high-contrast outdoor legibility.
- Do not convey better/worse solely through color. Include labels, legends, units, source and date.
- Support touch-friendly controls (aim >=44×44 px), loading and retries (HTTP 202), no data and invalid polygon errors.
- Responsive QA: 375, 768, 1024, 1440 px; respect `prefers-reduced-motion`.
- Avoid auto-selecting inferred crops as confirmed truth and avoid implying satellite data is a plot-level soil sensor.

## UI UX Pro Max usage
- Begin designs with the vendored `ui-ux-pro-max` skill. Check `--domain ux` and `--stack react` separately where helpful.
- Discuss visual direction before any major retheme. Treat generated design systems as suggestions subject to current CSS and agronomic correctness.
- Change functionality only when explicitly requested; preserve API contracts and reproducibility. Pin fonts/icons/libs if intentionally adopted later.
