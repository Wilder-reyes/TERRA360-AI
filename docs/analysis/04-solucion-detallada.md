# Solución detallada — TERRA360 «Comparador de rotaciones»

Fecha: 2026-11-14 · Entrega: 2026-11-15 23:59 · Base: problema cerrado en [03-problema-final.md](03-problema-final.md)

---

## 1. Idea en una línea
**«Mira tu terreno desde el satélite, ve tu rotación de los últimos años y compárala con dos alternativas que cuidan mejor tu suelo y tu agua.»**

## 2. Qué se conserva, qué cambia y qué se quita de lo que hizo tu compañero

| Pieza actual del repo | Decisión | Motivo |
|---|---|---|
| Mapa, dibujo de terreno, búsqueda, leyendas sencillas (v0.17/v0.18) | ✅ **Mantener** | Ya funciona y es *farmer-first* |
| Piloto Huando-Huaral (centroide oficial de MIDAGRI 2024) | ✅ Mantener + **agregar un sector de Barranca** del mismo padrón MIDAGRI | Misma fuente oficial |
| Sentinel-2 NDVI por terreno (`sentinel_timeseries.py`) | 🔧 **Ampliar**: hoy son **máx. 4 observaciones**; hace falta una **serie mensual de 3–5 años** | Es la única forma de ver la rotación real |
| NASA POWER (clima diario e histórico) | ✅ Mantener + **ET0 y calor por mes** | Base de la demanda de agua y del estrés por calor |
| ARIE / escenarios S0-S1-S2 y familias botánicas | 🔧 **Reconvertir** en el motor de rotaciones con calendario mensual | Ya tiene la lógica de «rotación actual vs. alternativas» |
| GPM IMERG | 🔧 Reenfocar: **lluvia en la cuenca alta**, no en el terreno | En la costa casi no llueve |
| SMAP, GAEZ, catálogo de 2 568 especies FAO | ⏸️ Segundo plano (ficha «Fuentes» o pestaña técnica) | No aportan a escala del terreno costero; restan claridad |
| Foto del cultivo | ⏸️ Pospuesto | Decisión del equipo |

## 3. Flujo del usuario (4 pantallas, móvil)

1. **Mi terreno.** Elegir zona (Huaral o Barranca) → tocar un terreno de ejemplo o dibujar el propio.
2. **Mi rotación actual.**
   - Gráfico de «verde del terreno» (NDVI) mes a mes, 2021–2026.
   - Franjas de **campaña** (verde) y **terreno sin cultivo** (pardo rayado), detectadas automáticamente.
   - Para cada campaña, la app pregunta *«¿Qué sembraste aquí?»* con 10–12 botones de cultivos locales. Propone un candidato según el mes de siembra y la duración del ciclo; el agricultor confirma o corrige.
3. **¿Qué te importa más?** Tres o cuatro deslizadores sencillos: *ahorrar agua · mejorar el suelo · ingreso · menos plagas*. Más una pregunta: *«¿cómo suele estar tu turno de agua entre mayo y noviembre?»* (normal / escaso).
4. **Compara 3 rotaciones** (pantalla principal de la demo):
   - Tres líneas de tiempo de 24 meses, una debajo de otra: **Tu rotación actual · Alternativa «Agua» · Alternativa «Suelo»**.
   - Debajo, franjas de contexto: **meses de río bajo** (estiaje), **meses de más calor** y **demanda de agua del cultivo**.
   - Cada rotación tiene una tarjeta con iconos (💧 agua, 🌱 suelo cubierto, 🫘 aporta nitrógeno, 🐛 corta plagas, 💰 mercado) y un botón **«¿Por qué?»**, que abre la ficha de 5 secciones.
   - Botones **Imprimir/PDF** (ya existe en v0.18) y **«Llévalo a tu técnico»**.

## 4. Motor de análisis (qué calcula y con qué datos)

### 4.1 Detección de la rotación actual: la parte «IA», explicable
- **Dato:** serie **HLS (Harmonized Landsat Sentinel-2, producto NASA)** a 30 m, o Sentinel-2 L2A a 10 m, con máscara de nubes. Por cada mes se toma el **máximo de NDVI** del terreno (2021–2026).
- **Algoritmo:**
  - Suavizar la curva (Savitzky-Golay o media móvil) sin rellenar meses sin dato.
  - Marcar como **campaña** cada tramo en que el NDVI sube por encima del umbral y vuelve a bajar.
  - Marcar como **sin cubierta** los tramos con NDVI bajo sostenido.
  - Los umbrales son de partida y se declaran como heurísticos: <0,2 desnudo; >0,4 cultivo activo. Se calibran mirando terrenos de muestra.
- **Salida:** lista de campañas (inicio, fin, duración) y meses sin cubierta por año, más un *candidato de cultivo* por campaña. El candidato se obtiene cruzando el mes de siembra y la duración con el **calendario de siembras real de la DRA Lima** (`fuentes/`) y con las duraciones de ciclo de FAO-56.
- **Mensaje honesto:** «historial **estimado por satélite**; confírmalo o corrígelo».

### 4.2 Indicadores por rotación (calendario mensual de 24 meses)

| Indicador | Cálculo | Datos | Lo que dice al agricultor |
|---|---|---|---|
| 💧 **Agua en estiaje** | Σ (Kc × ET0) por mes; se destaca la parte que cae en **may–nov** | **NASA POWER** (ET0 o radiación y temperatura → ET0 FAO-56), **Kc FAO-56** | «Esta opción pide X % menos agua en los meses en que el río trae poca» |
| 🔥 **Calor en etapa sensible** | Meses con Tmax alta durante la floración o el llenado del cultivo | **NASA POWER** (climatología de 20+ años); **ECOSTRESS** LST como evidencia visual si hay escenas | «Tu maíz florece en el mes más caluroso» |
| 🌱 **Meses sin cubierta** | Meses vacíos en el calendario (en la rotación actual: medidos por NDVI) | **HLS/Sentinel-2** | «Tu terreno queda pelado N meses al año» |
| 🫘 **Aporte de nitrógeno** | Presencia de leguminosa (frijol, vainita, pallar, arveja) | Literatura e INIA | «Incluye una leguminosa que deja nitrógeno» |
| 🍂 **Materia orgánica** | Clase de rastrojo del cultivo (alta para maíz y abonos verdes, baja para hortalizas) | Literatura; **SoilGrids** (MO actual del suelo) | «Deja más residuos para el suelo» |
| 🐛 **Corte de plagas** | Cultivos consecutivos de la misma familia | **Lógica ARIE existente** | «Evita repetir maíz tras maíz» |
| 💰 **Mercado** | Cultivo con superficie sembrada relevante en la región y precio en chacra disponible | **DRA Lima** (siembras y precios), MIDAGRI | «Se siembra y se vende en tu zona» (sin prometer precio) |
| ⛰️ **Erosión** | Pendiente media del terreno × meses sin cubierta | **SRTM** (ya integrado) | En valle plano: «riesgo bajo»; en ladera, advertencia |
| 🏔️ **Agua que viene** (contexto común a las 3) | Lluvia mensual de la **cuenca alta** del Chancay o del Pativilca, años secos frente a normales | **GPM IMERG** (+ PISCO si hay tiempo) | «Este año la sierra recibió menos lluvia: el estiaje puede ser más duro» |

### 4.3 Cómo se generan las 2 alternativas
- **Catálogo local de cultivos (12):** MAD, maíz chala, camote, papa, frijol canario o castilla, vainita, pallar, arveja verde, cebolla, zanahoria, brócoli/col y alfalfa. Cada uno con: familia, Kc por etapa (FAO-56), duración de ciclo, meses de siembra habituales en Lima (DRA Lima) y clase de rastrojo.
- **Búsqueda con restricciones:**
  - Respetar los meses de siembra habituales y los ciclos.
  - Mantener al menos un cultivo «de ingreso» del agricultor, como el MAD.
  - Probar secuencias de 24 meses y **puntuarlas** con los indicadores ponderados por los deslizadores.
- **Resultado:** las 2 mejores con perfiles distintos.
  - **«Agua»**: minimiza la demanda en estiaje, por ejemplo cambiando una campaña de maíz de invierno por camote o frijol.
  - **«Suelo»**: maximiza cobertura y leguminosa, por ejemplo MAD → vainita o frijol → camote, sin dejar el terreno pelado.
- **Abstención:** si faltan datos (sin escenas o sin confirmación del cultivo), lo dice y no inventa nada.

### 4.4 Ficha «¿Por qué?» de cada estrategia (literal del challenge)
1. **Por qué se sugiere:** qué prioridad del agricultor atiende y qué patrón del terreno corrige (por ejemplo, «4 meses pelado entre jun y sep»).
2. **Evidencia:** datos usados (con fecha y fuente: HLS, POWER, IMERG, DRA Lima) y la referencia agronómica.
3. **Beneficios posibles:** agua en estiaje (−X % relativo), meses cubiertos (+N), aporte de nitrógeno (sí/no), corte de plagas.
4. **Vacíos de información:** sin análisis de suelo del terreno, sin dato real de turno de riego, el precio futuro, la variedad.
5. **Riesgos a revisar con un técnico:** plagas propias del nuevo cultivo, salinidad, mercado y maquinaria.

## 5. Datos: plan por prioridad (para entregar mañana)

| Prioridad | Dataset | Para qué | Estado en el repo |
|---|---|---|---|
| **P0** | HLS (NASA) o Sentinel-2 L2A, **serie mensual 2021–2026** | Rotación actual y meses sin cubierta | 🔧 Ampliar (hoy son 4 observaciones) |
| **P0** | NASA POWER mensual (T2M_MAX, ET0 o insumos de ET0) | Agua y calor | 🟢 Existe la conexión; falta el cálculo mensual |
| **P0** | Tabla Kc y ciclos FAO-56 + calendario DRA Lima (12 cultivos) | Motor de rotaciones | 🔴 Crear (archivo JSON con fuente) |
| **P1** | GPM IMERG mensual en la cuenca alta (Chancay y Pativilca) | Contexto «agua que viene» | 🟡 Existe IMERG; cambiar el área |
| **P1** | SRTM pendiente | Erosión | 🟢 Existe |
| **P2** | SoilGrids (MO, textura) | Contexto de suelo | 🔴 Opcional |
| **P2** | ECOSTRESS LST/ET | Evidencia visual de calor y ET | 🔴 Opcional («si alcanza») |

**Datos NASA declarados ante el jurado:** HLS/Landsat, NASA POWER, GPM IMERG, SRTM y, como contexto, SMAP/ECOSTRESS. **Socio ESA:** Sentinel-2. **Locales:** MIDAGRI/DRA Lima, ANA, INEI ENA y SoilGrids.

## 6. Cómo responde a los criterios del jurado
- **Impacto:** costa irrigada que abastece a Lima y a la cadena avícola. El método se replica a cualquier valle costero.
- **Creatividad:** reconstruir la rotación real **desde el espacio** y mostrarla como línea de tiempo comparable.
- **Validez:** indicadores relativos, trazables y con abstención; límites de escala explicados (por qué IMERG va en la cuenca y SMAP no se usa por terreno).
- **Relevancia:** cumple literalmente lo pedido: ≥3 estrategias incluida la actual, con las 5 secciones, prioridades del agricultor y periodos sin cubierta.
- **Presentación:** demo de 30 s: *terreno → rotación detectada → 3 opciones → «¿por qué?»*.

## 7. Plan hasta la entrega (sugerido)

| Cuándo | Qué | Quién |
|---|---|---|
| Hoy, tarde y noche | P0: serie NDVI mensual + detección de campañas; catálogo de 12 cultivos; cálculo agua/calor con POWER; motor de 3 rotaciones; pantalla de comparación | Chat del repo / compañero |
| Hoy (este chat) | Tabla de 12 cultivos con Kc, ciclos y calendario con fuentes; elegir 2 terrenos de ejemplo por zona; textos de las fichas | Este chat |
| Mañana AM | P1 (IMERG cuenca, SRTM), pruebas, robustecer, revisar textos | Repo + este chat |
| Mañana PM | Video/demo, formulario de envío (título, resumen, datos usados, uso de IA), ensayo | Equipo |
| **23:59** | **Enviar** (apuntar a las 21:00 para tener margen) | — |
