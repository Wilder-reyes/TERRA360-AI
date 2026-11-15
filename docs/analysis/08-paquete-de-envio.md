# Paquete de envío — NASA Space Apps 2026 · Field Shift

Fuente de las reglas: [Project Submission Guide 2026](https://www.spaceappschallenge.org/resources/project-submission-guide/) y [Judging & Awards Guide 2026](https://www.spaceappschallenge.org/resources/judging-awards-guide/), leídas el 2026-11-14.

## 0. Reglas obligatorias (si no se cumplen, el proyecto queda fuera)

| Regla | Qué hacer |
|---|---|
| **Envío:** botón «Submit for Judging» antes del **dom 15-nov 23:59** (hora del Local Event). No se aceptan cambios después | Apuntar a las 21:00. Todos los campos requeridos llenos |
| **Idioma:** página del proyecto y **todo material enlazado en inglés**. Un video puede ir en español **con subtítulos en inglés**; las diapositivas, en inglés | Textos de abajo en inglés. **La app enlazada debe tener vista en inglés** (pedírselo al chat del repo: ya existe `i18n`) |
| **Demo:** video **≤30 s** o diapositivas **≤7** (incluidas portada e intro). Si se excede, **no hay Global Judging** | Video de 28 s (guion abajo) + las 7 diapositivas de respaldo |
| **Enlaces públicos**, sin login ni permisos (YouTube, Drive, GitHub) | Probar en una ventana de incógnito |
| **Al menos un dato o recurso de NASA** para optar a premio global | Cumplido (ver la sección NASA Data) |
| **Uso de IA («SI»):** está permitida para acelerar, **pero «no debe usarse para idear cómo resolver el challenge»**. Hay que declarar dónde y cómo se usó. El código y los datos generados con IA deben reconocerse en el texto y en los metadatos; las imágenes y videos generados con IA llevan **marca de agua visible** | Ver la sección 6. Declarar con honestidad |
| Sin imágenes ni voces de **menores de 18 años**; sin logos ni marcas de NASA en contenido generado con IA | Revisar el video |
| Todo el equipo confirmado en **el mismo Local Event** | Verificar hoy |

**Criterios de evaluación (1–5 cada uno):** Impact, Creativity, Validity, **Relevance**, Presentation. Relevance exige que los datos de NASA sean **el núcleo de la solución**, no un adorno. Presentation se evalúa con la demo **y** con el proyecto completo.

---

**Equipo:** NSPACE BIOTEX. **Producto:** CHAKRA. **Demo (15-nov tarde):** https://biotex-eta.vercel.app — piloto público: Barranca (Huaral validado en datos, no visible). No usar terra360-ai-eta.vercel.app ni terra360-ai.vercel.app. Repo final de Space Apps: pendiente de crear (confirmar quién y hora).

## 1. Project Name
**CHAKRA — Field Shift Rotation Explorer** *(equipo NSPACE BIOTEX)*
Tagline: *See your field's crop rotation from space, and compare two smarter ones.*

## 2. High-Level Project Summary *(pegar tal cual; ~150 palabras)*
CHAKRA is a mobile-first decision-support tool for family farmers in Peru's irrigated coastal valleys, piloted in Barranca (Lima) and tested with fields in Huaral, who rotate short-cycle crops such as yellow maize, sweet potato, potato, beans and vegetables. Using a multi-year NASA HLS v2.0 (Harmonized Landsat Sentinel-2) vegetation (NDVI) time series, with ESA Sentinel-2 L2A as a fallback, it reconstructs the field's **current rotation** from space: when crops were growing and when the soil was left bare. It then compares that rotation with **two alternatives**, one that saves water during the low-river season and one that keeps the soil covered with nitrogen-fixing legumes. The comparison uses NASA POWER climate (crop water demand and heat), NASA GPM IMERG rainfall over the upper Andean watershed and official Peruvian crop calendars. A key finding: the same maize crop can take a quarter or three quarters of its water in the low-river months, depending only on the month it is sown. Each strategy explains why it was suggested, the evidence behind it, its potential benefits, the information gaps and the risks a local technician should review. It supports farmers' judgment; it does not replace it.

## 3. Detailed Project Description *(base; completar con capturas reales de la app)*

**The problem.** Family farming represents 95.4% of Peru's agricultural units and supplies about 70% of the food Peruvians eat, yet only 3.1% of producers received technical assistance in 2024 (INEI, ENA 2024). On the desert coast, irrigation water comes from Andean rivers that carry 60–70% of their yearly flow in just 3–4 months. Every season, farmers choose what to plant without seeing how their rotation affects their soil, or how exposed it is to scarce dry-season water and heat. In 2025, yellow-maize output in the Lima region fell by 47.5% (DRA Lima). Maize feeds Peru's poultry chain, the country's main animal protein.

**What we built.**
1. *My field*: pick Huaral or Barranca, then select or draw a field. Example fields are representative fields identified on satellite imagery, not farms of identified farmers.
2. *My current rotation*: a 5-year monthly NDVI timeline detects cropping campaigns and bare-soil periods. The farmer confirms or corrects which crop was planted in each campaign; the app suggests one based on the official Lima sowing calendar and crop cycle length.
3. *My priorities*: water, soil, income, pests.
4. *Compare 3 rotations*: 24-month timelines for the current rotation, a "Water" alternative and a "Soil" alternative, with context bands for low-river months, heat and crop water demand. A "Why?" card for each strategy shows five sections: why, evidence, benefits, gaps and risks. The comparison can be printed as a PDF to take to a technician.

**How it works (explainable AI, not a black box).**
- **Campaign detection:** monthly maximum NDVI, cloud-masked (HLS Fmask / Sentinel-2 SCL); missing months stay empty, never interpolated. Thresholds are declared and heuristic.
- **Indicators per rotation:** dry-season water demand = Σ Kc (FAO-56) × ET0 (NASA POWER) for May–Nov; bare-soil months; legume presence (nitrogen); consecutive same-family crops (pest-cycle risk); heat flag when most of a crop's sensitive stage (e.g. flowering) falls in the zone's three hottest months by NASA POWER Tmax (relative, with no fixed threshold, because POWER is not an on-farm station); residue class (organic matter).
- **Alternatives:** a constrained search over a 13-crop local catalog that respects real sowing windows and the farmer's priority weights. The "Water" option may only sow maize in Nov–Feb, so its thirstiest stage meets high river flow; if an alternative does not actually lower dry-season water, its card says so instead of presenting it as an improvement. In a Huaral example field it cuts May–Nov crop water demand by about 30% versus maize-after-maize and adds two legume campaigns. It **abstains** when data is missing.

**Why satellites, and their limits.** Coastal fields are 1–5 ha, so we use 30 m NASA HLS imagery (10 m Sentinel-2 as fallback) for the field itself. Coarse products are used only where their scale fits: GPM IMERG over the upper watershed where rain actually falls, and NASA POWER for regional climate, always from the coastal grid cell (we check the cell's elevation: the nearest cell to an inland valley can sit at 2,100 m in the Andes). SMAP soil moisture (9–36 km) mixes ocean, desert and valley here, so we show it only as regional context. All results are **relative comparisons** with stated uncertainty, not prescriptions or yield forecasts.

**Impact and scale.** The same method applies to any irrigated coastal valley in Peru, and later to Andean rainfed farms (phase 2). Next steps: validation with Huaral's irrigation users' board and INIA, soil tests, and real farmer-declared rotations.

## 4. NASA Data *(campo obligatorio; dejar solo lo que de verdad use la versión final)*
- **HLS v2.0 – Harmonized Landsat Sentinel-2 (NASA LP DAAC, HLSL30/HLSS30, via Microsoft Planetary Computer):** 30 m surface reflectance with Fmask; 5-year monthly NDVI series to detect cropping campaigns and bare-soil months. Main source of the rotation history.
- **NASA POWER (Agroclimatology):** daily/monthly temperature, radiation, humidity and wind → reference evapotranspiration (ET0) and heat-stress months.
- **GPM IMERG (Final, V07):** monthly precipitation 2015–2025 over approximate upper-basin boxes of the Chancay-Huaral and Pativilca rivers, the source of the valley's irrigation water ("water on its way" band). Shown as seasonality and % of the 2015–2025 normal (e.g. 2024-25: 111% Huaral, 122% Barranca), not as exact amounts, since IMERG can underestimate Andean rainfall. *(Borrar si el PR #41 no se fusiona.)*
- **NASA GIBS:** map context layers.
- *(Contexto, si queda en la app)* **SMAP L3 soil moisture:** regional context only.

## 5. Space Agency Partner Data and Other References
- **ESA Copernicus Sentinel-2 L2A** (via Microsoft Planetary Computer): 10 m NDVI with SCL cloud mask.
- **FAO Irrigation & Drainage Paper 56:** crop coefficients (Kc) and stage lengths.
- **MIDAGRI / DRA Lima:** *Evaluación mensual de la dinámica agropecuaria* (Oct 2025), with monthly sowings by crop, production by district and river flows (ANA).
- **MIDAGRI:** 2024 statistical-sector registry (pilot sector centroids).
- **INEI:** Encuesta Nacional Agropecuaria 2024 (context statistics).
- **ANA:** Chancay-Huaral irrigation users' registry (8,078 plots, 20,652 ha).
- **FAO ECOCROP** (CC BY 4.0) and **FAO GAEZ v5** (context).
- **Open-source software:** backend: FastAPI, Uvicorn, Pydantic, httpx, NumPy, pandas, rasterio (GDAL), Shapely, pyproj, xarray, h5py/h5netcdf, earthaccess, planetary-computer, python-dotenv; frontend: React, Vite, TypeScript, Leaflet/react-leaflet, Recharts, i18next.
- **Services:** Microsoft Planetary Computer (STAC for NASA HLS and Sentinel-2), NASA POWER API, NASA Earthdata (IMERG), Esri World Imagery basemap tiles, Open-Meteo geocoding (place search). Deployed on Vercel.

## 6. Use of SI (Super Intelligence) — respuesta honesta (no la ven los jueces)
*Borrador; el equipo debe ajustarlo a lo que realmente pasó:*
> We used AI assistants (Anthropic Claude) to accelerate work: summarizing official statistics and datasets, drafting documentation and interface text, and generating and reviewing parts of the code, which the team reviewed and tested. The problem focus, the choice of farmers and pilot valleys, and the final solution decisions were made and validated by the team. AI-assisted code and data files are labeled in the repository README and file headers. No AI-generated images or video are used *(o: they carry a visible "AI-generated" watermark)*.

⚠️ **Sobre la regla «la IA no debe idear la solución».** En este chat la IA propuso buena parte del análisis y del diseño de la solución, y el equipo tomó las decisiones: segmento, zonas, posponer la foto. Para estar en regla:
- Revisen y hagan suyas las decisiones de los archivos 03 y 04. Cambien lo que no compartan.
- Declaren el uso de IA con honestidad. La pregunta es solo para recopilar datos y no la ven los jueces.
- Agreguen al README del repo una nota de qué partes se hicieron con ayuda de IA (lo pide la regla de código y datos).

## 7. Guion del video (28 s, voz en español + **subtítulos en inglés**, o todo en inglés)

| Tiempo | Imagen | Voz (ES) | Subtítulo (EN) |
|---|---|---|---|
| 0:00–0:03 | Logo del equipo + nombres | «Somos [equipo], de Perú.» | *We are [team], from Peru.* |
| 0:03–0:07 | Valle de Huaral, campo pelado | «En la costa, el agua viene de la sierra y escasea de mayo a noviembre.» | *On Peru's coast, irrigation water comes from the Andes and runs short from May to November.* |
| 0:07–0:10 | Título TERRA360 | «TERRA360: mira la rotación de tu campo desde el espacio.» | *TERRA360: see your field's rotation from space.* |
| 0:10–0:17 | App: línea de tiempo NDVI con campañas y meses pelados | «Con satélites NASA y ESA vemos cuándo hubo cultivo y cuándo quedó pelado.» | *NASA and ESA satellites reveal when the field was cropped and when it was left bare.* |
| 0:17–0:24 | App: 3 rotaciones + ficha «¿Por qué?» | «Y lo comparamos con dos opciones: menos agua en estiaje o suelo siempre cubierto, explicando por qué y sus riesgos.» | *Then we compare two options, less dry-season water or always-covered soil, explaining why, the evidence and the risks.* |
| 0:24–0:28 | Mapa con varios valles costeros | «Un técnico en el bolsillo para miles de agricultores de la costa.» | *Decision support for thousands of coastal farmers.* |

Sin menores en pantalla. Sin logo de NASA (no está permitido sin autorización). Mencionar los datos de NASA en texto sí está bien.

## 8. Respaldo: 7 diapositivas (en inglés)
1. **Title:** TERRA360, team name, members, challenge «Field Shift: Adapting Farms with NASA Data».
2. **Problem:** coastal farmer, scarce dry-season water, bare soil, maize-after-maize; key figures (95.4% / 3.1% / −47.5%).
3. **User:** persona from Huaral/Barranca + the 4 questions.
4. **Solution:** the 4 screens (real screenshots).
5. **NASA data inside:** HLS v2.0 → rotation history; POWER → water demand/heat (coastal cell); IMERG → upstream water. Key chart: % of maize water in low-river months by sowing month (Jan 23% … Mar 79%). Scale diagram (why each dataset fits where it does).
6. **Example result:** S0 vs Water vs Soil for one real field (numbers produced by the engine) + the «Why?» card.
7. **Impact & next steps:** scales to all coastal valleys → Andes; validation with the irrigation board and INIA; limits stated.

## 9. Lista final antes de enviar (dom 15)
- [ ] App pública funcionando en **inglés** (y en español), probada en incógnito y en un celular.
- [ ] Repo de GitHub público con un README en inglés (qué es, cómo correrlo, datos, nota de IA).
- [ ] Video ≤30 s en YouTube (público o no listado) **con subtítulos en inglés**, o enlace a las diapositivas (≤7).
- [ ] Todos los campos llenos: Name, Summary, Demo link, Final Project link, Detailed Description, NASA Data, Partner Data & References, SI.
- [ ] Capturas de pantalla subidas a la página (JPG/PNG ≤10 MB).
- [ ] Las cifras del texto coinciden con lo que muestra la app (no prometer más de lo construido).
- [ ] **Submit for Judging** antes de las 23:59, idealmente a las 21:00.
