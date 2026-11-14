# TERRA360 AI v0.18 — agricultor peruano primero

**Piloto:** sector Huando, Huaral, Lima, Perú. La ubicación inicial es un
centroide estadístico publicado por MIDAGRI, **no el polígono de una chacra**.

## Qué muestra el usuario final

1. **Mi terreno** abre foto aérea en Huando, permite tocar una zona, buscar una
   localidad, o marcar un polígono aproximado. Tiene capas visuales NASA GIBS
   opcionales con leyenda oficial, fecha y advertencias. No fabrica mapas de
   humedad del suelo ni de salud del cultivo a escala de finca.
2. **Cultivos para mi zona** permite elegir **un solo cultivo** desde el
   buscador en español o una opción rápida. Mantiene toma de fotografía con
   vista previa local (NO inferencia de IA; la imagen no sale del navegador).
   El botón de revisión solicita cinco años completos de registros NASA POWER.
   Muestra referencias ECOCROP **como temas para investigar**, no como
   recomendaciones de sembrar ni clasificación de aptitud.
3. **Mi tablero** muestra indicadores de lluvia acumulada, temperatura media,
   humedad relativa del aire y gráficas de 14/30/90 días. Si ya consultó
   cultivos, añade descripción de cinco años completos y datos por año,
   especie seleccionada y checklist de agua/suelo/variedad/fecha. Incluye
   **Imprimir o guardar en PDF**, basado en impresión nativa y hoja A4.

El laboratorio antiguo se mantiene en `/?vista=tecnica` para validar
fuentes y realizar las operaciones especializadas. Es una vista distinta,
no el recorrido predeterminado del agricultor.

## Fuente de las opciones de cultivo

El endpoint `GET /api/arie/crop-guidance` utiliza la ruta NASA POWER
`/api/environment/nasa-power/history` para **cinco años calendario completos**,
con abstención si menos de tres están íntegros. Resumen: media de la
temperatura anual y media de la lluvia total anual regional, exclusivamente
de años completos.

Usa una lista **exploratoria** de nombres familiares en Huaral, tomada del
catálogo interno FastAPI (no una lista de cultivos cuya aptitud esté probada).
Compara la temperatura media de referencia con `TOPMN–TOPMX` de FAO ECOCROP
y describe la diferencia en lluvia anual con `ROPMN–ROPMX`; no combina
variables en una puntuación ni afirma que el riego compense automáticamente
un déficit. Las referencias se aplican **a especie**, nunca a variedad o
terreno. Si faltan parámetros fiables, la respuesta es `insufficient_evidence`.

**Importante:** no se puede demostrar qué cultivo «se puede sembrar» con
NASA POWER y ECOCROP solamente. Es esencial comprobar agua realmente
disponible, suelo, variedad, calendario de campaña y validación técnica
local. No se predicen rendimiento, pérdidas, ingresos, riego o riesgo
fitosanitario; tampoco se clasifica salud vegetal por una foto.
Los registros de la NASA son regionales y no mediciones directas de chacra.

Fuentes y metodología:
- [NASA POWER Daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/)
- [FAO ECOCROP](https://www.fao.org/geospatial/data-and-tools/data-portals/ecocrop/en)
- [FAO requisitos ecológicos](https://www.fao.org/land-water/land/land-governance-and-planning/land-resources-planning-toolbox/detail/crop-ecological-requirements-database-%28ecocrop%29/en)
- [SENAMHI e INIA — Estación agrometeorológica en Huaral](https://www.gob.pe/institucion/senamhi/noticias/631220-senamhi-e-inia-inauguran-estacion-meteorologica-para-investigacion-agricola-en-huaral)

## Seguridad, equidad y límites

- No se transmite fotografía ni se solicita permiso de ubicación automática.
- Punto/polígono seleccionados por el agricultor pueden enviarse al backend
  para consultar el clima, nunca como validación de linderos catastrales.
- No mostrar valores cuando falte NASA: gráfico vacío y error comprensible.
- La impresión a PDF requiere elegir **Guardar como PDF** en el diálogo del
  navegador; no se almacenan PDFs ni datos personales en el servidor.
- La selección de idioma para Quechua permanece deshabilitada («En preparación»)
  hasta traducción revisada por hablantes; la interfaz predeterminada usa
  español de Perú.
- No hay modelo de visión artificial ni dataset de campo validado todavía:
  la cámara es únicamente una ayuda de fotografía local.
- La antigua ingesta SMAP de Calca sigue detenida hasta tener un AOI de
  Huando verificado. No atribuir archivos privados de Calca a Huaral.
- Los mapas NASA GIBS y las consultas NASA POWER son productos distintos:
  una imagen colorida no se transforma por sí sola en medición agronómica.

## Pruebas de aceptación

- Seleccionar un solo cultivo desbloquea consulta y reporte.
- Búsqueda y cámara coexisten sin obligación de tomar fotos.
- Se representan los años climáticos completos; faltantes no se vuelven cero.
- Ningún resultado se llama aptitud local ni recomienda sembrar.
- Se conservan pruebas de los módulos científicos especializados.
- Las nuevas páginas son legibles en pantalla móvil de 390 píxeles y tienen
  botones accesibles y contraste visual.
- Se imprime un reporte A4 con fecha, unidades, periodo, fuente, incertidumbre
  y datos disponibles, sin copiar información ficticia.
- Se requiere validación de usabilidad presencial con agricultores de Huando,
  más pruebas en móviles Android de gama básica y conexiones lentas.
