# FAO GAEZ v5 — contrato de datos antes de integrar aptitud espacial

**Revisión de fuentes oficiales:** 14 noviembre 2026. **Estado: origen y
estructura documentados; ninguna capa de aptitud agrícola integrada ni
validada localmente.**

## Fuentes y versión

- [FAO Global Agro-Ecological Zones v5](https://www.fao.org/gaez/en):
  versión publicada en 2025; referencia de condiciones actuales de 2020,
  suelo HWSD actualizado, clima AgERA5 y escenarios CMIP6.
- [Catálogo maestro v5 de FAO](https://data.fao.org/catalog/dataset/gaez-v5-master-config):
  mapas regulares globales de **5 minutos de arco (~10 km)**; algunos
  productos de aptitud/cobertura/terreno a **30 segundos (~1 km)**.
  Requiere identificar el producto correcto; no confundir estas escalas.
- [Tema v5 Suitability and Attainable Yield](https://data.fao.org/catalog/dataset/gaez-v5-master-config/resource/31abf121-1644-4473-8c1b-bfec83112749):
  separa **Suitability Class**, **Suitability Index**, potencial productivo
  y **Crop Water Indicators**. Incluye cultivo y condiciones bajo
  secano/riego, manejo intensivo/bajo, periodo de clima.
- [Catálogo FAO, ejemplo verificable de RES01-TMP-TS](https://data.fao.org/catalog/dataset/9b47eeb7-6a44-4ee8-b880-0c11732df7e4):
  **temperatura anual media**, resolución nominal ~10 km, CC BY 4.0,
  no-data -9999, escala 1; es una capa climática de prueba de estructura,
  **NO una clasificación de aptitud de cultivo**.
- [Repositorio de documentación FAO GAEZ v5](https://github.com/un-fao/gaezv5/wiki)
  y [portal](https://www.fao.org/land-water/resources/tools/databases/gaez/en).

## Requisitos obligatorios antes de mostrar aptitud o rendimiento

1. Identificar código preciso de **variable, cultivo y tipo de aptitud**,
   nombre científico/unidad, variedad si aplica, y metodología.
2. Seleccionar **condición de agua** (secano/irrigado), **manejo**
   (insumo bajo/alto), periodo (histórico/actual/proyección),
   SSP/modelo si aplica.
3. Registrar identificador de raster/mapset y enlace autorizado,
   hash/versionado, licencia **específica de la capa** y fecha de acceso.
   La licencia de un ejemplo CC BY 4.0 no se extrapola a todo el catálogo.
4. Leer valores reales y **no-data**, revisar factor de escala y clases.
   Reconocer áreas sin cobertura y límites de clasificación.
5. Informar resolución de cada celda. Los datos GAEZ de 1–10 km
   **no son mediciones agronómicas a escala de una parcela de 1 ha**.
6. Evitar vincular nombres de FAO ECOCROP a códigos GAEZ por texto o
   taxonomía no auditada; construir un mapeo curado.
7. No confundir `suitability index` con rendimiento observado, probabilidad
   de éxito ni una fecha de siembra individual.
8. Realizar comparación con mapas/perfiles nacionales peruanos y expertos
   antes de generar recomendaciones; no atribuir calibración a FAO.

## Estado técnico 2026-11-14

**Hallazgo:** se ha verificado el acceso público a descripciones, código
de temas y ejemplos de metadatos oficiales. **Pendiente:** elegir e importar
un archivo raster de una clase GAEZ v5 con todas las dimensiones y licencia
confirmadas; resolver las credenciales/cotas de su distribución cuando
corresponda. No existe aún un endpoint de aptitud GAEZ. Este documento
es una salvaguarda científica, no una integración ficticia.

## Contrato de API futuro (NO implementado)

Cada respuesta deberá identificar explícitamente `source_dataset_id`,
`source_version`, `variable_code`, `crop_code`, `water_supply`,
`management_level`, `climate_period`, `scenario`, `unit`,
`native_resolution`, `valid_fraction`, `nodata`, `raster_checksum`
y `limitations`. Si falta una dimensión crítica, **abstenerse**.
