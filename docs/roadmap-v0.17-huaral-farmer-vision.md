# TERRA360 AI — dirección v0.17: piloto Huaral y experiencia del agricultor peruano

**Acuerdo de producto comunicado el 14 de noviembre de 2026.**
**Estado: especificación de desarrollo, NO se considera implementada todavía.**

## Visión y público

La persona que utiliza el producto es **un agricultor peruano**, potencialmente
sin experiencia digital ni familiaridad con el nombre del cultivo, satélites,
índices de vegetación ni datos técnicos. Su primera pregunta debe ser:
**«¿Qué está pasando en mi terreno y qué debo revisar?»**

El nuevo piloto objetivo es **una zona agrícola específica en Huaral, Lima, Perú**.
Huaral es simultáneamente el nombre de un distrito y una provincia con múltiples
distritos; todavía no está delimitado el polígono agrícola del piloto. El
nombre «Huaral» NO autoriza usar una frontera provincial, un centro urbano,
una finca imaginaria ni un punto arbitrario como el área de estudio definitiva.
La persona responsable del piloto aportará un polígono GeoJSON, las coordenadas
de los vértices o un mapa validado antes de ejecutar recortes geográficos y
evaluaciones locales.

Fuentes de contexto, para selección posterior de cultivos y actores del piloto:
- ANA/INIA 2026: https://www.gob.pe/institucion/ana/noticias/1412395-huaral-ana-fortalece-alianza-con-inia-para-impulsar-la-innovacion-tecnologica-y-el-uso-eficiente-del-agua-en-la-agricultura
- Municipalidad: https://www.gob.pe/institucion/munihuaral/noticias/1356969-municipalidad-de-huaral-impulsa-capacitacion-integral-para-fortalecer-el-desarrollo-agricola
- FAO/ANA y datos NASA: usar únicamente fuentes cuyo alcance espacial, temporal y metodológico sea verificable.

## Experiencia pública mínima, móvil primero

1. **Mi terreno:** abrir mapa centrado inicialmente en Huaral a escala
   orientativa, sin confundir centro de mapa con parcela; permitir marcar
   y editar el perímetro real del agricultor, o elegir un piloto verificado.
2. **Mi cultivo:** botón principal «Tomar foto de mi cultivo» y secundario
   «Elegir el cultivo manualmente». No exigir saber nombres técnicos.
3. **¿Qué muestra mi terreno?:** máximo una capa principal activa,
   mapa claro, leyenda visible, fecha de los datos, una frase en español
   sencillo y botón «¿Cómo se obtuvo este dato?». Mostrar solo datos
   disponibles, y hacer evidente cuando faltan o son regionales.
4. **Qué revisar:** sugerir una próxima comprobación concreta y prudente;
   no afirmar diagnósticos, necesidades de riego, rendimientos,
   recomendaciones de siembra ni enfermedades sin validación.

Ajustar el flujo de 3 pasos existente en lugar de agregar complejidad.
Evitar JSON, nombres de API, S0/S1/S2, jerga técnica y páginas llenas de
indicadores como experiencia principal; conservar todo eso en el backend
para trazabilidad y auditoría.

## Mapa: colores con significado, leyendas accesibles

Cada capa tendrá su **propia leyenda**, una unidad y una fecha. **El color
no expresa automáticamente «bueno» o «malo».**

| Capa y disponibilidad | Diseño provisional | Texto legible en leyenda |
|---|---|---|
| Vegetación Sentinel-2, cuando exista NDVI validado para la escena | Gradiente pardo / amarillo / verde | Actividad vegetativa baja / intermedia / alta; NO «cultivo sano/enfermo» |
| Lluvia NASA GPM, cuando existan observaciones verificadas | Escala secuencial de azules | Menor / mayor lluvia estimada (mm/día); no agua recibida por la parcela |
| Humedad SMAP, cuando exista celda QA válida del piloto | Escala propia, no semáforo de riego | Humedad superficial estimada por píxel regional (m³/m³) |
| Cualquier fuente incompleta | Gris con trama y etiqueta | «Sin datos suficientes» o «No disponible para esta fecha» |

En la práctica los rangos/umbrales deben basarse en el producto científico
y el contexto, no inventarse en CSS. La lectura debe conservar resolución,
cobertura, fecha, origen, calidad e incertidumbre/limitación comprensibles.
La leyenda debe ser accesible también sin distinguir colores, mediante
textos, patrones e interacción con teclado. WCAG 2.2, 1.4.1:
https://www.w3.org/WAI/WCAG22/Understanding/use-of-color

No inventar heatmaps de parcelas, interpolaciones o polígonos coloreados
para cubrir zonas sin datos; no representar resolución subpíxel falsa.

## Identificación visual del cultivo con fotografía

**Nuevo principio:** el usuario no tiene por qué buscar entre miles de
cultivos para comenzar. El backend deberá ejecutar la inferencia, y la
interfaz mostrar solo una interpretación comprensible y verificable.

Flujo propuesto:
1. Cámara o galería desde el móvil; guía sencilla para fotografiar la
   planta completa y una hoja/fruto cuando sea relevante, con opción
   de volver a intentarlo si la imagen es borrosa.
2. El frontend transmite la fotografía a un endpoint privado/controlado de
   FastAPI. Validar contenido real de imagen, tamaño, píxeles,
   número de solicitudes y tipo permitido. El modelo no se ejecuta
   ni guarda secretos en el frontend.
3. Un adaptador de visión por computadora en backend devuelve candidatos
   de **especie/cultivo**, una puntuación de modelo **calibrada solo si fue
   realmente validada**, versión, origen y estado `needs_confirmation`.
4. Mostrar «Podría ser maíz» o «No pudimos reconocer tu cultivo»,
   jamás «es maíz» sin verificación. El agricultor **confirma o corrige**
   el resultado; botones «Sí, es mi cultivo» / «No, elegir otro».
5. Solo tras confirmación humana vincular la especie al catálogo interno
   y al contexto de evaluación. No tratar la foto como medición de
   rendimiento, diagnóstico fitosanitario ni prueba de aptitud local.

**Contrato propuesto, NO implementado:**
- `POST /api/vision/crops/identify` multipart con imagen;
- respuesta `status`: `suggestions_available | unrecognized | model_unavailable`;
- campos: `candidates` (máximo 3, etiquetas aptas para usuario),
  `model_version`, `requires_farmer_confirmation: true`,
  `limitation`; no incluir credenciales, trazas ni ruta privada;
- `POST /api/vision/crops/confirm` asociaría decisión humana
  únicamente cuando exista política de sesión/datos definida;
- si falta un modelo **realmente entrenado y validado en campo**,
  responder `model_unavailable`, sin inventar clasificaciones.

### Modelo y datos

Evaluar un baseline reproducible y licencias antes de elegir arquitectura
(p. ej. clasificador ligero de imágenes, transfer learning, modelo general
de visión o servicio de inferencia autorizado). **No se ha seleccionado,
entrenado ni validado todavía un modelo.** El dataset se debe construir
para cultivos realmente presentes en la zona piloto y fotos de campo
con consentimiento, con clases «otro/no sé», varias edades de cultivo,
iluminación, fondos y equipos móviles. No deducir «plaga/enfermedad»,
variedad precisa o necesidad de insumos por una sola fotografía.

Métricas de aceptación: precisión y recall por cultivo, matriz de
confusión, desempeño en agricultores y equipos no vistos en entrenamiento,
porcentaje de abstención, falsos positivos peligrosos, latencia en móvil,
y revisión con especialistas agrícolas. Definir umbrales **después**
de pruebas locales; no fabricar un «95 % de confianza».

Evidencia de límites en imágenes de campo:
https://doi.org/10.1016/j.plaphe.2025.100062

## Catálogo y «productos» internos

Los perfiles de cultivos, taxonomía, nombres locales, metadatos FAO,
requisitos generales y resultados de identificación deberán residir en
**FastAPI/backend**, no ser una lista obligatoria en pantalla.
No sustituir el catálogo FAO de 2 568 fichas por el conjunto
realmente validado de Huaral: separar `catalog_all`,
`candidate_huaral_pilot`, `locally_confirmed` y
`assessable_with_evidence`. El agricultor recibe etiquetas cortas;
la información científica y las fuentes quedan en un desplegable.

## Seguridad y privacidad de fotografías

- Informar finalidad y obtener el consentimiento que corresponda para
  las imágenes; no asumir uso libre para entrenar modelos.
- Procesar en memoria o almacenamiento temporal; borrar al terminar,
  salvo decisión explícita y política de retención auditable.
- Retirar metadatos EXIF y geolocalización al procesar/almacenar la imagen;
  el mapa de la finca no es un consentimiento para compartir coordenadas.
- Proteger endpoint con límite de carga, tasa, duración y cuota.
- No enviar imágenes a terceros sin transparencia y autorización.
- Considerar Ley 29733 y su reglamento DS 016-2024-JUS en el diseño:
  https://www.gob.pe/institucion/anpd/campa%C3%B1as/128319-nuevo-reglamento-de-proteccion-de-datos-personales

## Bloqueadores geográficos y compatibilidad con v0.16

**No desplegar todavía datos Calca como si fuesen Huaral.**
El backend de SMAP v0.16 guarda un subconjunto con límites **Calca,
Cusco** definidos en `backend/app/services/verified_archive.py` y
`backend/app/services/smap_subset.py`. La nueva etapa debe:

1. Recibir polígono del piloto de Huaral, verificar CRS EPSG:4326,
   límites y consentimiento para tratar la localización.
2. Sustituir los límites Calca por una configuración geográfica
   **versionada y verificada**, manteniendo provenance, SHA y
   aislamiento de colecciones; nunca reinterpretar archivos anteriores
   como imágenes de Huaral.
3. Adaptar fecha, cobertura, zonificación y disponibilidad real de
   NASA/Sentinel a ese polígono. SMAP ~9 km no equivale a humedad de finca.
4. Mantener GPM global previamente almacenado con su fuente y fecha;
   no eliminar, duplicar ni reinterpretar sin necesidad.
5. Proteger compatibilidad de API y pruebas al migrar; señalizar
   capacidades todavía no disponibles.
6. Priorizar primero mapa + leyenda + toma de foto + confirmación humana;
   inferencia real únicamente con dataset/modelo evaluados.

## Criterios de aceptación para piloto inicial

- Agricultor peruano puede completar tarea en móvil sin escribir el
  nombre científico ni navegar miles de fichas.
- El mapa deja explícita la diferencia entre terreno dibujado y celda
  satelital; no simula datos cuando una capa es inaccesible.
- Leyendas visibles, texto junto a colores, fecha y origen comprobable.
- Foto inválida, planta desconocida o sin modelo -> mensaje claro
  y selección manual; **no se propone un cultivo ficticio**.
- Confirmación del usuario antes de usar etiqueta reconocida en
  comparaciones agrícolas; se puede corregir en cualquier momento.
- Evaluación con agricultores de Huaral y validación de especialistas
  antes de usar la tecnología como soporte agronómico operativo.

## Prioridades de implementación

**P0.** Precisar la parcela o microzona agrícola de Huaral; diseño
móvil «Mi terreno» y leyendas comprensibles.

**P1.** Botón foto, transmisión segura, validación de imagen y contrato
de abstención; catálogo simplificado en backend y selección manual.

**P2.** Dataset etiquetado local, selección de modelo, evaluación en
campo, top-3 y confirmación; sin necesidad de diagnóstico de enfermedades.

**P3.** Migración geoespacial de Calca a polígono Huaral, servicios NASA
dentro de cobertura demostrada, pruebas integrales y validación agronómica.

**No declarar v0.17 funcional hasta completar los hitos y las pruebas.**
