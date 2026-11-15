> Documento histórico: no configura ni publica la versión actual. Consulte `docs/BIOTEX_ARCHITECTURE.md` y `docs/vercel-deployment.md`.

# Hoja de ruta TERRA360 AI — v0.11 · corte técnico y científico

**Fecha:** 14 noviembre 2026 (Perú). **Base:** [v0.10](roadmap-v0.10.md).
**Plataforma:** [dominio histórico retirado]
**API:** [dominio histórico retirado]
Los datos satelitales reales no deben confundirse con precisión agronómica validada.

## Cambios verificables desde v0.10

| Entregable | Estado técnico | Qué demuestra y qué NO |
|---|---|---|
| Auditoría de 2.568 registros FAO ECOCROP | **Integrado en main (PR #5)** | Registra incoherencias y ausencias; no corrige ni valida adaptación local |
| Sentinel-2: B04 roja 10 m, B08 NIR 10 m | **Implementado (PR #6)** | Ventanas reales COG sobre un polígono WGS84; no mapa de estrés agrícola |
| SCL 20 m, nubes/sombras/defectos | **Implementado (PR #6)** | Remuestreo nearest a cuadrícula de 10 m; la resolución informativa SCL sigue siendo 20 m |
| Corrección radiométrica `s2:processing_baseline` | **Implementado y probado** | Desde PB04 se aplica -1000 DN antes de NDVI; no equivale a calibración en campo |
| NDVI por parcela declarada | **Implementado y probado con datos reales** | Cobertura, promedio, mediana, dispersión espacial y abstención por calidad |
| Interfaz NDVI dentro del mapa | **Implementado, sujeta a QA en dispositivos reales** | Botón solo con un polígono o rectángulo, no con un pin suelto |
| CI Python/React y simulaciones de geotiff | **Automatizadas** | Verifican ecuaciones, coordenadas, API, seguridad del proveedor y compilación |
| Integración real ESA/Copernicus | **PASS en workflow #43588640412** | COG B04/B08/SCL sobre un contorno ilustrativo de Calca, no una finca validada |
| Estimación de incertidumbre calibrada | **No concluida** | Hay controles de cobertura y percentiles espaciales, NO intervalo de confianza físico |
| Datos GAEZ v5 por clase/periodo/manejo | **Pendiente** | No importar ni inventar capas sin revisar licencia y metadatos |
| GPM/SMAP estadísticos por polígono | **Pendiente** | Las capas GIBS todavía son visuales, no estadísticas exactas |
| Pendiente derivada de DEM por parcela | **Pendiente** | Actual SRTM 90 m: 5 muestras del entorno |
| Cultivares, calendarios, disponibilidad de agua y validación agronómica | **Pendiente de fuentes locales y especialistas** | No usar ECOCROP ni NDVI como asesoramiento prescriptivo |
| Ensayos con 5 agricultores y agrónomos | **Pendiente de participantes** | No se pueden sustituir con tests de software |

## Primera medición reproducible

Prueba externa: [GitHub Actions #43588640412](https://github.com/Wilder-reyes/TERRA360-AI/actions/runs/43588640412).

- Sentinel-2C, **4 de noviembre de 2026**, PB **05.13**.
- 596/596 píxeles computados tras máscaras; cobertura aproximada 98,3 %.
- NDVI medio **0,1776**, mediana **0,1277**, p10 **0,0128**, p90 **0,4404**.
- Polígono ilustrativo cerca de Calca; NO observaciones de cultivos identificados.

**Alcance de las pruebas:** acceso STAC y COG, georreferenciación, remuestreo SCL,
lectura de tres bandas, corrección de offset y cálculo NDVI. Los números
p10/p90 muestran dispersión espacial, no precisión instrumental ni intervalos
de confianza estadísticos.

## Condiciones de seguridad y calidad

1. Aceptar solo polígonos simples con 3–100 vértices y área de 0,1–500 ha.
2. Procesar como máximo 3 escenas y 160.000 píxeles por ventana.
3. Restringir URLs raster a la cuenta Azure autorizada; no divulgar SAS firmados.
4. Excluir agua, nubes, nieve, sombra, defectos y píxeles no clasificados en SCL.
5. No entregar promedio NDVI si hay menos de 20 píxeles o menos de 60 % de
   cobertura válida aproximada.
6. Identificar la fuente, escena, fecha, processing baseline, resolución, calidad
   y advertencias en cada respuesta. No agregar NDVI automáticamente a ARIE.
7. Verificar despliegue Netlify/Render después de fusionar los cambios.
8. No convertir un único NDVI en predicción de cosecha, riego o salud vegetal.

## Próxima fase no automatizable sin evidencia adicional

Importar GAEZ v5 con metadatos y permisos reales, procesar series temporales
con corrección atmosférica y contraste independiente, reproducir rasters
GPM/SMAP sobre polígonos con incertidumbre cuantificada, y realizar pruebas de
comprensión con agricultores y revisión agronómica independiente.

**No declarar el producto científicamente validado por pasar CI.**

Métodos: [Sentinel-2 NDVI](sentinel2-ndvi-method.md) · [ECOCROP](ecocrop-quality-audit.md) ·
[Protocolo de agricultores](farmer-validation-protocol.md).
