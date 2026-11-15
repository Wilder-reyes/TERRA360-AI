# chakra — decisiones de rotación con datos NASA

**CHAKRA**, del equipo **CHAKRA X** · NASA Space Apps Challenge 2026 · Field Shift: Adapting Farms with NASA Data · Versión principal en inglés: [README.md](README.md)

**Demo:** https://biotex-eta.vercel.app/ (el dominio dice *biotex*; el producto es CHAKRA) · **API:** https://terra360-api.onrender.com/api/health

## Problema

Los agricultores familiares de los valles costeros con riego del Perú deciden cada campaña qué sembrar sin ver cómo su rotación afecta su suelo ni cuán expuesta está al agua escasa de estiaje y al calor. El agua del valle viene de ríos andinos que llevan la mayor parte de su caudal en 3–4 meses (dic–abr); de mayo a noviembre el río baja.

CHAKRA permite delimitar un terreno, registrar qué se sembró en cada zona y comparar **al menos tres estrategias de rotación, incluida la actual**, con **por qué, evidencia, beneficios, vacíos y riesgos**. Piloto público: **Barranca** (valles Pativilca / Supe, Lima).

## La demo en 3 pasos

1. **Delimitar:** abre el mapa y toca el ejemplo de Barranca (parcela de estudio `barranca-1`, ~2,25 ha), o dibuja o importa (GeoJSON) cualquier terreno.
2. **Cultivos y zonas:** dibuja zonas si hace falta y elige el cultivo y el mes de siembra de cada una. Los cultivos los **declara el agricultor**; nunca se infieren de imágenes.
3. **Mi plan:** plan por zonas y **comparación de 3 estrategias** (S0 actual, S1 Agua, S2 Suelo), cada una con sus 5 secciones. El PDF A4 incluye el croquis por zonas con superficies y la tabla de las 3 estrategias.

Fuera de Barranca el resultado indica que es una **orientación por reglas generales, no una recomendación validada localmente**.

## Datos NASA y escala

- **NASA HLS v2.0** (30 m): historial mensual de vegetación del terreno 2021–2026, con máscara de nubes; los meses sin imagen no se rellenan. *Observado.*
- **NASA POWER** (malla ~0,5°, 2001–2025): ET0 FAO-56 y Tmax; agua del cultivo = Kc × ET0. Si la celda cae en la sierra se usa la celda costera vecina. *Calculado.*
- **NASA GPM IMERG** (0,1°): lluvia en la cuenca alta aproximada, 2015–2025. *Contexto observado.*
- **SMAP, SRTM, GIBS:** solo contexto regional.

**Modelo:** pequeño modelo estacional reproducible (44 observaciones NASA HLS, una parcela de estudio) — prueba de concepto. Solo se aplica al polígono exacto de barranca-1; no identifica cultivos ni rendimientos.

## Ejecutar y reproducir

Ver la sección *Run and reproduce* de [README.md](README.md): pruebas del backend, `python scripts/reproduce_field_shift_ai.py --check`, pruebas y build del frontend, y Playwright.

## Límites

Comparaciones relativas para conversar con un técnico de la Agencia Agraria o de la Junta de Usuarios; no son rendimientos, ganancias, ahorros de riego ni validaciones de campo. Más verde = más vegetación observada, no necesariamente un cultivo más sano.

## Uso de IA

El equipo eligió el enfoque del problema, los agricultores objetivo, la zona y la dirección de la solución. Se usaron asistentes de IA (Claude de Anthropic y OpenAI Codex) para investigar estadísticas oficiales, redactar documentos y escribir y probar código; el equipo revisó todo.

## Licencia

[MIT](LICENSE) © 2026 equipo CHAKRA X.
