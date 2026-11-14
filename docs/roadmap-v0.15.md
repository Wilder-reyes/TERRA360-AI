# Hoja de ruta TERRA360 AI — v0.15 (14 noviembre 2026)

Base técnica: [v0.14](roadmap-v0.14.md). Esta versión verifica
un **GeoTIFF original de FAO** e implementa acceso responsable a
una celda nativa; no equivale a validación agronómica.

## Mejoras implementadas

| Componente | Estado | Evidencia y limitación |
|---|---|---|
| Inventario oficial FAO GAEZ v5 RES05, ficha Excel LIST_FILES | Verificado | Exactamente 1 objeto de yuca/HP0120/AGERA5/HIST/LRLM |
| FAO Google Cloud Storage, objeto original | Verificado | HTTP 200, tamaño 437 903 bytes, hash SHA-256 anclado |
| GeoTIFF original | Inspeccionado en GitHub Actions | EPSG:4326; 4320x2160; 5′; uint8; no-data 0 |
| Código bruto regional en Calca | Inspeccionado | Valor crudo 8, **no es 8 % ni aptitud agrícola** |
| Licencia oficial del conjunto de datos | Auditada | FAO CKAN declara CC BY 4.0; revisar condiciones particulares del objeto |
| API FAO `selected-layer/raw-cell` | Implementada | Copia temporal de URL fija, tamaño/hash verificados, semántica no interpretada |
| Panel de consulta de código bruto FAO | Implementado | Avisos explícitos y atribución |
| Lectura científica de aptitud | **No activada** | Faltan clases, escala, validación local y autorización |
| Ingesta privada NASA GPM + SMAP | Infraestructura desde v0.14 | Sigue faltando configurar token Earthdata y bucket persistente |
| Integridad NASA S3/R2, cuotas, retención | Pruebas ampliadas | Verificación sin secretos con FS simulado |
| Calibración agronómica y agricultores | **Pendiente** | No sustituible con datasets o tests |

## Pruebas reproducibles

- [Verificación de inventario + objeto oficial](https://github.com/Wilder-reyes/TERRA360-AI/actions/runs/43600251254).
- [Inspección geoespacial real de FAO y SHA-256](https://github.com/Wilder-reyes/TERRA360-AI/actions/runs/43600588841).
- [Licencia FAO CKAN y vinculación de RES05](https://github.com/Wilder-reyes/TERRA360-AI/actions/runs/43601050348).
- [Método completo, fuente y límites](gaez-v5-selected-layer.md).
- Tests offline de lectura auténtica, faltantes, caché, validación
  geográfica y cifrado hash en `tests/test_gaez_original_raw.py`.

## Barreras deliberadas

1. Las celdas de GAEZ tienen **5 minutos de arco** (~9 km en el ecuador)
   y no describen el suelo particular de la parcela delimitada.
2. El código `8` es un **valor bruto sin interpretación agrícola**.
   No es porcentaje de adecuación ni signo de éxito o fracaso.
3. El periodo `2001–2020` es histórico, no observación en tiempo real.
4. La licencia del paquete de datos está auditada; la explotación en
   productos finales debe respetar las condiciones específicas aplicables.
5. La API devuelve siempre `suitability_index: null` y no recomienda
   cultivos por FAO. El motor ARIE sigue separado.

## Siguiente paso

- Confirmar con documentación FAO/IIASA el significado de la codificación
  y clases de `RES05-SIX` antes de presentar aptitud, y contrastarla
  con capas nacionales y observaciones de campo.
- Configurar **bucket privado S3/R2 y Earthdata** mediante secretos, sin
  gasto automático, para habilitar datos cuantitativos reales de GPM/SMAP.
- Incorporar calidad y métricas de incertidumbre verificadas por producto;
  no usar una cuadrícula regional como dato de parcela.

El éxito del CI demuestra calidad técnica, no exactitud para el agricultor.
