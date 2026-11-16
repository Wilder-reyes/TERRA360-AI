# Handoff from the analysis chat (for Codex) — 15 Nov 2026

Complements `docs/HANDOFF_CODEX.md` (PR #49, repo/technical state). This file carries the **challenge analysis, decisions, numbers and pending work** so nothing is lost. Supporting files are in `docs/analysis/` (Spanish):

| File | Content |
|---|---|
| `03-problema-final.md` | Closed problem statement (target farmer, zones) |
| `04-solucion-detallada.md` | Solution design: screens, indicators, data priorities |
| `06-catalogo-cultivos-costa.json` | 13-crop catalogue v2026-11-14b (= `backend/app/data/rotation_crops.json`) |
| `07-rotaciones-demo-y-terrenos.md` | Demo rotations, field-selection criteria, farmer texts, glossary |
| `08-paquete-de-envio.md` | **Submission package**: official rules, English form texts (Summary, Description, NASA Data, References, AI disclosure), video script, slide outline, final checklist |
| `09-verificacion-agua-y-calor.md` + `.json` | Independent FAO-56/NASA POWER check used to validate the engine |

## 1. Deadline and rules (Space Apps 2026)
- Submit **Sunday 15 Nov, 23:59 local time**; target ~21:00 to keep margin.
- Everything in **English**. Demo: ≤30 s video **or** ≤7 slides. All links **public** (test in incognito).
- **No NASA logos** (text "NASA data" is fine). No minors in media. AI-generated images need a visible "AI-generated" watermark.
- AI use must be disclosed (README "AI assistance" + form). AI must not be presented as having invented the idea.
- Challenge page: https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/
- Judging: Impact, Creativity, Validity, Relevance (NASA data must be core), Presentation.
- Challenge core requirement: compare **≥3 rotation strategies incl. the current one**, each with **why, evidence, benefits, gaps, risks**. Do not break this (step 3 S0/S1/S2).

## 2. Decisions already taken (do not re-open)
- Team **and** product: **CHAKRA X** (team) / **CHAKRA** (product). Old names BIOTEX / TERRA360 only as internal identifiers.
- Public pilot: **Barranca** (study field `barranca-1`, ~2.25 ha, representative field identified on imagery, not an identified farmer). Huaral data exist but are not public. Chalhuas/Mantaro = "next step, exploratory", not a pilot.
- Demo URL: https://biotex-eta.vercel.app/?lang=en (API https://terra360-api.onrender.com). Old URLs (terra360-ai*.vercel.app, Netlify) must not be used.
- Engine rules: S1 "Water" sows yellow maize only Nov–Feb; S2 "Soil" never sows maize May–Jul; S0 free. If S1 does not lower May–Nov water, the card says so.
- AI wording: "Small reproducible seasonal model (44 NASA HLS observations, one study field) — proof of concept". Never claim crop recognition, yields, profit or field validation.
- License MIT for team CHAKRA X — **pending Wilder's confirmation**.

## 3. Key numbers (verified)
- **Barranca demo** (`barranca-1`, maize sown Feb 2026): S0 151 mm in May–Nov, bare 19/24 months; S1 46 mm (−70%); S2 0 bare months, 3 legumes, 1,138 mm (show mm, not "+654%").
- **Maize finding**: share of a maize campaign's water falling in low-river months depends on sowing month. Huaral cell: Jan 22–23%, Feb 50–51%, Mar 78–79%, Aug 71–72%, Sep 39–40%. **Barranca uses its own POWER cell: Feb = 54%.** Never mix Huaral numbers into the Barranca screen; in slides label them "Huaral example" or use Barranca values from the engine.
- NASA POWER grid pitfall: the cell nearest an inland valley can be at 2,120 m (Andes); engine uses coastal cells (Huaral 224 m, Barranca 83 m). Good "Validity" story.
- IMERG upper basin 2015–2025: normal Barranca 448 mm/yr, Huaral 339 mm/yr; season 2024-25 = 122% (Barranca) / 111% (Huaral). Approximate boxes, not ANA basins; trend only.
- Problem stat (slide 2): INEI ODS 2025 indicator 2.4.1.a, p. 42: only **12.4%** of Peruvian producers sow considering their land's agricultural suitability (2024).

## 4. Pending, in priority order (times = 15 Nov, local)
1. **Merge PR #47** (C1 maize card + IMERG line + small-base mm) and **PR #48** (light theme) — approved by the analysis chat; check CI green and coordinate with Wilder because `main` auto-deploys to Vercel + Render.
2. **Production check + 8 screenshots in light mode** (`?lang=en&theme=light`, 16:9, `barranca-1`) into `capturas/final/`: (1) home with map, (2) field + satellite layer + legend, (3) step 2 crops by zone, (4) step 3 zone plan, (5) 3-strategy comparison with maize card, (6) S1 "Water" Why/Evidence/Risks open, (7) PDF page 1, (8) mobile result. Repeat test D in production (field outside Barranca, 2 zones, reload restores).
3. **Keep-warm ping**: Wilder creates `.github/workflows/keep-api-warm.yml` via GitHub web from `docs/keep-api-warm.yml.txt` (token lacks `workflow` scope).
4. **Final public repository** (~18:00, only when Wilder says): public, English README, license, reproducible data/models, authentic history. Never rewrite dates/commits.
5. **Planning-horizon feature (mentor suggestion)** — only if 1–2 are done; separate branch; **deadline 20:30**, otherwise not merged and presented as "next step". Spec in §5.
6. Submission form texts: `docs/analysis/08-paquete-de-envio.md` (keep NASA Data list to what the app really shows: HLS v2.0, POWER, IMERG, GIBS; SMAP only if visible).

## 5. Planning-horizon feature (scoped spec)
- Step 3 keeps 3 steps. Before "Create my plan": question "How many months do you want to plan?", quick buttons 6 / 12 / 24 / 36, slider 3–60 (step 1), default 12, limits as constants.
- Backend: optional `planning_months` (3–60, 422 outside) in `/api/rotation/compare` and `/api/rotation/spatial-plan`; omitted = current behaviour. Build full campaigns (sow → cycle → harvest) chained from declared crops, same family/sowing-window/maize rules; >24 months continues the same logic (no new crops or trends). Year-crossing campaigns continuous; harvest beyond horizon marked "harvest after this plan".
- **Comparison S0/S1/S2 must survive any horizon**: indicators over the window **and per year**; if <12 months show "A full year is needed to compare water in low-river months; this is a partial view".
- Calendar: ≤12 months one row; >12 grouped by year; 60 with per-year navigation. Declared crops visually distinct from suggested ones (solid "You planted" vs dashed "Suggested").
- PDF = exactly the chosen months, per-year sections, no empty pages; same data as API and screen.
- ≥24 months notice: "Long plans repeat the rotation logic; they are not a forecast. Review it each season." No yields, irrigation availability or future weather. HLS model only for `barranca-1`.
- Persist `planning_months` (key `biotex-farm-v1`, default 12 when missing); changing it regenerates only the future plan.
- Avatar: two short lines only (on selector / when plan ready).
- Optional if time: map recolours zones by selected period.
- Tests: horizons 3/6/12/18/24/36/60, out-of-range, chained non-overlapping campaigns, year crossing, beyond-horizon harvest, per-year indicators, 3 strategies present at every horizon, PDF length, reload persistence, mobile. Never weaken a test.

## 6. Pitch lines (English)
- "Same maize, different month: a quarter or three quarters of its water falls when the river is low."
- "Today the field sits bare 19 of 24 months. 'Water' cuts dry-season water by 70%. 'Soil' keeps it covered with 3 legumes, but needs much more water. CHAKRA shows the trade-off; the farmer decides."
- "Not a black box: every option shows why, the evidence, the gaps and the risks."
- "Pilot in Barranca, on Peru's irrigated coast. Next: Andean valleys (Mantaro), where our team has crop-rotation research."
