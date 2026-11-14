# BIOTEX — Development guidelines for coding agents

This is the NASA Space Apps Field Shift crop-rotation decision-support project, developed by NSPACE BIOTEX. Its GitHub repository and internal Python/Node identifiers remain TERRA360-AI; the project presentation calls the platform BIOTEX. A coordinated rename must be a separate change.

## UI/UX workflow
- For any task affecting the React user interface, user experience, accessibility, charts, maps, colors, typography or layout, read `.agents/skills/ui-ux-pro-max/SKILL.md` and the existing visual baseline in `design-system/biotex/MASTER.md`.
- For a new page or redesign, use the local catalog **before** coding: `python .agents/skills/ui-ux-pro-max/scripts/search.py "agricultural decision-support accessible mobile dashboard" --design-system -p BIOTEX`. Run a separate `--stack react` search for React guidance.
- Treat the catalogs as design suggestions. They must not replace the established farmer workflow or the current green identity without a clear user request.
- Preserve: field selection/drawing and GeoJSON, NASA HLS estimated history and farmer crop confirmation, farmer priorities, S0 current versus S1 water versus S2 soil over 24 months, five-section explanations and print/PDF.
- Keep Spanish and English working; optional Quechua remains marked in preparation unless validated. Do not simplify away data source labels, uncertainty, unknown values or no-data states.
- Do not present NASA POWER regional data as parcel measurements; NDVI alone does not prove crop identity; comparisons are NOT validated predictions of yields, profits or irrigation savings.
- This skill is development-time only. Do not import Python skill files into React, alter the FastAPI backend, change deployment providers or install new runtime dependencies merely to activate it.

## Review and validation
- Prefer small, reviewable PRs to wholesale redesigns.
- Run `cd frontend && npm ci && npm run test && npm run build` after frontend changes.
- For backend modifications run `PYTHONPATH=backend python -m unittest discover -s tests -p 'test_*.py'`.
- Inspect mobile at 375 px and desktop at 768/1024/1440 px; keyboard focus, contrast, touch targets, map interactions, spinner states and print/PDF.
- Keep environment secrets and NASA Earthdata credentials out of Git.
