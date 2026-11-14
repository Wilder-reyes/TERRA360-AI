# Proveniencia y calidad del catálogo ECOCROP

**Total de registros importados:** 2.568 especies. **Otras fichas TERRA360:** 95. Son registros, no necesariamente 2.663 especies biológicas únicas.

## Fuente y comprobación

**Titular de datos:** Organización de las Naciones Unidas para la Alimentación y la Agricultura (FAO); **publicación técnica:** CGIAR Climate Action Data Hub. Registro: https://cgiar-climate-data-hub.github.io/catalog/ecocrop/

**Copia de origen fijada:** OpenCLIM `https://raw.githubusercontent.com/OpenCLIM/ecocrop/ea43ecd418fd1a1ea08d32c7dce64b7fae02dec4/EcoCrop_DB.csv`

**Git blob SHA1:** `849cc89873ef766690b12ac8251db4639c642084`. **SHA256 del CSV:** `4187e8846336e185c4583165211c5981855e95adfbefd897bd2bd481de48d106`.

**Licencia del catálogo distribuido (según CGIAR):** CC BY 4.0. **Atribución requerida:** Source data from the FAO EcoCrop database, Food and Agriculture Organization of the United Nations.

**Importación auditable:** `scripts/import_ecocrop.py`; descarga el CSV Windows-1252, verifica SHA Git blob y número de registros, y produce `backend/app/data/ecocrop_species.json` con fuente, autoría y campos separados. Los tests rechazan cambios de integridad. GitHub Actions `import-ecocrop.yml` genera y fija la copia en el repositorio privado; no se descarga en cada solicitud de un agricultor.

## Cómo interpreta TERRA360 los datos

- Nombre científico, sinónimos, nombre común, familia y categoría: **búsqueda/exploración**.
- Intervalos FAO ECOCROP (temperatura, lluvia anual, pH): solo **rangos orientativos de bibliografía**, no estimaciones específicas de parcela ni promesas de aptitud.
- Valores absurdos (por ejemplo temperatura de 160 °C) se **ocultan en la presentación**, conservando la fuente original para auditoría; no se inventan valores corregidos.
- ECOCROP tiene observaciones con faltantes y errores. CGIAR reporta 495 registros sin temperatura ni lluvia, y 1.411 sin temperatura letal, además de anomalías. No extrapolar ni usar umbrales climáticos como mediciones de campo.
- ARIE solo acepta estas fichas en exploración; no asigna un cultivo como apto para una región por aparecer en ECOCROP.
- La aptitud específica de **FAO GAEZ v5 no se ha importado**: otro conjunto de datos con criterios, escalas, opciones de manejo y escenarios distintos.

## Requisitos futuros de aptitud validada

Para evaluar una especie/variedad se necesita seleccionar producto GAEZ v5 con período/manejo/píxel/mascarilla, documentar calidad/resolución, corroborar suelo y agua del terreno, revisar calendarios y variedades, y contrastar con agrónomos y agricultores. Hasta entonces el sistema debe abstenerse de recomendar si falta evidencia.
